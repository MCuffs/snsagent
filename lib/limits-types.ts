export type SubscriptionPlan = 'FREE' | 'LITE' | 'PRO' | 'UNLIMITED'

export const SUBSCRIPTION_PLANS = ['FREE', 'LITE', 'PRO', 'UNLIMITED'] as const
export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['PRO', 'UNLIMITED']

export function isSubscriptionPlan(plan: string): plan is SubscriptionPlan {
  return SUBSCRIPTION_PLANS.includes(plan as SubscriptionPlan)
}

export interface PlanFeature {
  name: string
  monthlyCardLimit: number
  historyRetentionDays: number
  hasWatermark: boolean
  description: string
  description_en: string
  price: string
  price_en: string
}

export const PRICING_PLANS: Record<SubscriptionPlan, PlanFeature> = {
  FREE: {
    name: 'Free',
    monthlyCardLimit: 2,
    historyRetentionDays: 30,
    hasWatermark: true,
    description: '최초 2회 카드뉴스를 생성하는 무료 플랜',
    description_en: 'Create your first 2 card news for free — no payment required.',
    price: '무료',
    price_en: 'Free',
  },
  LITE: {
    name: 'AI 재생성 1회권',
    monthlyCardLimit: 0,
    historyRetentionDays: 30,
    hasWatermark: false,
    description: '무료 결과물의 AI 재생성을 한 번 추가하는 단건 이용권',
    description_en: 'Add one AI background regeneration to your existing result.',
    price: '3,000원',
    price_en: '₩3,000',
  },
  PRO: {
    name: 'Creator',
    monthlyCardLimit: 20,
    historyRetentionDays: 90,
    hasWatermark: false,
    description: '평일마다 콘텐츠를 제작하는 브랜드 운영 플랜',
    description_en: 'For brands publishing content regularly — 20 card news per month.',
    price: '월 25,000원',
    price_en: '₩25,000 / mo',
  },
  UNLIMITED: {
    name: 'Studio',
    monthlyCardLimit: 30,
    historyRetentionDays: 365,
    hasWatermark: false,
    description: '다수 캠페인을 운영하는 팀용 제작 플랜',
    description_en: 'For content teams running multiple campaigns — 30 card news per month.',
    price: '월 39,000원',
    price_en: '₩39,000 / mo',
  },
}

// Fallback for legacy plan values stored in DB (STARTER → LITE, AGENCY → UNLIMITED)
export function normalizePlan(plan: string): SubscriptionPlan {
  if (plan === 'STARTER') return 'LITE'
  if (plan === 'AGENCY') return 'UNLIMITED'
  if (isSubscriptionPlan(plan)) return plan
  return 'FREE'
}
