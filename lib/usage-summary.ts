import type { User } from './db-service'
import { dbService } from './db-service'
import { PRICING_PLANS, normalizePlan } from './limits-types'
import { getCampaignUsagePeriodStart } from './usage-period'
import { isAdminEmail } from './auth/admin-emails'

export interface UsageHistoryItem {
  id: string
  title: string
  mediaType: 'image' | 'video'
  createdAt: string
  status: string
}

export interface UsageSummary {
  plan: string
  period: 'month' | 'lifetime'
  image: { used: number; limit: number }
  video: { used: number; limit: number }
  history: UsageHistoryItem[]
}

function isSuperUser(email?: string | null) {
  return isAdminEmail(email) || email?.toLowerCase() === 'test@test.com'
}

export async function getUsageSummaryForUser(user: User): Promise<UsageSummary> {
  const plan = normalizePlan(user.plan || 'FREE')
  const planFeatures = PRICING_PLANS[plan]
  const superUser = isSuperUser(user.email)
  const periodStart = plan === 'FREE' ? null : getCampaignUsagePeriodStart(plan)
  const usage = await dbService.getCampaignUsageSummary(user.id, periodStart)

  return {
    plan: superUser ? 'ADMIN' : plan,
    period: plan === 'FREE' && !superUser ? 'lifetime' : 'month',
    image: {
      used: usage.imageUsed,
      limit: superUser ? 999999 : planFeatures.monthlyCardLimit,
    },
    video: {
      used: usage.videoUsed,
      limit: superUser ? 999999 : planFeatures.monthlyVideoCardLimit,
    },
    history: usage.history.map(campaign => ({
      id: campaign.id,
      title: campaign.title,
      mediaType: campaign.mediaType,
      createdAt: campaign.createdAt.toISOString(),
      status: campaign.status,
    })),
  }
}
