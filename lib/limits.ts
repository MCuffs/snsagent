import { dbService } from './db-service'
import { SubscriptionPlan, PlanFeature, PRICING_PLANS, normalizePlan } from './limits-types'

export type { SubscriptionPlan, PlanFeature }
export { PRICING_PLANS }

const SUPER_USER_EMAILS = ['alstnwjd0424@gmail.com', 'imhs1248@gmail.com']

function isSuperUser(email?: string | null): boolean {
  if (!email) return false
  return SUPER_USER_EMAILS.includes(email.toLowerCase())
}

/**
 * Checks if user is allowed to generate a new card news this month
 */
export async function checkCampaignCreationLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const user = await dbService.getUser(userId)
  
  const campaigns = await dbService.getCampaigns(userId)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const monthlyCampaigns = campaigns.filter(
    c => new Date(c.createdAt).getTime() >= startOfMonth.getTime()
  )

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current: monthlyCampaigns.length,
      limit: 999999,
    }
  }

  const plan = normalizePlan(user?.plan || 'FREE')
  const limit = PRICING_PLANS[plan].monthlyCardLimit

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
  const user = await dbService.getUser(userId)
  const brands = await dbService.getBrands(userId)

  if (isSuperUser(user?.email)) {
    return {
      allowed: true,
      current: brands.length,
      limit: 999999,
    }
  }

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
  if (isSuperUser(user?.email)) {
    return false
  }

  const plan = normalizePlan(user?.plan || 'FREE')
  return PRICING_PLANS[plan].hasWatermark
}
