import { dbService } from '../../lib/db-service'
import { PRICING_PLANS, normalizePlan } from '../../lib/limits-types'
import { getCampaignUsagePeriodStart } from '../../lib/usage-period'

const SUPER_USER_EMAILS = (process.env.SUPER_USER_EMAILS || 'alstnwjd0424@gmail.com,imhs1248@gmail.com,kanghiee616@gmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

function isSuperUser(email?: string | null): boolean {
  if (!email) return false
  return SUPER_USER_EMAILS.includes(email.toLowerCase())
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
