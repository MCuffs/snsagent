'use server'

import { dbService } from '../../lib/db-service'
import { getSessionUser, unauthenticated, failed } from './_shared'

// Painter Growth Status Action
export async function getPainterStatusAction(brandId: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const isMock = () => process.env.DATABASE_MOCK === 'true' || !process.env.DATABASE_URL

  try {
    const campaigns = await dbService.getCampaigns(user.id)
    const campaignCount = campaigns.length

    let editLogCount = 0
    if (!isMock()) {
      const { default: prisma } = await import('../../lib/db')
      editLogCount = await prisma.userEditLog.count({
        where: { userId: user.id, brandId }
      })
    } else {
      editLogCount = campaignCount * 4
    }

    const preference = await dbService.getSummarizedPreference(brandId)

    return {
      success: true as const,
      campaignCount,
      editLogCount,
      preference,
    }
  } catch (err) {
    console.error('getPainterStatusAction failed:', err)
    return failed('화가 상태 정보를 불러오지 못했습니다.')
  }
}
