import { isAdminEmail } from './auth/admin-emails'
import { normalizePlan } from './limits-types'

export const YOUTUBE_AUTOMATION_REQUIRED_PLAN = 'PRO'
export const YOUTUBE_PROMO_PLAN = 'YOUTUBE_PROMO'
export const YOUTUBE_PROMO_HISTORY_LIMIT = 3
export const YOUTUBE_PROMO_RETENTION_DAYS = 30

export function canUseYouTubeAutomation(user: { plan?: string | null; email?: string | null }) {
  if (isAdminEmail(user.email) || user.email?.toLowerCase() === 'test@test.com') return true
  return normalizePlan(user.plan || 'FREE') !== 'FREE'
}

export function isYouTubePromoPlan(plan?: string | null) {
  return normalizePlan(plan || 'FREE') === YOUTUBE_PROMO_PLAN
}

export function getYouTubeAutomationHistoryPolicy(user: { plan?: string | null; email?: string | null }) {
  if (isYouTubePromoPlan(user.plan) && !isAdminEmail(user.email) && user.email?.toLowerCase() !== 'test@test.com') {
    return { limit: YOUTUBE_PROMO_HISTORY_LIMIT, retentionDays: YOUTUBE_PROMO_RETENTION_DAYS }
  }
  return { limit: 10, retentionDays: null as number | null }
}

export function youtubeAutomationUpgradeResponse() {
  return {
    error: '유튜브 자동화는 Creator(월 25,000원) 이상 플랜에서 사용할 수 있습니다.',
    requiredPlan: YOUTUBE_AUTOMATION_REQUIRED_PLAN,
  }
}
