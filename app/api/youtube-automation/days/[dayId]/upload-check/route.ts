import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import {
  canUseYouTubeAutomationDay,
  youtubeAutomationUpgradeResponse,
} from '../../../../../../lib/youtube-automation-access'
import { canMarkYouTubeAutomationDayUploaded } from '../../../../../../lib/youtube-automation-state'

export const runtime = 'nodejs'

export async function PATCH(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
    include: { project: true },
  })

  if (!day) return NextResponse.json({ error: '캘린더 항목을 찾을 수 없습니다.' }, { status: 404 })
  if (!canUseYouTubeAutomationDay(user, day.dayNumber)) return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  if (!canMarkYouTubeAutomationDayUploaded(day, day.project.currentOpenDay)) {
    return NextResponse.json({ error: '완성된 영상만 업로드 완료로 표시할 수 있습니다.' }, { status: 409 })
  }

  await prisma.$transaction([
    prisma.youTubeAutomationDay.update({
      where: { id: day.id },
      data: { status: 'uploaded', uploadedAt: new Date() },
    }),
    prisma.youTubeAutomationProject.update({
      where: { id: day.projectId },
      data: { status: day.dayNumber >= 30 ? 'completed' : 'in_progress' },
    }),
  ])

  const project = await prisma.youTubeAutomationProject.findUnique({
    where: { id: day.projectId },
    include: { days: true },
  })

  return NextResponse.json({
    currentOpenDay: project?.currentOpenDay ?? day.project.currentOpenDay,
    days: (project?.days || []).map(item => ({
      id: item.id,
      dayNumber: item.dayNumber,
      title: item.title,
      status: item.status,
      uploadedAt: item.uploadedAt?.toISOString?.() ?? item.uploadedAt,
    })),
  })
}
