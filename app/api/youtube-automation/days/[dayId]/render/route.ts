import { NextResponse, after } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomationDay, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import { produceYouTubeShorts } from '../../../../../../src/lib/youtube/produce'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
  })
  if (!day) return NextResponse.json({ error: '제작할 영상을 찾을 수 없습니다.' }, { status: 404 })
  if (!canUseYouTubeAutomationDay(user, day.dayNumber)) {
    return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  }

  const hasPlan = Boolean(day.script && day.scenesJson && day.sourceClipsJson)
  const status = hasPlan ? 'rendering' : 'planning'
  const renderStage = hasPlan ? '영상 제작 준비 중' : '스크립트 생성 준비 중'
  const claimed = await prisma.youTubeAutomationDay.updateMany({
    where: {
      id: day.id,
      status: { notIn: ['planning', 'rendering'] },
      renderCancelRequested: false,
    },
    data: {
      status,
      renderProgress: 1,
      renderStage,
      renderCancelRequested: false,
    },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: '이미 영상 제작이 진행 중입니다.' }, { status: 409 })
  }

  after(() => produceYouTubeShorts({ dayId: day.id, userId: user.id }))

  return NextResponse.json({
    day: { id: day.id, status, renderProgress: 1, renderStage },
  }, { status: 202 })
}

export async function DELETE(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
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
    return NextResponse.json({ error: '진행 중인 영상 제작을 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
