import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import type { StockVideoCandidate, YouTubeScenePlan } from '../../../../../../src/lib/youtube/automation'
import { renderYouTubeShortsFromStock } from '../../../../../../src/lib/youtube/render'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
  })
  if (!day) return NextResponse.json({ error: '캘린더 항목을 찾을 수 없습니다.' }, { status: 404 })
  if (!day.script || !day.scenesJson) {
    return NextResponse.json({ error: '먼저 제목을 클릭해 제작안을 생성해 주세요.' }, { status: 400 })
  }

  await prisma.youTubeAutomationDay.update({
    where: { id: day.id },
    data: { status: 'rendering' },
  })

  try {
    const scenes = parseJsonArray<YouTubeScenePlan>(day.scenesJson)
    const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
    const rendered = await renderYouTubeShortsFromStock({
      userId: user.id,
      dayId: day.id,
      title: day.title,
      script: day.script,
      scenes,
      sourceClips,
    })

    const updated = await prisma.youTubeAutomationDay.update({
      where: { id: day.id },
      data: {
        status: 'completed',
        mp4Url: rendered.mp4Url,
        thumbnailUrl: rendered.thumbnailUrl,
        ttsAudioUrl: rendered.ttsAudioUrl,
        ttsProvider: rendered.ttsProvider,
      },
    })

    return NextResponse.json({
      day: {
        id: updated.id,
        status: updated.status,
        mp4Url: updated.mp4Url,
        thumbnailUrl: updated.thumbnailUrl,
        ttsAudioUrl: updated.ttsAudioUrl,
        ttsProvider: updated.ttsProvider,
      },
    })
  } catch (error) {
    await prisma.youTubeAutomationDay.update({
      where: { id: day.id },
      data: { status: 'failed' },
    }).catch(() => undefined)

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'MP4 렌더링에 실패했습니다.',
    }, { status: 500 })
  }
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}
