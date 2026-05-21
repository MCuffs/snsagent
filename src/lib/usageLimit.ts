import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, type SubscriptionPlan } from '../../lib/limits-types'

export async function checkMonthlyCampaignUsage(userId: string) {
  const user = await dbService.getUser(userId)
  const plan = (user?.plan || 'FREE') as SubscriptionPlan
  const limit = PRICING_PLANS[plan].monthlyCampaignLimit
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
