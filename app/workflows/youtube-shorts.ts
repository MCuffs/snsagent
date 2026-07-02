const WORKFLOW_FALLBACK_STAGE = 'Workflow 시작 대기 초과 - 서버 fallback 실행 중'

export async function youtubeShortsProductionWorkflow(dayId: string, userId: string, requestId?: string | null) {
  "use workflow"

  await produceYouTubeShortsStep(dayId, userId, requestId)
  return { dayId, status: 'completed' }
}

async function produceYouTubeShortsStep(dayId: string, userId: string, requestId?: string | null) {
  "use step"

  const [{ default: prisma }, { produceYouTubeShorts }] = await Promise.all([
    import('../../lib/db'),
    import('../../src/lib/youtube/produce'),
  ])

  const resumed = await prisma.youTubeAutomationDay.updateMany({
    where: {
      id: dayId,
      userId,
      status: { not: 'completed' },
      renderStage: { not: WORKFLOW_FALLBACK_STAGE },
      renderCancelRequested: false,
    },
    data: {
      status: 'rendering',
      renderStage: '영상 제작 작업 실행 중',
    },
  })
  if (resumed.count === 0) return { skipped: true }

  await produceYouTubeShorts({ dayId, userId, requestId, throwOnFailure: true })
  return { completed: true }
}

produceYouTubeShortsStep.maxRetries = 5
