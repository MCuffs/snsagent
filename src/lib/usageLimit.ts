import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../lib/limits-types'
import { getCampaignUsagePeriodStart } from '../../lib/usage-period'
import { isAdminEmail } from '../../lib/auth/admin-emails'

function isSuperUser(email?: string | null): boolean {
  return isAdminEmail(email)
}

export async function checkCampaignUsage(userId: string) {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  const campaigns = await dbService.getCampaigns(userId)

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current: 0,
      limit: 999999,
      plan: 'UNLIMITED',
      period: 'month' as const,
    }
  }

  if (plan === 'FREE') {
    const current = campaigns.length
    const limit = 2
    return {
      allowed: current < limit,
      current,
      limit,
      plan,
      period: 'lifetime' as const,
    }
  }

  const periodStart = getCampaignUsagePeriodStart(plan)
  const current = campaigns.filter(campaign => campaign.createdAt >= periodStart).length
  const limit = PRICING_PLANS[plan].monthlyCardLimit

  return {
    allowed: current < limit,
    current,
    limit,
    plan,
    period: 'month' as const,
  }
}
