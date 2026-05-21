export type SubscriptionPlan = 'FREE' | 'STARTER' | 'PRO' | 'AGENCY'

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
    description: 'AI 인턴 체험판 - 월 5회 콘텐츠 기획 및 시안 생성',
    price: '₩0'
  },
  STARTER: {
    name: 'Starter',
    monthlyCampaignLimit: 30,
    brandLimit: 1,
    canSchedule: true,
    hasWatermark: false,
    description: '1인 창업자용 - 월 30회 예약 업로드 지원',
    price: '₩29,000 / 월'
  },
  PRO: {
    name: 'Pro',
    monthlyCampaignLimit: 150,
    brandLimit: 5,
    canSchedule: true,
    hasWatermark: false,
    description: '전문 마케터용 - 월 150회 생성, 5개 브랜드 운영',
    price: '₩79,000 / 월'
  },
  AGENCY: {
    name: 'Agency',
    monthlyCampaignLimit: 9999, // Unlimited for practical purposes
    brandLimit: 9999, // Unlimited
    canSchedule: true,
    hasWatermark: false,
    description: '대행사 및 스튜디오 - 무제한 브랜드 및 자동 연동',
    price: '₩199,000 / 월'
  }
}
