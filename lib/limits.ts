import { dbService } from './db-service'
import { SubscriptionPlan, PlanFeature, PRICING_PLANS } from './limits-types'

export type { SubscriptionPlan, PlanFeature }
export { PRICING_PLANS }


/**
 * Checks if user is allowed to create a new campaign
 */
export async function checkCampaignCreationLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const campaigns = await dbService.getCampaigns(userId)
  
  const user = await dbService.getUser(userId)
  const plan = (user?.plan || 'FREE') as SubscriptionPlan
  const limit = PRICING_PLANS[plan].monthlyCampaignLimit

  // Filter campaigns created this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const monthlyCampaigns = campaigns.filter(
    c => new Date(c.createdAt).getTime() >= startOfMonth.getTime()
  )

  return {
    allowed: monthlyCampaigns.length < limit,
    current: monthlyCampaigns.length,
    limit
  }
}

/**
 * Checks if user is allowed to create a new brand
 */
export async function checkBrandCountLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const brands = await dbService.getBrands(userId)
  const user = await dbService.getUser(userId)
  const plan = (user?.plan || 'FREE') as SubscriptionPlan
  const limit = PRICING_PLANS[plan].brandLimit

  return {
    allowed: brands.length < limit,
    current: brands.length,
    limit
  }
}

/**
 * Checks if user is allowed to schedule/automate posts
 */
export async function canSchedulePost(userId: string): Promise<boolean> {
  const user = await dbService.getUser(userId)
  const plan = (user?.plan || 'FREE') as SubscriptionPlan
  return PRICING_PLANS[plan].canSchedule
}

/**
 * Checks if watermark should be appended to generated images
 */
export async function hasWatermark(userId: string): Promise<boolean> {
  const user = await dbService.getUser(userId)
  const plan = (user?.plan || 'FREE') as SubscriptionPlan
  return PRICING_PLANS[plan].hasWatermark
}
