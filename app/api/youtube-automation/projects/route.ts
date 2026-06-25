import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import prisma from '../../../../lib/db'
import { generateThirtyDayPlanner } from '../../../../src/lib/youtube/automation'

export const runtime = 'nodejs'

function serializeProject(project: Record<string, unknown>) {
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
        uploadedAt: day.uploadedAt instanceof Date ? day.uploadedAt.toISOString() : day.uploadedAt,
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

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const projects = await prisma.youTubeAutomationProject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { days: true },
  })

  return NextResponse.json({ projects: projects.map(serializeProject) })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

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

  return NextResponse.json({ project: serializeProject(project) })
}
