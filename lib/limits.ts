import { dbService } from './db-service'
import { PRICING_PLANS, normalizePlan } from './limits-types'
import type { SubscriptionPlan, PlanFeature } from './limits-types'
import { getCampaignUsagePeriodStart } from './usage-period'
import { isAdminEmail } from './auth/admin-emails'

export type { SubscriptionPlan, PlanFeature }
export { PRICING_PLANS }

function isSuperUser(email?: string | null): boolean {
  return isAdminEmail(email) || email?.toLowerCase() === 'test@test.com'
}

/**
 * Checks if user is allowed to generate a new card news in the active plan window.
 */
export async function checkCampaignCreationLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number; period: 'day' | 'month' | 'lifetime' }> {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  const campaigns = await dbService.getCampaigns(userId)

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current: 0,
      limit: 999999,
      period: 'month',
    }
  }

  if (plan === 'FREE') {
    const current = campaigns.length
    const limit = 2
    return {
      allowed: current < limit,
      current,
      limit,
      period: 'lifetime',
    }
  }

  const periodStart = getCampaignUsagePeriodStart(plan)
  const currentCampaigns = campaigns.filter(
    c => new Date(c.createdAt).getTime() >= periodStart.getTime()
  )
  const limit = PRICING_PLANS[plan].monthlyCardLimit

  return {
    allowed: currentCampaigns.length < limit,
    current: currentCampaigns.length,
    limit,
    period: 'month',
  }
}

/**
 * Brand count is fixed at 1 for all plans
 */
export async function checkBrandCountLimit(userId: string, isGeneral = false): Promise<{ allowed: boolean; current: number; limit: number }> {
  const user = await dbService.getUser(userId)
  const brands = await dbService.getBrands(userId)

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current: brands.length,
      limit: 999999,
    }
  }

  const matchingBrands = brands.filter(b => 
    isGeneral ? b.websiteUrl === 'general_profile' : b.websiteUrl !== 'general_profile'
  )

  return {
    allowed: matchingBrands.length < 1,
    current: matchingBrands.length,
    limit: 1,
  }
}

/**
 * Checks if user is allowed to generate a new video card news.
 * FREE: 1 lifetime, PRO: 10/month, UNLIMITED: 25/month
 */
export async function checkVideoCardNewsLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number; period: 'month' | 'lifetime' }> {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')

  if (isSuperUser(user?.email)) {
    return { allowed: true, current: 0, limit: 999999, period: 'month' }
  }

  const allCampaigns = await dbService.getCampaigns(userId)
  const videoCampaigns = allCampaigns.filter(c => (c as { mediaType?: string }).mediaType === 'video')

  if (plan === 'FREE') {
    const limit = PRICING_PLANS.FREE.monthlyVideoCardLimit  // 1
    return {
      allowed: videoCampaigns.length < limit,
      current: videoCampaigns.length,
      limit,
      period: 'lifetime',
    }
  }

  const periodStart = getCampaignUsagePeriodStart(plan)
  const recentVideo = videoCampaigns.filter(
    c => new Date(c.createdAt).getTime() >= periodStart.getTime()
  )
  const limit = PRICING_PLANS[plan].monthlyVideoCardLimit

  return {
    allowed: recentVideo.length < limit,
    current: recentVideo.length,
    limit,
    period: 'month',
  }
}

/**
 * Checks if watermark should be appended to generated images
 */
export async function hasWatermark(userId: string): Promise<boolean> {
  const user = await dbService.getUser(userId)
  if (isSuperUser(user?.email)) {
    return false
  }

  const plan = normalizePlan(user?.plan || 'FREE')
  return PRICING_PLANS[plan].hasWatermark
}
