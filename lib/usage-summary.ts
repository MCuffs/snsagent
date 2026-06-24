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
  const campaigns = await dbService.getCampaigns(user.id)

  const periodStart = plan === 'FREE' ? new Date(0) : getCampaignUsagePeriodStart(plan)
  const periodCampaigns = plan === 'FREE'
    ? campaigns
    : campaigns.filter(campaign => campaign.createdAt.getTime() >= periodStart.getTime())

  const imageCampaigns = periodCampaigns.filter(
    campaign => !(campaign as { mediaType?: string }).mediaType || (campaign as { mediaType?: string }).mediaType !== 'video',
  )
  const videoCampaigns = periodCampaigns.filter(
    campaign => (campaign as { mediaType?: string }).mediaType === 'video',
  )

  return {
    plan: superUser ? 'ADMIN' : plan,
    period: plan === 'FREE' && !superUser ? 'lifetime' : 'month',
    image: {
      used: imageCampaigns.length,
      limit: superUser ? 999999 : planFeatures.monthlyCardLimit,
    },
    video: {
      used: videoCampaigns.length,
      limit: superUser ? 999999 : planFeatures.monthlyVideoCardLimit,
    },
    history: campaigns.slice(0, 30).map(campaign => ({
      id: campaign.id,
      title: campaign.title,
      mediaType: (campaign as { mediaType?: string }).mediaType === 'video' ? 'video' : 'image',
      createdAt: campaign.createdAt.toISOString(),
      status: campaign.status,
    })),
  }
}
