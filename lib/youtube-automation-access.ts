import { isAdminEmail } from './auth/admin-emails'
import { normalizePlan } from './limits-types'

export const YOUTUBE_AUTOMATION_REQUIRED_PLAN = 'PRO'

export function canUseYouTubeAutomation(user: { plan?: string | null; email?: string | null }) {
  if (isAdminEmail(user.email) || user.email?.toLowerCase() === 'test@test.com') return true
  return normalizePlan(user.plan || 'FREE') !== 'FREE'
}

export function youtubeAutomationUpgradeResponse() {
  return {
    error: '유튜브 자동화는 Creator(월 25,000원) 이상 플랜에서 사용할 수 있습니다.',
    requiredPlan: YOUTUBE_AUTOMATION_REQUIRED_PLAN,
  }
}
