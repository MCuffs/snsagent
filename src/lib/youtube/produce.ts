import prisma from '../../../lib/db'
import {
  YOUTUBE_PRODUCTION_ACTIVE_STATUSES,
  YOUTUBE_PRODUCTION_INVOCATION_BUDGET_MS,
} from '../../../lib/youtube-automation-production-state'
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
import { hasStockVideoProviderKey } from './preflight'
import {
  renderYouTubeShortsFromStock,
  YouTubeRenderCancelledError,
  YouTubeRenderRequeueError,
  type RenderCheckpoint,
} from './render'
import { resolveProjectTtsVoice } from './ttsVoice'

// A render that keeps requeuing itself is making checkpoint progress each time, but cap it
// so a systemically broken environment (e.g. ffmpeg missing) ends in an explicit failure.
const MAX_RENDER_REQUEUES = boundedPositiveInteger(process.env.YOUTUBE_RENDER_MAX_REQUEUES, 12, 2, 50)

const RENDER_QUEUED_STAGE = '영상 제작 대기열 등록됨'

export async function produceYouTubeShorts({
  dayId,
  userId,
  requestId,
  throwOnFailure = false,
  deadlineAt,
}: {
  dayId: string
  userId: string
  requestId?: string | null
  throwOnFailure?: boolean
  // Absolute epoch-ms cutoff from the serving invocation (function lifetime minus
  // a safety margin) — forwarded to the render pipeline so it requeues or self-terminates
  // with a recorded failure instead of being hard-killed by the platform.
  deadlineAt?: number
}) {
  const startedAt = Date.now()
  const invocationDeadlineAt = deadlineAt ?? (startedAt + YOUTUBE_PRODUCTION_INVOCATION_BUDGET_MS)
  let checkpoint: RenderCheckpoint = { version: 1, scenes: [] }
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
    const updated = await prisma.youTubeAutomationDay.updateMany({
      where: { id: dayId, renderCancelRequested: false, status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] } },
      data: { status, renderProgress, renderStage },
    })
    if (updated.count === 0) throw new YouTubeRenderCancelledError()
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
        where: { id: dayId, renderCancelRequested: false, status: 'planning' },
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
          qualityNotesJson: JSON.stringify(plan.usedFallbackPlan ? [{ type: 'generic_plan' }] : []),
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
    checkpoint = parseRenderCheckpoint(day.renderCheckpointJson)
    const sourceClips = parseJsonArray<StockVideoCandidate>(day.sourceClipsJson)
    if (!sourceClips.some(clip => clip.videoUrl)) {
      throw new Error(hasStockVideoProviderKey()
        ? '스톡 영상 검색 결과가 없습니다. 검색 API 사용량 초과 또는 일시적 장애일 수 있으니 잠시 후 다시 시도해 주세요.'
        : '스톡 영상 API 키(PEXELS_API_KEY 또는 PIXABAY_API_KEY)가 설정되지 않아 영상 소스를 찾을 수 없습니다.')
    }
    const scenes = parseJsonArray<YouTubeScenePlan>(day.scenesJson)
    const shouldCancel = createThrottledCancellationCheck(dayId, logContext)

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
      ttsVoice: resolveProjectTtsVoice(day.projectId, day.project.ttsVoice),
      deadlineAt: invocationDeadlineAt,
      checkpoint,
      onCheckpoint: async (nextCheckpoint) => {
        checkpoint = nextCheckpoint
        const saved = await prisma.youTubeAutomationDay.updateMany({
          where: { id: dayId, renderCancelRequested: false, status: 'rendering' },
          data: { renderCheckpointJson: JSON.stringify(nextCheckpoint) },
        })
        if (saved.count === 0) throw new YouTubeRenderCancelledError()
      },
      onProgress: async (renderProgress, renderStage) => {
        lastProgress = renderProgress
        lastStage = renderStage
        logYouTubeAutomation('info', 'render_progress', logContext, {
          renderProgress,
          renderStage,
          durationMs: Date.now() - startedAt,
        })
        const updated = await prisma.youTubeAutomationDay.updateMany({
          where: { id: dayId, renderCancelRequested: false, status: 'rendering' },
          data: { status: 'rendering', renderProgress, renderStage },
        })
        if (updated.count === 0) throw new YouTubeRenderCancelledError()
      },
      shouldCancel,
    })

    // Keep plan-phase notes (generic_plan), replace render-phase notes with this render's outcome
    const planPhaseNotes = parseJsonArray<{ type?: string }>(day.qualityNotesJson)
      .filter(note => note?.type === 'generic_plan')
    const completed = await prisma.youTubeAutomationDay.updateMany({
      where: { id: dayId, renderCancelRequested: false, status: 'rendering' },
      data: {
        status: 'completed',
        mp4Url: rendered.mp4Url,
        thumbnailUrl: rendered.thumbnailUrl,
        ttsAudioUrl: rendered.ttsAudioUrl,
        ttsProvider: rendered.ttsProvider,
        subtitleJson: JSON.stringify(rendered.subtitles),
        qualityNotesJson: JSON.stringify([...planPhaseNotes, ...rendered.qualityNotes]),
        renderCheckpointJson: null,
        renderProgress: 100,
        renderStage: '영상 제작 완료',
        renderCancelRequested: false,
      },
    })
    if (completed.count === 0) throw new YouTubeRenderCancelledError()
    logYouTubeAutomation('info', 'production_complete', logContext, {
      durationMs: Date.now() - startedAt,
      hasMp4: Boolean(rendered.mp4Url),
      hasThumbnail: Boolean(rendered.thumbnailUrl),
      hasTtsAudio: Boolean(rendered.ttsAudioUrl),
      ttsProvider: rendered.ttsProvider,
    })
  } catch (error) {
    if (error instanceof YouTubeRenderRequeueError) {
      const nextRequeueCount = (checkpoint.requeueCount ?? 0) + 1
      if (nextRequeueCount > MAX_RENDER_REQUEUES) {
        await prisma.youTubeAutomationDay.update({
          where: { id: dayId },
          data: {
            status: 'failed',
            renderProgress: 0,
            renderStage: `영상 제작 실패 (${lastProgress}% ${lastStage}): 제작이 ${MAX_RENDER_REQUEUES}회 이상 이어졌지만 완료되지 못했습니다. 다시 제작 버튼을 누르면 저장된 진행분부터 이어서 진행됩니다.`,
            renderCancelRequested: false,
          },
        }).catch(() => undefined)
        logYouTubeAutomation('error', 'production_requeue_exhausted', logContext, {
          requeueCount: nextRequeueCount,
          durationMs: Date.now() - startedAt,
        })
        if (throwOnFailure) throw error
        return
      }
      // Progress so far is checkpointed — hand the rest to a fresh invocation via the queue
      const requeued = await prisma.youTubeAutomationDay.updateMany({
        where: { id: dayId, renderCancelRequested: false, status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] } },
        data: {
          status: 'rendering',
          renderStage: RENDER_QUEUED_STAGE,
          renderCheckpointJson: JSON.stringify({ ...checkpoint, requeueCount: nextRequeueCount }),
        },
      }).catch(() => ({ count: 0 }))
      if (requeued.count > 0) {
        logYouTubeAutomation('info', 'production_requeued', logContext, {
          requeueCount: nextRequeueCount,
          lastProgress,
          lastStage,
          durationMs: Date.now() - startedAt,
        })
        return
      }
      // The day was cancelled or changed underneath us — settle as a cancel, not a failure
      await prisma.youTubeAutomationDay.update({
        where: { id: dayId },
        data: {
          status: 'ready',
          renderProgress: 0,
          renderStage: '영상 제작 중단됨',
          renderCancelRequested: false,
        },
      }).catch(() => undefined)
      logYouTubeAutomation('warn', 'production_cancelled', logContext, {
        failureStage: `${lastProgress}% ${lastStage}`,
        durationMs: Date.now() - startedAt,
      })
      return
    }
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

function createThrottledCancellationCheck(
  dayId: string,
  logContext: { requestId?: string | null; userId: string; dayId: string },
) {
  let lastCheckedAt = 0
  let cachedCancelled = false
  let inFlight: Promise<boolean> | null = null

  return async () => {
    if (cachedCancelled) return true
    if (Date.now() - lastCheckedAt < 5_000) return false
    if (inFlight) return inFlight

    inFlight = prisma.youTubeAutomationDay.findUnique({
      where: { id: dayId },
      select: { renderCancelRequested: true, status: true },
    }).then(current => {
      lastCheckedAt = Date.now()
      cachedCancelled = !current
        || current.renderCancelRequested
        || !YOUTUBE_PRODUCTION_ACTIVE_STATUSES.includes(current.status as typeof YOUTUBE_PRODUCTION_ACTIVE_STATUSES[number])
      return cachedCancelled
    }).catch(error => {
      lastCheckedAt = Date.now()
      logYouTubeAutomation('warn', 'production_cancel_check_failed', logContext, summarizeYouTubeAutomationError(error))
      return cachedCancelled
    }).finally(() => {
      inFlight = null
    })
    return inFlight
  }
}

function formatProductionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '[external-url]')
    .slice(0, 240)
}

function parseRenderCheckpoint(value: string | null): RenderCheckpoint {
  if (!value) return { version: 1, scenes: [] }
  try {
    const parsed = JSON.parse(value) as RenderCheckpoint
    return parsed && Array.isArray(parsed.scenes) ? parsed : { version: 1, scenes: [] }
  } catch {
    return { version: 1, scenes: [] }
  }
}

function boundedPositiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
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
