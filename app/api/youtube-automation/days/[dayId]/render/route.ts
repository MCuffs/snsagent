import { after, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomation, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import type { StockVideoCandidate, YouTubeScenePlan } from '../../../../../../src/lib/youtube/automation'
import {
  renderYouTubeShortsFromStock,
  YouTubeRenderCancelledError,
} from '../../../../../../src/lib/youtube/render'
import { shortsTemplateInputSchema, type YouTubeShortsTemplateRecord } from '../../../../../../lib/youtube-shorts-templates/types'

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

  const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
  if (!sourceClips.some(clip => clip.videoUrl)) {
    return NextResponse.json({ error: '사용 가능한 영상 클립이 없습니다. 제작안을 다시 생성해 주세요.' }, { status: 400 })
  }

  const claimed = await prisma.youTubeAutomationDay.updateMany({
    where: { id: day.id, status: { not: 'rendering' } },
    data: {
      status: 'rendering',
      renderProgress: 1,
      renderStage: '영상 제작 준비 중',
      renderCancelRequested: false,
    },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: '이미 영상 제작이 진행 중입니다.' }, { status: 409 })
  }

  after(async () => {
    try {
      const rendered = await renderYouTubeShortsFromStock({
        userId: user.id,
        dayId: day.id,
        title: day.title,
        script: day.script!,
        scenes: parseJsonArray<YouTubeScenePlan>(day.scenesJson),
        sourceClips,
        template: parseTemplateSnapshot(day.templateSnapshotJson),
        onProgress: async (renderProgress, renderStage) => {
          await prisma.youTubeAutomationDay.update({
            where: { id: day.id },
            data: { renderProgress, renderStage },
          })
        },
        shouldCancel: async () => {
          const current = await prisma.youTubeAutomationDay.findUnique({
            where: { id: day.id },
            select: { renderCancelRequested: true },
          })
          return current?.renderCancelRequested ?? true
        },
      })

      await prisma.youTubeAutomationDay.update({
        where: { id: day.id },
        data: {
          status: 'completed',
          mp4Url: rendered.mp4Url,
          thumbnailUrl: rendered.thumbnailUrl,
          ttsAudioUrl: rendered.ttsAudioUrl,
          ttsProvider: rendered.ttsProvider,
          subtitleJson: JSON.stringify(rendered.subtitles),
          renderProgress: 100,
          renderStage: '영상 제작 완료',
          renderCancelRequested: false,
        },
      })
    } catch (error) {
      const cancelled = error instanceof YouTubeRenderCancelledError
      await prisma.youTubeAutomationDay.update({
        where: { id: day.id },
        data: {
          status: cancelled ? 'ready' : 'failed',
          renderProgress: 0,
          renderStage: cancelled ? '영상 제작 중단됨' : '영상 제작 실패',
          renderCancelRequested: false,
        },
      }).catch(() => undefined)
      console.error(`[YouTubeRender] Background render ${cancelled ? 'cancelled' : 'failed'} for ${day.id}:`, error)
    }
  })

  return NextResponse.json({
    day: {
      id: day.id,
      status: 'rendering',
      renderProgress: 1,
      renderStage: '영상 제작 준비 중',
    },
  }, { status: 202 })
}

export async function DELETE(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const result = await prisma.youTubeAutomationDay.updateMany({
    where: { id: dayId, userId: user.id, status: 'rendering' },
    data: {
      renderCancelRequested: true,
      renderStage: '중단 요청 처리 중',
    },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: '진행 중인 영상 제작을 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
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

function parseTemplateSnapshot(value: string | null): YouTubeShortsTemplateRecord | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as YouTubeShortsTemplateRecord
    return shortsTemplateInputSchema.safeParse(parsed).success ? parsed : undefined
  } catch {
    return undefined
  }
}
