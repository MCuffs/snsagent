import { dbService } from './db-service'
import { SubscriptionPlan, PlanFeature, PRICING_PLANS, normalizePlan } from './limits-types'

export type { SubscriptionPlan, PlanFeature }
export { PRICING_PLANS }

/**
 * Checks if user is allowed to generate a new card news this month
 */
export async function checkCampaignCreationLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  const limit = PRICING_PLANS[plan].monthlyCardLimit

  const campaigns = await dbService.getCampaigns(userId)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthlyCampaigns = campaigns.filter(
    c => new Date(c.createdAt).getTime() >= startOfMonth.getTime()
  )

  return {
    allowed: monthlyCampaigns.length < limit,
    current: monthlyCampaigns.length,
    limit,
  }
}

/**
 * Brand count is fixed at 1 for all plans
 */
export async function checkBrandCountLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const brands = await dbService.getBrands(userId)
  return {
    allowed: brands.length < 1,
    current: brands.length,
    limit: 1,
  }
}

/**
 * Checks if watermark should be appended to generated images
 */
export async function hasWatermark(userId: string): Promise<boolean> {
  const user = await dbService.getUser(userId)
  const plan = normalizePlan(user?.plan || 'FREE')
  return PRICING_PLANS[plan].hasWatermark
}
