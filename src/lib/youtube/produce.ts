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
import { logYouTubeAutomation, summarizeYouTubeAutomationError } from './logging'
import { renderYouTubeShortsFromStock, YouTubeRenderCancelledError } from './render'

export async function produceYouTubeShorts({
  dayId,
  userId,
  requestId,
  throwOnFailure = false,
}: {
  dayId: string
  userId: string
  requestId?: string | null
  throwOnFailure?: boolean
}) {
  const startedAt = Date.now()
  let lastProgress = 1
  let lastStage = '영상 제작 준비 중'
  let logContext = { requestId, userId, dayId } as {
    requestId?: string | null
    userId: string
    dayId: string
    projectId?: string
    dayNumber?: number
    title?: string
  }
  const setProgress = async (renderProgress: number, renderStage: string, status: 'planning' | 'rendering' = 'planning') => {
    lastProgress = renderProgress
    lastStage = renderStage
    logYouTubeAutomation('info', 'production_progress', logContext, {
      status,
      renderProgress,
      renderStage,
      durationMs: Date.now() - startedAt,
    })
    await prisma.youTubeAutomationDay.update({
      where: { id: dayId },
      data: { status, renderProgress, renderStage },
    })
  }

  try {
    logYouTubeAutomation('info', 'production_start', logContext)
    let day = await prisma.youTubeAutomationDay.findFirst({
      where: { id: dayId, userId },
      include: { project: true },
    })
    if (!day) throw new Error('제작할 영상을 찾을 수 없습니다.')
    logContext = {
      ...logContext,
      projectId: day.projectId,
      dayNumber: day.dayNumber,
      title: day.title,
    }
    logYouTubeAutomation('info', 'production_day_loaded', logContext, {
      status: day.status,
      renderProgress: day.renderProgress,
      renderStage: day.renderStage,
      hasScript: Boolean(day.script),
      hasScenes: Boolean(day.scenesJson),
      hasSourceClips: Boolean(day.sourceClipsJson),
    })

    if (!day.script || !day.scenesJson || !day.sourceClipsJson) {
      await setProgress(5, '콘텐츠 분류 중')

      logYouTubeAutomation('info', 'classification_start', logContext)
      const classification = await classifyShortsContent({
        topic: day.project.topic,
        title: day.title,
        userId,
      })
      logYouTubeAutomation('info', 'classification_done', logContext, {
        contentType: classification?.contentType,
        tone: classification?.tone,
        recommendedTemplateKey: classification?.recommendedTemplateKey,
        confidenceScore: classification?.confidenceScore,
      })
      await setProgress(10, '템플릿 선택 중')

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
      logYouTubeAutomation('info', 'recent_strategy_loaded', logContext, {
        recentDayCount: recentDays.length,
        recentTemplateKeys: recentDays.flatMap(item => item.selectedTemplateKey ? [item.selectedTemplateKey] : []),
        recentPlanStrategyKeys: recentDays.flatMap(item => item.selectedPlanStrategyKey ? [item.selectedPlanStrategyKey] : []),
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
      logYouTubeAutomation('info', 'template_strategy_selected', logContext, {
        templateKey: selection.template.templateKey,
        templateVersion: selection.template.version,
        usedDefaultTemplate: selection.usedDefaultTemplate,
        planStrategyKey: planStrategy.key,
        targetSceneCount: planStrategy.targetSceneCount,
      })
      await setProgress(15, '제작안 생성 중')

      const plan = await generateDayProductionPlan({
        topic: day.project.topic,
        title: day.title,
        userId,
        template: selection.template,
        usedDefaultTemplate: selection.usedDefaultTemplate,
        planStrategy,
      })
      logYouTubeAutomation('info', 'day_plan_generated', logContext, {
        sceneCount: plan.scenes.length,
        sourceClipCount: plan.sourceClips.length,
        usableSourceClipCount: plan.sourceClips.filter(clip => clip.videoUrl).length,
        ttsProvider: plan.ttsProvider,
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
      lastProgress = 30
      lastStage = '영상 소스 준비 완료'
      logYouTubeAutomation('info', 'day_plan_saved', logContext, {
        renderProgress: 30,
        renderStage: '영상 소스 준비 완료',
        durationMs: Date.now() - startedAt,
      })

      day = await prisma.youTubeAutomationDay.findFirst({
        where: { id: dayId, userId },
        include: { project: true },
      })
      if (!day) throw new Error('제작할 영상을 찾을 수 없습니다.')
    }

    if (!day.script || !day.scenesJson) throw new Error('영상 제작 데이터가 없습니다.')
    const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
    if (!sourceClips.some(clip => clip.videoUrl)) throw new Error('사용 가능한 영상 소스가 없습니다.')
    const scenes = parseJsonArray<YouTubeScenePlan>(day.scenesJson)

    logYouTubeAutomation('info', 'render_start', logContext, {
      sceneCount: scenes.length,
      sourceClipCount: sourceClips.length,
      usableSourceClipCount: sourceClips.filter(clip => clip.videoUrl).length,
    })
    const rendered = await renderYouTubeShortsFromStock({
      userId,
      dayId,
      title: day.title,
      script: day.script,
      scenes,
      sourceClips,
      template: parseTemplateSnapshot(day.templateSnapshotJson),
      onProgress: async (renderProgress, renderStage) => {
        lastProgress = renderProgress
        lastStage = renderStage
        logYouTubeAutomation('info', 'render_progress', logContext, {
          renderProgress,
          renderStage,
          durationMs: Date.now() - startedAt,
        })
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
    logYouTubeAutomation('info', 'production_complete', logContext, {
      durationMs: Date.now() - startedAt,
      hasMp4: Boolean(rendered.mp4Url),
      hasThumbnail: Boolean(rendered.thumbnailUrl),
      hasTtsAudio: Boolean(rendered.ttsAudioUrl),
      ttsProvider: rendered.ttsProvider,
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
    logYouTubeAutomation(cancelled ? 'warn' : 'error', cancelled ? 'production_cancelled' : 'production_failed', logContext, {
      failureStage,
      durationMs: Date.now() - startedAt,
      ...summarizeYouTubeAutomationError(error),
    })
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
