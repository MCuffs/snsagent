import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../actions'
import prisma from '../../../../../../lib/db'
import { canUseYouTubeAutomation, youtubeAutomationUpgradeResponse } from '../../../../../../lib/youtube-automation-access'
import { classifyShortsContent, generateDayProductionPlan } from '../../../../../../src/lib/youtube/automation'
import { selectShortsTemplate } from '../../../../../../lib/youtube-shorts-templates/select'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ dayId: string }> }) {
  const user = await getSessionUser()
  if (user && !canUseYouTubeAutomation(user)) return NextResponse.json(youtubeAutomationUpgradeResponse(), { status: 402 })
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { dayId } = await context.params
  const day = await prisma.youTubeAutomationDay.findFirst({
    where: { id: dayId, userId: user.id },
    include: { project: true },
  })

  if (!day) return NextResponse.json({ error: '캘린더 항목을 찾을 수 없습니다.' }, { status: 404 })
  if (day.dayNumber > day.project.currentOpenDay || day.status === 'locked') {
    return NextResponse.json({ error: '아직 오픈되지 않은 날짜입니다.' }, { status: 403 })
  }

  await prisma.youTubeAutomationDay.update({
    where: { id: day.id },
    data: { status: 'planning' },
  })

  let plan: Awaited<ReturnType<typeof generateDayProductionPlan>>
  let classification: Awaited<ReturnType<typeof classifyShortsContent>> = null
  let selection: Awaited<ReturnType<typeof selectShortsTemplate>>
  try {
    classification = await classifyShortsContent({
      topic: day.project.topic,
      title: day.title,
      userId: user.id,
    })
    selection = await selectShortsTemplate(classification)
    plan = await generateDayProductionPlan({
      topic: day.project.topic,
      title: day.title,
      userId: user.id,
      template: selection.template,
      usedDefaultTemplate: selection.usedDefaultTemplate,
    })
  } catch (error) {
    await prisma.youTubeAutomationDay.update({
      where: { id: day.id },
      data: { status: 'open' },
    }).catch(() => undefined)
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
    },
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
