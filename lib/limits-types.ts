export type SubscriptionPlan = 'FREE' | 'LITE' | 'PRO' | 'UNLIMITED'

export const SUBSCRIPTION_PLANS = ['FREE', 'LITE', 'PRO', 'UNLIMITED'] as const
export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['LITE', 'PRO', 'UNLIMITED']

export function isSubscriptionPlan(plan: string): plan is SubscriptionPlan {
  return SUBSCRIPTION_PLANS.includes(plan as SubscriptionPlan)
}

export interface PlanFeature {
  name: string
  monthlyCardLimit: number
  hasWatermark: boolean
  description: string
  price: string
}

export const PRICING_PLANS: Record<SubscriptionPlan, PlanFeature> = {
  FREE: {
    name: 'No Pass',
    monthlyCardLimit: 0,
    hasWatermark: true,
    description: 'Google Login 후 이용권을 선택하세요',
    price: '이용권 없음',
  },
  LITE: {
    name: 'Single',
    monthlyCardLimit: 1,
    hasWatermark: false,
    description: '한 번의 캠페인을 부담 없이 제작하는 입문 플랜',
    price: '월 3,000원',
  },
  PRO: {
    name: 'Creator',
    monthlyCardLimit: 10,
    hasWatermark: false,
    description: '매주 콘텐츠를 제작하는 브랜드 운영 플랜',
    price: '월 19,000원',
  },
  UNLIMITED: {
    name: 'Studio',
    monthlyCardLimit: 30,
    hasWatermark: false,
    description: '다수 캠페인을 운영하는 팀용 제작 플랜',
    price: '월 45,000원',
  },
}

// Fallback for legacy plan values stored in DB (STARTER → LITE, AGENCY → UNLIMITED)
export function normalizePlan(plan: string): SubscriptionPlan {
  if (plan === 'STARTER') return 'LITE'
  if (plan === 'AGENCY') return 'UNLIMITED'
  if (isSubscriptionPlan(plan)) return plan
  return 'FREE'
}
