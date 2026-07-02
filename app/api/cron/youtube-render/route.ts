import { NextRequest, NextResponse } from 'next/server'
import prisma from '../../../../lib/db'
import {
  YOUTUBE_PRODUCTION_ACTIVE_STATUSES,
  YOUTUBE_PRODUCTION_STALE_MS,
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

export async function GET(request: NextRequest) {
  if (!verifyBearerSecret(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return unauthorizedJson()
  }

  const staleBefore = new Date(Date.now() - YOUTUBE_PRODUCTION_STALE_MS)
  const running = await prisma.youTubeAutomationDay.findFirst({
    where: {
      status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      renderStage: { notIn: QUEUED_STAGES },
      updatedAt: { gte: staleBefore },
      renderCancelRequested: false,
    },
    select: { id: true },
  })
  if (running) {
    return NextResponse.json({ ok: true, skipped: 'renderer_busy', dayId: running.id })
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
      renderProgress: true,
      updatedAt: true,
    },
  })
  if (!candidate) return NextResponse.json({ ok: true, skipped: 'queue_empty' })

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
      throwOnFailure: true,
    })
    return NextResponse.json({ ok: true, dayId: candidate.id, status: 'completed' })
  } catch (error) {
    logYouTubeAutomation('error', 'render_queue_job_failed', context, summarizeYouTubeAutomationError(error))
    return NextResponse.json({ ok: false, dayId: candidate.id, status: 'failed' }, { status: 500 })
  }
}
