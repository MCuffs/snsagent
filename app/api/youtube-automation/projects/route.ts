import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import prisma from '../../../../lib/db'
import {
  getYouTubeAutomationHistoryPolicy,
  isYouTubeAutomationUpgradeLockedDay,
} from '../../../../lib/youtube-automation-access'
import { generateThirtyDayPlanner } from '../../../../src/lib/youtube/automation'
import { pickRandomTtsVoice } from '../../../../src/lib/youtube/ttsVoice'
import { isYouTubeDayUnlockDue } from '../../../../lib/youtube-automation-schedule'
import {
  YOUTUBE_CANCEL_SETTLE_MS,
  YOUTUBE_PRODUCTION_ACTIVE_STATUSES,
  YOUTUBE_PRODUCTION_STALE_MS,
} from '../../../../lib/youtube-automation-production-state'
import { logYouTubeAutomation } from '../../../../src/lib/youtube/logging'

export const runtime = 'nodejs'

function serializeProject(project: Record<string, unknown>, user?: { plan?: string | null; email?: string | null }) {
  const days = Array.isArray(project.days) ? project.days as Record<string, unknown>[] : []
  return {
    id: project.id,
    topic: project.topic,
    status: project.status,
    currentOpenDay: project.currentOpenDay,
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    days: days
      .sort((a, b) => Number(a.dayNumber) - Number(b.dayNumber))
      .map(day => ({
        id: day.id,
        dayNumber: day.dayNumber,
        requiresUpgrade: user ? isYouTubeAutomationUpgradeLockedDay(user, Number(day.dayNumber)) : false,
        scheduledDate: day.scheduledDate instanceof Date ? day.scheduledDate.toISOString() : day.scheduledDate,
        title: day.title,
        status: day.status,
        script: day.script,
        description: day.description,
        tags: safeJsonArray(day.tagsJson),
        pinnedComment: day.pinnedComment,
        scenes: safeJsonArray(day.scenesJson),
        sourceClips: safeJsonArray(day.sourceClipsJson),
        ttsProvider: day.ttsProvider,
        ttsAudioUrl: day.ttsAudioUrl,
        subtitles: safeJsonArray(day.subtitleJson),
        mp4Url: day.mp4Url,
        renderProgress: day.renderProgress,
        renderStage: day.renderStage,
        renderCancelRequested: day.renderCancelRequested,
        qualityNotes: safeJsonArray(day.qualityNotesJson),
        uploadedAt: day.uploadedAt instanceof Date ? day.uploadedAt.toISOString() : day.uploadedAt,
        completedAt: day.status === 'completed'
          ? day.updatedAt instanceof Date ? day.updatedAt.toISOString() : day.updatedAt
          : null,
      })),
  }
}

function safeJsonArray(value: unknown) {
  if (typeof value !== 'string' || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function retentionCutoff(retentionDays: number | null) {
  if (!retentionDays) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  return cutoff
}

async function pruneExpiredProjects(userId: string, retentionDays: number | null) {
  const cutoff = retentionCutoff(retentionDays)
  if (!cutoff) return
  await prisma.youTubeAutomationProject.deleteMany({
    where: {
      userId,
      createdAt: { lt: cutoff },
    },
  })
}

async function recoverStaleProductions(userId: string) {
  const staleBefore = new Date(Date.now() - YOUTUBE_PRODUCTION_STALE_MS)
  const cancelSettledBefore = new Date(Date.now() - YOUTUBE_CANCEL_SETTLE_MS)
  const activeCancelResult = await prisma.youTubeAutomationDay.updateMany({
    where: {
      userId,
      status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      renderCancelRequested: true,
      updatedAt: { lt: cancelSettledBefore },
    },
    data: {
      status: 'ready',
      renderProgress: 0,
      renderStage: '영상 제작 중단됨',
      renderCancelRequested: false,
    },
  })
  if (activeCancelResult.count > 0) {
    logYouTubeAutomation('warn', 'active_cancel_productions_settled', { userId }, {
      count: activeCancelResult.count,
      settleMs: YOUTUBE_CANCEL_SETTLE_MS,
    })
  }

  const staleResult = await prisma.youTubeAutomationDay.updateMany({
    where: {
      userId,
      status: { in: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      renderCancelRequested: false,
      updatedAt: { lt: staleBefore },
    },
    data: {
      status: 'failed',
      renderProgress: 0,
      renderStage: '영상 제작 시간이 초과되었습니다. 다시 시도해 주세요.',
      renderCancelRequested: false,
    },
  })
  if (staleResult.count > 0) {
    logYouTubeAutomation('warn', 'stale_productions_recovered', { userId }, {
      count: staleResult.count,
      staleMs: YOUTUBE_PRODUCTION_STALE_MS,
    })
  }

  const cancelResult = await prisma.youTubeAutomationDay.updateMany({
    where: {
      userId,
      status: { notIn: [...YOUTUBE_PRODUCTION_ACTIVE_STATUSES] },
      renderCancelRequested: true,
      updatedAt: { lt: cancelSettledBefore },
    },
    data: {
      renderCancelRequested: false,
      renderProgress: 0,
      renderStage: '영상 제작 중단됨',
    },
  })
  if (cancelResult.count > 0) {
    logYouTubeAutomation('warn', 'settled_cancel_flags_cleared', { userId }, {
      count: cancelResult.count,
      settleMs: YOUTUBE_CANCEL_SETTLE_MS,
    })
  }
}

async function unlockEligibleProjectDays(projects: Array<Record<string, unknown>>) {
  const now = new Date()

  for (const project of projects) {
    const days = Array.isArray(project.days) ? project.days as Array<Record<string, unknown>> : []
    const currentOpenDay = Number(project.currentOpenDay)
    const currentDay = days.find(day => Number(day.dayNumber) === currentOpenDay)
    const completedAt = currentDay?.updatedAt

    if (
      currentOpenDay >= 30 ||
      currentDay?.status !== 'completed' ||
      !(completedAt instanceof Date) ||
      !isYouTubeDayUnlockDue(completedAt, now)
    ) {
      continue
    }

    const nextOpenDay = currentOpenDay + 1
    await prisma.$transaction([
      prisma.youTubeAutomationProject.update({
        where: { id: String(project.id) },
        data: { currentOpenDay: nextOpenDay, status: 'in_progress' },
      }),
      prisma.youTubeAutomationDay.updateMany({
        where: { projectId: String(project.id), dayNumber: nextOpenDay, status: 'locked' },
        data: { status: 'open' },
      }),
    ])

    project.currentOpenDay = nextOpenDay
    const nextDay = days.find(day => Number(day.dayNumber) === nextOpenDay)
    if (nextDay?.status === 'locked') nextDay.status = 'open'
  }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const policy = getYouTubeAutomationHistoryPolicy(user)
  const cutoff = retentionCutoff(policy.retentionDays)
  await pruneExpiredProjects(user.id, policy.retentionDays)
  await recoverStaleProductions(user.id)

  const projects = await prisma.youTubeAutomationProject.findMany({
    where: {
      userId: user.id,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: policy.limit,
    include: { days: true },
  })
  await unlockEligibleProjectDays(projects)

  return NextResponse.json({ projects: projects.map(project => serializeProject(project, user)), historyPolicy: policy })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const policy = getYouTubeAutomationHistoryPolicy(user)
  const cutoff = retentionCutoff(policy.retentionDays)
  await pruneExpiredProjects(user.id, policy.retentionDays)

  const currentProjectCount = await prisma.youTubeAutomationProject.count({
    where: {
      userId: user.id,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    },
  })
  if (policy.retentionDays && currentProjectCount >= policy.limit) {
    return NextResponse.json({
      error: `프로모션 플랜은 최근 ${policy.retentionDays}일 동안 작업 히스토리를 최대 ${policy.limit}개까지 저장할 수 있습니다. 기존 작업을 삭제한 뒤 다시 시도해 주세요.`,
      historyLimit: policy.limit,
      retentionDays: policy.retentionDays,
    }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as { topic?: string } | null
  const topic = body?.topic?.trim()
  if (!topic) return NextResponse.json({ error: '주제를 입력해 주세요.' }, { status: 400 })

  const planner = await generateThirtyDayPlanner(topic, user.id)
  const start = new Date()
  start.setHours(9, 0, 0, 0)

  const project = await prisma.youTubeAutomationProject.create({
    data: {
      userId: user.id,
      topic,
      status: 'planned',
      currentOpenDay: 1,
      planJson: JSON.stringify({ source: 'topic', topic }),
      ttsVoice: pickRandomTtsVoice(),
      days: {
        create: planner.map(day => {
          const scheduledDate = new Date(start)
          scheduledDate.setDate(start.getDate() + day.dayNumber - 1)
          return {
            userId: user.id,
            dayNumber: day.dayNumber,
            scheduledDate,
            title: day.title,
            status: day.dayNumber === 1 ? 'open' : 'locked',
          }
        }),
      },
    },
    include: { days: true },
  })

  return NextResponse.json({ project: serializeProject(project, user) })
}

export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '濡쒓렇?몄씠 ?꾩슂?⑸땲??' }, { status: 401 })

  const body = await request.json().catch(() => null) as { projectId?: string } | null
  const projectId = body?.projectId?.trim()
  if (!projectId) return NextResponse.json({ error: '삭제할 작업 ID가 없습니다.' }, { status: 400 })

  const result = await prisma.youTubeAutomationProject.deleteMany({
    where: {
      id: projectId,
      userId: user.id,
    },
  })

  if (result.count === 0) {
    return NextResponse.json({ error: '삭제할 작업을 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, projectId })
}
