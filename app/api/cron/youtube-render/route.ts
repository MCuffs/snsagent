import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../../lib/db'
import {
  YOUTUBE_PRODUCTION_ACTIVE_STATUSES,
  YOUTUBE_PRODUCTION_STALE_MS,
  YOUTUBE_RENDER_MAX_CONCURRENT,
} from '../../../../lib/youtube-automation-production-state'
import { unauthorizedJson, verifyBearerSecret } from '../../../../lib/security'
import { produceYouTubeShorts } from '../../../../src/lib/youtube/produce'
import { logYouTubeAutomation, summarizeYouTubeAutomationError } from '../../../../src/lib/youtube/logging'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 600

const QUEUED_STAGES = [
  '영상 제작 대기열 등록됨',
  '스크립트 생성 대기열 등록됨',
  // Workflow 소비 장애 당시 생성된 작업도 자동 회수한다.
  '영상 제작 준비 중',
  '스크립트 생성 준비 중',
]

// A silently-killed invocation leaves the day 'rendering' until it goes stale, and this cron
// would re-run it forever (die → stale → re-run). Cap silent-death recoveries per day row.
// Recoveries resume from the render checkpoint, so each attempt makes forward progress.
const MAX_STALE_RECOVERY_ATTEMPTS = 4

export async function GET(request: NextRequest) {
  const invocationStartedAt = Date.now()
  if (!verifyBearerSecret(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return unauthorizedJson()
  }

  const staleBefore = new Date(Date.now() - YOUTUBE_PRODUCTION_STALE_MS)
  // Renders now run in the render-request invocation itself (per-user parallel).
  // Only hold recovery back when the whole service is already at the concurrency cap.
  const runningCount = await prisma.youTubeAutomationDay.count({
    where: {
      status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      renderStage: { notIn: QUEUED_STAGES },
      updatedAt: { gte: staleBefore },
      renderCancelRequested: false,
    },
  })
  if (runningCount >= YOUTUBE_RENDER_MAX_CONCURRENT) {
    return NextResponse.json({ ok: true, skipped: 'renderer_busy', running: runningCount })
  }

  const candidate = await prisma.youTubeAutomationDay.findFirst({
    where: {
      renderCancelRequested: false,
      status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      OR: [
        { renderStage: { in: QUEUED_STAGES } },
        { updatedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      status: true,
      renderStage: true,
      renderProgress: true,
      qualityNotesJson: true,
      updatedAt: true,
    },
  })
  if (!candidate) return NextResponse.json({ ok: true, skipped: 'queue_empty' })

  const isStaleRecovery = candidate.updatedAt < staleBefore
    && !QUEUED_STAGES.includes(candidate.renderStage ?? '')
  const qualityNotes = parseQualityNotes(candidate.qualityNotesJson)
  const staleRecoveryCount = qualityNotes.filter(note => note?.type === 'render_retry').length
  if (isStaleRecovery && staleRecoveryCount >= MAX_STALE_RECOVERY_ATTEMPTS) {
    const failed = await prisma.youTubeAutomationDay.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        updatedAt: candidate.updatedAt,
        renderCancelRequested: false,
      },
      data: {
        status: 'failed',
        renderProgress: 0,
        renderStage: '영상 제작이 반복적으로 중단되어 실패 처리되었습니다. 다시 제작 버튼을 누르면 저장된 제작안부터 이어서 진행됩니다.',
      },
    })
    logYouTubeAutomation('error', 'render_queue_stale_retry_exhausted', {
      requestId: request.headers.get('x-vercel-id'),
      route: '/api/cron/youtube-render',
      userId: candidate.userId,
      dayId: candidate.id,
    }, { staleRecoveryCount, failedCount: failed.count })
    return NextResponse.json({ ok: true, dayId: candidate.id, skipped: 'stale_retry_exhausted' })
  }

  const claimed = await prisma.youTubeAutomationDay.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      renderProgress: candidate.renderProgress,
      updatedAt: candidate.updatedAt,
      renderCancelRequested: false,
    },
    data: {
      renderStage: candidate.renderProgress >= 30
        ? '영상 제작 작업 실행 중'
        : '스크립트 생성 작업 실행 중',
      ...(isStaleRecovery
        ? { qualityNotesJson: JSON.stringify([...qualityNotes, { type: 'render_retry' }]) }
        : {}),
    },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ ok: true, skipped: 'claim_lost' })
  }

  const context = {
    requestId: request.headers.get('x-vercel-id'),
    route: '/api/cron/youtube-render',
    userId: candidate.userId,
    dayId: candidate.id,
  }
  logYouTubeAutomation('info', 'render_queue_claimed', context, {
    recoveredStaleJob: candidate.updatedAt < staleBefore,
    previousProgress: candidate.renderProgress,
  })

  try {
    await produceYouTubeShorts({
      dayId: candidate.id,
      userId: candidate.userId,
      requestId: context.requestId,
      invocationStartedAt,
      throwOnFailure: true,
    })
    return NextResponse.json({ ok: true, dayId: candidate.id, status: 'completed' })
  } catch (error) {
    logYouTubeAutomation('error', 'render_queue_job_failed', context, summarizeYouTubeAutomationError(error))
    return NextResponse.json({ ok: false, dayId: candidate.id, status: 'failed' }, { status: 500 })
  }
}

function parseQualityNotes(value: string | null): Array<{ type?: string }> {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as Array<{ type?: string }> : []
  } catch {
    return []
  }
}
