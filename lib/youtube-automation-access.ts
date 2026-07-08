import { isAdminEmail } from './auth/admin-emails'
import { normalizePlan } from './limits-types'

export const YOUTUBE_AUTOMATION_REQUIRED_PLAN = 'YOUTUBE_PROMO'
export const YOUTUBE_PROMO_PLAN = 'YOUTUBE_PROMO'
export const YOUTUBE_PROMO_HISTORY_LIMIT = 3
export const YOUTUBE_PROMO_RETENTION_DAYS = 30
export const YOUTUBE_AUTOMATION_FREE_DAY_LIMIT = 1

// QA/test accounts that bypass plan gating; comma-separated emails, empty by default.
const BYPASS_EMAILS = new Set(
  (process.env.YOUTUBE_TEST_BYPASS_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
)

function isBypassEmail(email?: string | null) {
  return Boolean(email && BYPASS_EMAILS.has(email.toLowerCase()))
}

export function canUseYouTubeAutomation(user: { plan?: string | null; email?: string | null }) {
  if (isAdminEmail(user.email) || isBypassEmail(user.email)) return true
  return normalizePlan(user.plan || 'FREE') !== 'FREE'
}

export function canUseYouTubeAutomationDay(
  user: { plan?: string | null; email?: string | null },
  dayNumber: number,
) {
  if (canUseYouTubeAutomation(user)) return true
  return dayNumber <= YOUTUBE_AUTOMATION_FREE_DAY_LIMIT
}

export function isYouTubeAutomationUpgradeLockedDay(
  user: { plan?: string | null; email?: string | null },
  dayNumber: number,
) {
  return !canUseYouTubeAutomationDay(user, dayNumber)
}

export function isYouTubePromoPlan(plan?: string | null) {
  return normalizePlan(plan || 'FREE') === YOUTUBE_PROMO_PLAN
}

export function getYouTubeAutomationHistoryPolicy(user: { plan?: string | null; email?: string | null }) {
  if (isYouTubePromoPlan(user.plan) && !isAdminEmail(user.email) && !isBypassEmail(user.email)) {
    return { limit: YOUTUBE_PROMO_HISTORY_LIMIT, retentionDays: YOUTUBE_PROMO_RETENTION_DAYS }
  }
  return { limit: 10, retentionDays: null as number | null }
}

export function youtubeAutomationUpgradeResponse() {
  return {
    error: 'Day 1은 무료로 제작할 수 있습니다. Day 2부터는 YouTube Promo(월 9,900원) 이상 플랜 업그레이드가 필요합니다.',
    requiredPlan: YOUTUBE_AUTOMATION_REQUIRED_PLAN,
  }
}
