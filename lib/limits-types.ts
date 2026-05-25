export type SubscriptionPlan = 'FREE' | 'LITE' | 'PRO' | 'UNLIMITED'

export const SUBSCRIPTION_PLANS = ['FREE', 'LITE', 'PRO', 'UNLIMITED'] as const

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
    name: 'Free',
    monthlyCardLimit: 5,
    hasWatermark: true,
    description: '무료로 시작해 Shuffla를 경험해보세요',
    price: '무료',
  },
  LITE: {
    name: 'Lite',
    monthlyCardLimit: 30,
    hasWatermark: false,
    description: '1인 브랜드와 소상공인을 위한 운영 플랜',
    price: '월 19,000원',
  },
  PRO: {
    name: 'Pro',
    monthlyCardLimit: 100,
    hasWatermark: false,
    description: '적극적으로 콘텐츠를 운영하는 마케터 플랜',
    price: '월 49,000원',
  },
  UNLIMITED: {
    name: 'Unlimited',
    monthlyCardLimit: 9999,
    hasWatermark: false,
    description: '횟수 제한 없이 자유롭게 생성하는 프리미엄 플랜',
    price: '월 99,000원',
  },
}

// Fallback for legacy plan values stored in DB (STARTER → LITE, AGENCY → UNLIMITED)
export function normalizePlan(plan: string): SubscriptionPlan {
  if (plan === 'STARTER') return 'LITE'
  if (plan === 'AGENCY') return 'UNLIMITED'
  if (isSubscriptionPlan(plan)) return plan
  return 'FREE'
}
