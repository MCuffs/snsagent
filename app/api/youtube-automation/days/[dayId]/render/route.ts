import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomation, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import type { StockVideoCandidate, YouTubeScenePlan } from '../../../../../../src/lib/youtube/automation'
import { renderYouTubeShortsFromStock } from '../../../../../../src/lib/youtube/render'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (user && !canUseYouTubeAutomation(user)) return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
  })
  if (!day) return NextResponse.json({ error: '캘린더 항목을 찾을 수 없습니다.' }, { status: 404 })
  if (!day.script || !day.scenesJson) {
    return NextResponse.json({ error: '먼저 제목을 클릭해 제작안을 생성해 주세요.' }, { status: 400 })
  }
  if (day.status === 'rendering') {
    return NextResponse.json({ error: '이미 렌더링이 진행 중입니다. 잠시 후 다시 시도해 주세요.' }, { status: 409 })
  }

  const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
  const usableClips = sourceClips.filter(c => c.videoUrl)
  if (usableClips.length === 0) {
    return NextResponse.json({ error: '사용 가능한 영상 클립이 없습니다. 제목을 다시 클릭해 제작안을 재생성해 주세요.' }, { status: 400 })
  }

  await prisma.youTubeAutomationDay.update({
    where: { id: day.id },
    data: { status: 'rendering' },
  })

  try {
    const scenes = parseJsonArray<YouTubeScenePlan>(day.scenesJson)
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
        // Store actual subtitle timings (derived from real TTS durations)
        subtitleJson: JSON.stringify(rendered.subtitles),
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
        subtitles: rendered.subtitles,
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
