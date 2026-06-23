export type SubscriptionPlan = 'FREE' | 'PRO' | 'UNLIMITED'

export const SUBSCRIPTION_PLANS = ['FREE', 'PRO', 'UNLIMITED'] as const
export const PAID_SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['PRO', 'UNLIMITED']

export function isSubscriptionPlan(plan: string): plan is SubscriptionPlan {
  return SUBSCRIPTION_PLANS.includes(plan as SubscriptionPlan)
}

export interface PlanFeature {
  name: string
  monthlyCardLimit: number
  monthlyVideoCardLimit: number   // video cardnews generation limit
  historyRetentionDays: number
  hasWatermark: boolean
  description: string
  description_en: string
  price: string
  price_en: string
  features: string[]
  features_en: string[]
}

export const PRICING_PLANS: Record<SubscriptionPlan, PlanFeature> = {
  FREE: {
    name: 'Free',
    monthlyCardLimit: 2,
    monthlyVideoCardLimit: 1,
    historyRetentionDays: 30,
    hasWatermark: true,
    description: '최초 2회 카드뉴스를 생성하는 무료 플랜',
    description_en: 'Create your first 2 card news for free — no payment required.',
    price: '무료',
    price_en: 'Free',
    features: [
      '최초 2회 무료 카드뉴스 생성',
      '영상 카드뉴스 1회 체험',
      '30일 히스토리 보관',
      '기본 편집 기능',
    ],
    features_en: [
      '2 free card news to start',
      '1 video card news trial',
      '30-day history retention',
      'Basic editing tools',
    ],
  },
  PRO: {
    name: 'Creator',
    monthlyCardLimit: 20,
    monthlyVideoCardLimit: 10,
    historyRetentionDays: 90,
    hasWatermark: false,
    description: '평일마다 콘텐츠를 제작하는 브랜드 운영 플랜',
    description_en: 'For brands publishing content regularly — 20 card news per month.',
    price: '월 25,000원',
    price_en: '₩25,000 / mo',
    features: [
      '월 20회 카드뉴스 생성',
      '90일 히스토리 보관',
      '브랜드 URL 분석',
      '상품 참고 이미지 최대 4장',
      'AI 문구·이미지 생성',
      '캠페인별 AI 배경 재생성 1회분',
      '결과 편집 및 다운로드',
    ],
    features_en: [
      '20 card news per month',
      '90-day history retention',
      'Brand URL analysis',
      'Up to 4 product reference images',
      'AI copy and image generation',
      '1 AI background regeneration per campaign',
      'Edit and download results',
    ],
  },
  UNLIMITED: {
    name: 'Studio',
    monthlyCardLimit: 30,
    monthlyVideoCardLimit: 25,
    historyRetentionDays: 365,
    hasWatermark: false,
    description: '다수 캠페인을 운영하는 팀용 제작 플랜',
    description_en: 'For content teams running multiple campaigns — 30 card news per month.',
    price: '월 39,000원',
    price_en: '₩39,000 / mo',
    features: [
      '월 30회 카드뉴스 생성',
      '365일 히스토리 보관',
      '브랜드 URL 분석',
      '상품 참고 이미지 최대 4장',
      'AI 문구·이미지 생성',
      '캠페인별 AI 배경 재생성 1회분',
      '결과 편집 및 다운로드',
    ],
    features_en: [
      '30 card news per month',
      '365-day history retention',
      'Brand URL analysis',
      'Up to 4 product reference images',
      'AI copy and image generation',
      '1 AI background regeneration per campaign',
      'Edit and download results',
    ],
  },
}

// Fallback for legacy plan values stored in DB.
// LITE/STARTER were a discontinued one-time pass → treat as FREE; AGENCY → UNLIMITED.
export function normalizePlan(plan: string): SubscriptionPlan {
  if (plan === 'STARTER' || plan === 'LITE') return 'FREE'
  if (plan === 'AGENCY') return 'UNLIMITED'
  if (isSubscriptionPlan(plan)) return plan
  return 'FREE'
}
