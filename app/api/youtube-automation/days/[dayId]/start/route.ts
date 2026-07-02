import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomationDay, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import { classifyShortsContent, generateDayProductionPlan } from '../../../../../../src/lib/youtube/automation'
import { selectShortsTemplate } from '../../../../../../lib/youtube-shorts-templates/select'
import { selectPlanStrategy } from '../../../../../../lib/youtube-plan-strategies'
import { logYouTubeAutomation, summarizeYouTubeAutomationError } from '../../../../../../src/lib/youtube/logging'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ dayId: string }> }) {
  const startedAt = Date.now()
  const requestId = request.headers.get('x-vercel-id') || request.headers.get('x-request-id')
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const logContext = { requestId, route: '/api/youtube-automation/days/[dayId]/start', userId: user.id, dayId }
  logYouTubeAutomation('info', 'start_request_begin', logContext)
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
    include: { project: true },
  })

  if (!day) {
    logYouTubeAutomation('warn', 'start_request_day_not_found', logContext, { durationMs: Date.now() - startedAt })
    return NextResponse.json({ error: '캘린더 항목을 찾을 수 없습니다.' }, { status: 404 })
  }
  const dayLogContext = { ...logContext, projectId: day.projectId, dayNumber: day.dayNumber, title: day.title }
  if (!canUseYouTubeAutomationDay(user, day.dayNumber)) {
    logYouTubeAutomation('warn', 'start_request_plan_blocked', dayLogContext, { durationMs: Date.now() - startedAt })
    return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  }
  if (day.dayNumber > day.project.currentOpenDay || day.status === 'locked') {
    logYouTubeAutomation('warn', 'start_request_locked_day', dayLogContext, {
      status: day.status,
      currentOpenDay: day.project.currentOpenDay,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ error: '아직 오픈되지 않은 날짜입니다.' }, { status: 403 })
  }

  await prisma.youTubeAutomationDay.update({
    where: { id: day.id },
    data: { status: 'planning' },
  })

  let plan: Awaited<ReturnType<typeof generateDayProductionPlan>>
  let classification: Awaited<ReturnType<typeof classifyShortsContent>> = null
  let selection: Awaited<ReturnType<typeof selectShortsTemplate>>
  let planStrategy: ReturnType<typeof selectPlanStrategy>
  try {
    logYouTubeAutomation('info', 'start_classification_begin', dayLogContext)
    classification = await classifyShortsContent({
      topic: day.project.topic,
      title: day.title,
      userId: user.id,
    })
    logYouTubeAutomation('info', 'start_classification_done', dayLogContext, {
      contentType: classification?.contentType,
      tone: classification?.tone,
      recommendedTemplateKey: classification?.recommendedTemplateKey,
      confidenceScore: classification?.confidenceScore,
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
    logYouTubeAutomation('info', 'start_recent_strategy_loaded', dayLogContext, { recentDayCount: recentDays.length })
    selection = await selectShortsTemplate(
      classification,
      recentDays.flatMap(item => item.selectedTemplateKey ? [item.selectedTemplateKey] : []),
    )
    planStrategy = selectPlanStrategy({
      classification,
      recentKeys: recentDays.flatMap(item => item.selectedPlanStrategyKey ? [item.selectedPlanStrategyKey] : []),
      seed: `${day.projectId}:${day.dayNumber}:${day.title}`,
    })
    logYouTubeAutomation('info', 'start_template_strategy_selected', dayLogContext, {
      templateKey: selection.template.templateKey,
      templateVersion: selection.template.version,
      usedDefaultTemplate: selection.usedDefaultTemplate,
      planStrategyKey: planStrategy.key,
    })
    logYouTubeAutomation('info', 'start_day_plan_begin', dayLogContext)
    plan = await generateDayProductionPlan({
      topic: day.project.topic,
      title: day.title,
      userId: user.id,
      template: selection.template,
      usedDefaultTemplate: selection.usedDefaultTemplate,
      planStrategy,
    })
    logYouTubeAutomation('info', 'start_day_plan_done', dayLogContext, {
      sceneCount: plan.scenes.length,
      sourceClipCount: plan.sourceClips.length,
      usableSourceClipCount: plan.sourceClips.filter(clip => clip.videoUrl).length,
      durationMs: Date.now() - startedAt,
    })
  } catch (error) {
    await prisma.youTubeAutomationDay.update({
      where: { id: day.id },
      data: { status: 'open' },
    }).catch(() => undefined)
    logYouTubeAutomation('error', 'start_request_failed', dayLogContext, {
      durationMs: Date.now() - startedAt,
      ...summarizeYouTubeAutomationError(error),
    })
    return NextResponse.json({
      error: error instanceof Error ? error.message : '제작안 생성에 실패했습니다.',
    }, { status: 500 })
  }

  const updated = await prisma.youTubeAutomationDay.update({
    where: { id: day.id },
    data: {
      status: 'ready',
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
    },
  })
  logYouTubeAutomation('info', 'start_request_complete', dayLogContext, {
    durationMs: Date.now() - startedAt,
    sceneCount: plan.scenes.length,
    sourceClipCount: plan.sourceClips.length,
  })

  return NextResponse.json({
    day: {
      id: updated.id,
      dayNumber: updated.dayNumber,
      title: updated.title,
      status: updated.status,
      script: updated.script,
      description: updated.description,
      tags: plan.tags,
      pinnedComment: updated.pinnedComment,
      scenes: plan.scenes,
      sourceClips: plan.sourceClips,
      ttsProvider: updated.ttsProvider,
      subtitles: plan.subtitles,
      mp4Url: updated.mp4Url,
    },
  })
}
