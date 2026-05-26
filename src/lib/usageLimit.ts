import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../lib/limits-types'

const SUPER_USER_EMAIL = 'alstnwjd0424@gmail.com'

export async function checkMonthlyCampaignUsage(userId: string) {
  const user = await dbService.getUser(userId)
  const campaigns = await dbService.getCampaigns(userId)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const current = campaigns.filter(campaign => campaign.createdAt >= startOfMonth).length

  if (user?.email === SUPER_USER_EMAIL) {
    return {
      allowed: true,
      current,
      limit: 999999,
      plan: 'UNLIMITED',
    }
  }

  const plan = normalizePlan(user?.plan || 'FREE')
  const limit = PRICING_PLANS[plan].monthlyCardLimit

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
  }
}
