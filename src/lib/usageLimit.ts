import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../lib/limits-types'
import { getCampaignUsagePeriodStart } from '../../lib/usage-period'

const SUPER_USER_EMAILS = ['alstnwjd0424@gmail.com', 'imhs1248@gmail.com', 'kanghiee616@gmail.com']

function isSuperUser(email?: string | null): boolean {
  if (!email) return false
  return SUPER_USER_EMAILS.includes(email.toLowerCase())
}

export async function checkCampaignUsage(userId: string) {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  const campaigns = await dbService.getCampaigns(userId)
  const periodStart = getCampaignUsagePeriodStart(plan)

  const current = campaigns.filter(campaign => campaign.createdAt >= periodStart).length

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current,
      limit: 999999,
      plan: 'UNLIMITED',
      period: 'month' as const,
    }
  }

  const limit = PRICING_PLANS[plan].monthlyCardLimit

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
    period: plan === 'FREE' ? 'day' as const : 'month' as const,
  }
}
