import prisma from '../../../../lib/db'
import { produceYouTubeShorts } from '../../youtube/produce'
import { inngest } from '../client'

export const produceYouTubeShortsFunction = inngest.createFunction(
  {
    id: 'produce-youtube-shorts',
    name: 'Produce YouTube Shorts',
    triggers: [{ event: 'youtube/shorts.render.requested' }],
    concurrency: 2,
    retries: 2,
    timeouts: {
      start: '15m',
      finish: '12m',
    },
  },
  async ({ event, step }) => {
    const { dayId, userId } = event.data as { dayId: string; userId: string }
    const day = await step.run('validate-render-request', async () => {
      return prisma.youTubeAutomationDay.findFirst({
        where: { id: dayId, userId },
        select: { id: true, status: true, renderCancelRequested: true },
      })
    })
    if (!day || day.renderCancelRequested || !['planning', 'rendering'].includes(day.status)) {
      return { skipped: true, reason: 'render request is no longer active' }
    }

    await step.run('produce-video', async () => {
      await produceYouTubeShorts({ dayId, userId, throwOnFailure: true })
    })
    return { completed: true, dayId }
  },
)
