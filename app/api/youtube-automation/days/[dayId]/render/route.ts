import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomationDay, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import {
  isYouTubeProductionActiveStatus,
  isYouTubeProductionQueuedStage,
  YOUTUBE_CANCEL_SETTLE_MS,
  YOUTUBE_PRODUCTION_ACTIVE_STATUSES,
  YOUTUBE_PRODUCTION_QUEUED_STAGES,
  YOUTUBE_PRODUCTION_STALE_MS,
} from '../../../../../../lib/youtube-automation-production-state'
import { logYouTubeAutomation } from '../../../../../../src/lib/youtube/logging'
import { isYouTubeAutomationDayOpen } from '../../../../../../lib/youtube-automation-state'
import { checkYouTubeProductionPreflight } from '../../../../../../src/lib/youtube/preflight'

export const runtime = 'nodejs'
export const maxDuration = 600

function stripRenderRetryNotes(value: string | null): string | null {
  if (!value) return value
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return value
    return JSON.stringify(parsed.filter(note => (note as { type?: string })?.type !== 'render_retry'))
  } catch {
    return value
  }
}

// A day that failed by exhausting its requeue budget keeps its per-scene checkpoint;
// a user-initiated re-render must restart that budget or the first requeue fails it again.
function resetCheckpointRequeues(value: string | null): string | null {
  if (!value) return value
  try {
    const parsed = JSON.parse(value) as { requeueCount?: number }
    return JSON.stringify({ ...parsed, requeueCount: 0 })
  } catch {
    return value
  }
}

export async function POST(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const startedAt = Date.now()
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id')
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const logContext = { requestId, route: '/api/youtube-automation/days/[dayId]/render', userId: user.id, dayId }
  logYouTubeAutomation('info', 'render_request_start', logContext)
  let day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
    include: { project: { select: { currentOpenDay: true } } },
  })
  if (!day) {
    logYouTubeAutomation('warn', 'render_request_day_not_found', logContext, { durationMs: Date.now() - startedAt })
    return NextResponse.json({ error: '제작할 영상을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!canUseYouTubeAutomationDay(user, day.dayNumber)) {
    logYouTubeAutomation('warn', 'render_request_plan_blocked', logContext, { dayNumber: day.dayNumber, durationMs: Date.now() - startedAt })
    return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  }
  if (!isYouTubeAutomationDayOpen(day, day.project.currentOpenDay)) {
    logYouTubeAutomation('warn', 'render_request_locked_day', logContext, {
      dayNumber: day.dayNumber,
      status: day.status,
      currentOpenDay: day.project.currentOpenDay,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: '아직 오픈되지 않은 날짜입니다.' }, { status: 403 })
  }

  const preflight = checkYouTubeProductionPreflight()
  if (!preflight.ok) {
    logYouTubeAutomation('error', 'render_request_preflight_failed', logContext, {
      error: preflight.error,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: preflight.error }, { status: 503 })
  }

  if (
    isYouTubeProductionActiveStatus(day.status)
    && !isYouTubeProductionQueuedStage(day.renderStage)
    && day.updatedAt.getTime() < Date.now() - YOUTUBE_PRODUCTION_STALE_MS
  ) {
    const recovered = await prisma.youTubeAutomationDay.updateMany({
      where: {
        id: day.id,
        userId: user.id,
        status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
        renderStage: { notIn: [...YOUTUBE_PRODUCTION_QUEUED_STAGES] },
        updatedAt: { lt: new Date(Date.now() - YOUTUBE_PRODUCTION_STALE_MS) },
      },
      data: {
        status: 'failed',
        renderProgress: 0,
        renderStage: '영상 제작 시간이 초과되었습니다. 다시 시도해 주세요.',
        renderCancelRequested: false,
      },
    })
    if (recovered.count > 0) {
      logYouTubeAutomation('warn', 'render_request_recovered_stale_day', logContext, {
        staleMs: YOUTUBE_PRODUCTION_STALE_MS,
        previousStatus: day.status,
        previousRenderProgress: day.renderProgress,
        previousRenderStage: day.renderStage,
      })
      day = await prisma.youTubeAutomationDay.findFirstOrThrow({
        where: { id: day.id },
        include: { project: { select: { currentOpenDay: true } } },
      })
    }
  }

  if (isYouTubeProductionActiveStatus(day.status) && day.renderCancelRequested) {
    const cancelAgeMs = Date.now() - day.updatedAt.getTime()
    if (cancelAgeMs >= YOUTUBE_CANCEL_SETTLE_MS) {
      const settled = await prisma.youTubeAutomationDay.updateMany({
        where: {
          id: day.id,
          userId: user.id,
          status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
          renderCancelRequested: true,
          updatedAt: { lt: new Date(Date.now() - YOUTUBE_CANCEL_SETTLE_MS) },
        },
        data: {
          status: 'ready',
          renderProgress: 0,
          renderStage: '영상 제작 중단됨',
          renderCancelRequested: false,
        },
      })
      if (settled.count > 0) {
        logYouTubeAutomation('warn', 'render_request_settled_active_cancel', logContext, {
          previousStatus: day.status,
          previousRenderProgress: day.renderProgress,
          previousRenderStage: day.renderStage,
          cancelAgeMs,
          settleMs: YOUTUBE_CANCEL_SETTLE_MS,
        })
        day = await prisma.youTubeAutomationDay.findFirstOrThrow({
          where: { id: day.id },
          include: { project: { select: { currentOpenDay: true } } },
        })
      }
    } else {
      logYouTubeAutomation('warn', 'render_request_active_cancel_settling', logContext, {
        status: day.status,
        renderProgress: day.renderProgress,
        renderStage: day.renderStage,
        cancelAgeMs,
        settleMs: YOUTUBE_CANCEL_SETTLE_MS,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json({ error: '이전 영상 제작 중단을 처리 중입니다. 잠시 후 다시 시도해 주세요.' }, { status: 409 })
    }
  }

  if (!isYouTubeProductionActiveStatus(day.status) && day.renderCancelRequested) {
    const cancelAgeMs = Date.now() - day.updatedAt.getTime()
    if (cancelAgeMs < YOUTUBE_CANCEL_SETTLE_MS) {
      logYouTubeAutomation('warn', 'render_request_cancel_settling', logContext, {
        status: day.status,
        renderProgress: day.renderProgress,
        renderStage: day.renderStage,
        cancelAgeMs,
        settleMs: YOUTUBE_CANCEL_SETTLE_MS,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json({ error: '이전 영상 제작 중단을 처리 중입니다. 잠시 후 다시 시도해 주세요.' }, { status: 409 })
    }

    const cleared = await prisma.youTubeAutomationDay.updateMany({
      where: {
        id: day.id,
        userId: user.id,
        status: { notIn: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
        renderCancelRequested: true,
      },
      data: {
        renderCancelRequested: false,
        renderProgress: day.status === 'completed' ? 100 : 0,
        renderStage: day.status === 'completed' ? '영상 제작 완료' : '영상 제작 중단됨',
      },
    })
    if (cleared.count > 0) {
      logYouTubeAutomation('warn', 'render_request_cleared_settled_cancel', logContext, {
        status: day.status,
        cancelAgeMs,
      })
      day = await prisma.youTubeAutomationDay.findFirstOrThrow({
        where: { id: day.id },
        include: { project: { select: { currentOpenDay: true } } },
      })
    }
  }

  const body = await request.json().catch(() => null) as { regeneratePlan?: boolean } | null
  const regeneratePlan = Boolean(body?.regeneratePlan)
  const hasPlan = !regeneratePlan && Boolean(day.script && day.scenesJson && day.sourceClipsJson)
  const status = hasPlan ? 'rendering' : 'planning'
  const renderStage = hasPlan ? '영상 제작 대기열 등록됨' : '스크립트 생성 대기열 등록됨'
  const initialProgress = hasPlan ? 30 : 1
  const claimed = await prisma.youTubeAutomationDay.updateMany({
    where: {
      id: day.id,
      status: { notIn: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
    },
    data: {
      status,
      renderProgress: initialProgress,
      renderStage,
      renderCancelRequested: false,
      // A degraded plan (e.g. generic fallback script) can be discarded so production replans from scratch
      ...(regeneratePlan
        ? { script: null, scenesJson: null, sourceClipsJson: null, qualityNotesJson: null, renderCheckpointJson: null }
        // A user-initiated render resets the cron's silent-death recovery counter and the
        // requeue budget, while keeping the per-scene checkpoint so work resumes, not restarts
        : {
          qualityNotesJson: stripRenderRetryNotes(day.qualityNotesJson),
          renderCheckpointJson: resetCheckpointRequeues(day.renderCheckpointJson),
        }),
    },
  })
  if (claimed.count === 0) {
    logYouTubeAutomation('warn', 'render_request_already_running', logContext, {
      status: day.status,
      renderProgress: day.renderProgress,
      renderStage: day.renderStage,
      renderCancelRequested: day.renderCancelRequested,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: '이미 영상 제작이 진행 중입니다.' }, { status: 409 })
  }

  logYouTubeAutomation('info', 'render_request_claimed', logContext, {
    projectId: day.projectId,
    dayNumber: day.dayNumber,
    status,
    renderStage,
    hasPlan,
    durationMs: Date.now() - startedAt,
  })

  logYouTubeAutomation('info', 'render_queue_enqueued', logContext)

  return NextResponse.json({
    day: { id: day.id, status, renderProgress: initialProgress, renderStage, renderCancelRequested: false },
  }, { status: 202 })
}

export async function DELETE(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id')
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const logContext = { requestId, route: '/api/youtube-automation/days/[dayId]/render', userId: user.id, dayId }
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
  })
  if (!day) {
    logYouTubeAutomation('warn', 'render_cancel_day_not_found', logContext)
    return NextResponse.json({ error: '진행 중인 영상 제작을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!isYouTubeProductionActiveStatus(day.status)) {
    logYouTubeAutomation('info', 'render_cancel_noop', logContext, {
      status: day.status,
      renderProgress: day.renderProgress,
      renderStage: day.renderStage,
      renderCancelRequested: day.renderCancelRequested,
    })
    return NextResponse.json({
      ok: true,
      day: {
        id: day.id,
        status: day.status,
        renderProgress: day.renderProgress,
        renderStage: day.renderStage,
        renderCancelRequested: day.renderCancelRequested,
      },
    })
  }
  const result = await prisma.youTubeAutomationDay.updateMany({
    where: { id: dayId, userId: user.id, status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] } },
    data: {
      renderCancelRequested: true,
      renderStage: '영상 제작 중단 요청 중',
    },
  })
  if (result.count === 0) {
    logYouTubeAutomation('warn', 'render_cancel_not_found', logContext)
    return NextResponse.json({ error: '진행 중인 영상 제작을 찾을 수 없습니다.' }, { status: 404 })
  }
  logYouTubeAutomation('info', 'render_cancel_requested', logContext)
  return NextResponse.json({
    ok: true,
    day: {
      id: day.id,
      status: day.status,
      renderProgress: day.renderProgress,
      renderStage: '영상 제작 중단 요청 중',
      renderCancelRequested: true,
    },
  })
}
