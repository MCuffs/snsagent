import prisma from '../../../lib/db'
import { selectPlanStrategy } from '../../../lib/youtube-plan-strategies'
import { selectShortsTemplate } from '../../../lib/youtube-shorts-templates/select'
import { shortsTemplateInputSchema, type YouTubeShortsTemplateRecord } from '../../../lib/youtube-shorts-templates/types'
import {
  classifyShortsContent,
  generateDayProductionPlan,
  type StockVideoCandidate,
  type YouTubeScenePlan,
} from './automation'
import { renderYouTubeShortsFromStock, YouTubeRenderCancelledError } from './render'

export async function produceYouTubeShorts({
  dayId,
  userId,
  throwOnFailure = false,
}: {
  dayId: string
  userId: string
  throwOnFailure?: boolean
}) {
  let lastProgress = 1
  let lastStage = '영상 제작 준비 중'
  try {
    let day = await prisma.youTubeAutomationDay.findFirst({
      where: { id: dayId, userId },
      include: { project: true },
    })
    if (!day) throw new Error('제작할 영상을 찾을 수 없습니다.')

    if (!day.script || !day.scenesJson || !day.sourceClipsJson) {
      await prisma.youTubeAutomationDay.update({
        where: { id: dayId },
        data: { status: 'planning', renderProgress: 5, renderStage: '스크립트 생성 중' },
      })

      const classification = await classifyShortsContent({
        topic: day.project.topic,
        title: day.title,
        userId,
      })
      const recentDays = await prisma.youTubeAutomationDay.findMany({
        where: {
          projectId: day.projectId,
          dayNumber: { lt: day.dayNumber },
          selectedPlanStrategyKey: { not: null },
        },
        orderBy: { dayNumber: 'desc' },
        take: 5,
        select: { selectedPlanStrategyKey: true, selectedTemplateKey: true },
      })
      const selection = await selectShortsTemplate(
        classification,
        recentDays.flatMap(item => item.selectedTemplateKey ? [item.selectedTemplateKey] : []),
      )
      const planStrategy = selectPlanStrategy({
        classification,
        recentKeys: recentDays.flatMap(item => item.selectedPlanStrategyKey ? [item.selectedPlanStrategyKey] : []),
        seed: `${day.projectId}:${day.dayNumber}:${day.title}`,
      })
      const plan = await generateDayProductionPlan({
        topic: day.project.topic,
        title: day.title,
        userId,
        template: selection.template,
        usedDefaultTemplate: selection.usedDefaultTemplate,
        planStrategy,
      })

      const planned = await prisma.youTubeAutomationDay.updateMany({
        where: { id: dayId, renderCancelRequested: false },
        data: {
          status: 'rendering',
          script: plan.script,
          description: plan.description,
          tagsJson: JSON.stringify(plan.tags),
          pinnedComment: plan.pinnedComment,
          scenesJson: JSON.stringify(plan.scenes),
          sourceClipsJson: JSON.stringify(plan.sourceClips),
          ttsProvider: plan.ttsProvider,
          subtitleJson: JSON.stringify(plan.subtitles),
          selectedTemplateKey: selection.template.templateKey,
          templateVersion: selection.template.version,
          templateSnapshotJson: JSON.stringify(selection.template),
          classifierResultJson: JSON.stringify(classification),
          usedDefaultTemplate: selection.usedDefaultTemplate,
          selectionReason: selection.reason,
          videoStructureJson: JSON.stringify(plan.videoStructure),
          selectedPlanStrategyKey: planStrategy.key,
          planStrategySnapshotJson: JSON.stringify(planStrategy),
          sceneRoleSequenceJson: JSON.stringify(plan.scenes.map(scene => scene.sceneRole)),
          hookPattern: planStrategy.hookPattern,
          endingPattern: planStrategy.endingPattern,
          renderProgress: 30,
          renderStage: '영상 소스 준비 완료',
        },
      })
      if (planned.count === 0) throw new YouTubeRenderCancelledError()

      day = await prisma.youTubeAutomationDay.findFirst({
        where: { id: dayId, userId },
        include: { project: true },
      })
      if (!day) throw new Error('제작할 영상을 찾을 수 없습니다.')
    }

    if (!day.script || !day.scenesJson) throw new Error('영상 제작 데이터가 없습니다.')
    const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
    if (!sourceClips.some(clip => clip.videoUrl)) throw new Error('사용 가능한 영상 소스가 없습니다.')

    const rendered = await renderYouTubeShortsFromStock({
      userId,
      dayId,
      title: day.title,
      script: day.script,
      scenes: parseJsonArray<YouTubeScenePlan>(day.scenesJson),
      sourceClips,
      template: parseTemplateSnapshot(day.templateSnapshotJson),
      onProgress: async (renderProgress, renderStage) => {
        lastProgress = renderProgress
        lastStage = renderStage
        const updated = await prisma.youTubeAutomationDay.updateMany({
          where: { id: dayId, renderCancelRequested: false },
          data: { status: 'rendering', renderProgress, renderStage },
        })
        if (updated.count === 0) throw new YouTubeRenderCancelledError()
      },
      shouldCancel: async () => {
        const current = await prisma.youTubeAutomationDay.findUnique({
          where: { id: dayId },
          select: { renderCancelRequested: true },
        })
        return current?.renderCancelRequested ?? true
      },
    })

    await prisma.youTubeAutomationDay.update({
      where: { id: dayId },
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
    const errorSummary = formatProductionError(error)
    const failureStage = `${lastProgress}% ${lastStage}`
    await prisma.youTubeAutomationDay.update({
      where: { id: dayId },
      data: {
        status: cancelled ? 'ready' : 'failed',
        renderProgress: 0,
        renderStage: cancelled
          ? '영상 제작 중단됨'
          : `영상 제작 실패 (${failureStage}): ${errorSummary}`,
        renderCancelRequested: false,
      },
    }).catch(() => undefined)
    console.error(
      `[YouTubeRender] Background production ${cancelled ? 'cancelled' : 'failed'} `
      + `for ${dayId} at ${failureStage}:`,
      error,
    )
    if (throwOnFailure && !cancelled) throw error
  }
}

function formatProductionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '[external-url]')
    .slice(0, 240)
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
