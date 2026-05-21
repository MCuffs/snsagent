export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'

export const SUBSCRIPTION_PLANS = ['FREE', 'STARTER', 'PRO', 'AGENCY'] as const

export function isSubscriptionPlan(plan: string): plan is SubscriptionPlan {
  return SUBSCRIPTION_PLANS.includes(plan as SubscriptionPlan)
}

export interface PlanFeature {
  name: string
  monthlyCampaignLimit: number
  brandLimit: number
  canSchedule: boolean
  hasWatermark: boolean
  description: string
  price: string
}

export const PRICING_PLANS: Record<SubscriptionPlan, PlanFeature> = {
  FREE: {
    name: 'Free',
    monthlyCampaignLimit: 5,
    brandLimit: 1,
    canSchedule: false,
    hasWatermark: true,
    description: '데모와 초기 검증을 위한 기본 플랜',
    price: '무료',
  },
  STARTER: {
    name: 'Starter',
    monthlyCampaignLimit: 30,
    brandLimit: 1,
    canSchedule: true,
    hasWatermark: false,
    description: '1인 브랜드와 소상공인을 위한 운영 플랜',
    price: '월 29,000원',
  },
  PRO: {
    name: 'Pro',
    monthlyCampaignLimit: 150,
    brandLimit: 5,
    canSchedule: true,
    hasWatermark: false,
    description: '여러 캠페인을 반복 운영하는 성장형 플랜',
    price: '월 79,000원',
  },
  AGENCY: {
    name: 'Agency',
    monthlyCampaignLimit: 9999,
    brandLimit: 9999,
    canSchedule: true,
    hasWatermark: false,
    description: '다수 브랜드를 관리하는 팀과 대행사용 플랜',
    price: '월 199,000원',
  },
}
