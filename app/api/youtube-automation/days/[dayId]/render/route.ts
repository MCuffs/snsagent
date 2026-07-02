import { NextResponse, after } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomationDay, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import { logYouTubeAutomation, summarizeYouTubeAutomationError } from '../../../../../../src/lib/youtube/logging'
import { produceYouTubeShorts } from '../../../../../../src/lib/youtube/produce'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const startedAt = Date.now()
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id')
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const logContext = { requestId, route: '/api/youtube-automation/days/[dayId]/render', userId: user.id, dayId }
  logYouTubeAutomation('info', 'render_request_start', logContext)
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
  })
  if (!day) {
    logYouTubeAutomation('warn', 'render_request_day_not_found', logContext, { durationMs: Date.now() - startedAt })
    return NextResponse.json({ error: '제작할 영상을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (!canUseYouTubeAutomationDay(user, day.dayNumber)) {
    logYouTubeAutomation('warn', 'render_request_plan_blocked', logContext, { dayNumber: day.dayNumber, durationMs: Date.now() - startedAt })
    return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  }

  const hasPlan = Boolean(day.script && day.scenesJson && day.sourceClipsJson)
  const status = hasPlan ? 'rendering' : 'planning'
  const renderStage = hasPlan ? '영상 제작 준비 중' : '스크립트 생성 준비 중'
  const claimed = await prisma.youTubeAutomationDay.updateMany({
    where: {
      id: day.id,
      status: { notIn: ['planning', 'rendering'] },
    },
    data: {
      status,
      renderProgress: 1,
      renderStage,
      renderCancelRequested: false,
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

  after(async () => {
    logYouTubeAutomation('info', 'render_after_start', logContext)
    try {
      await produceYouTubeShorts({ dayId: day.id, userId: user.id, requestId })
      logYouTubeAutomation('info', 'render_after_done', logContext)
    } catch (error) {
      logYouTubeAutomation('error', 'render_after_unhandled_error', logContext, summarizeYouTubeAutomationError(error))
      throw error
    }
  })

  return NextResponse.json({
    day: { id: day.id, status, renderProgress: 1, renderStage },
  }, { status: 202 })
}

export async function DELETE(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id')
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const logContext = { requestId, route: '/api/youtube-automation/days/[dayId]/render', userId: user.id, dayId }
  const result = await prisma.youTubeAutomationDay.updateMany({
    where: { id: dayId, userId: user.id, status: { in: ['planning', 'rendering'] } },
    data: {
      status: 'ready',
      renderCancelRequested: true,
      renderProgress: 0,
      renderStage: '영상 제작 중단됨',
    },
  })
  if (result.count === 0) {
    logYouTubeAutomation('warn', 'render_cancel_not_found', logContext)
    return NextResponse.json({ error: '진행 중인 영상 제작을 찾을 수 없습니다.' }, { status: 404 })
  }
  logYouTubeAutomation('info', 'render_cancel_requested', logContext)
  return NextResponse.json({ ok: true })
}
