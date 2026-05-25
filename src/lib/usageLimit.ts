import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../lib/limits-types'

export async function checkMonthlyCampaignUsage(userId: string) {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  const limit = PRICING_PLANS[plan].monthlyCardLimit
  const campaigns = await dbService.getCampaigns(userId)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const current = campaigns.filter(campaign => campaign.createdAt >= startOfMonth).length

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
  }
}
