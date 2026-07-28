import { isAdminEmail } from './admin-emails'
import { normalizePlan } from '../limits-types'

// Shorts Lab 노출 정책 (유튜브 자동화 탭과 동일한 구조):
//  - 탭과 화면은 로그인한 모든 유저에게 보입니다.
//  - CC 필터·영상 선택 등 실제 사용은 유료 플랜(월 9,900원)부터 열립니다.

/** 결제 없이 모든 Shorts Lab 기능을 쓰는 지정 계정 */
const FULL_ACCESS_EMAILS = new Set([
  'kanghiee616@gmail.com',
  'imhs1248@gmail.com',
])

/** 탭·화면 노출 여부 — 로그인만 되어 있으면 허용 */
export function canAccessShortsLab(email?: string | null) {
  return Boolean(email)
}

/** 유료 기능(CC 필터·영상 선택·생성) 사용 가능 여부 */
export function hasShortsLabFullAccess(user?: {
  email?: string | null
  plan?: string | null
} | null) {
  if (!user?.email) return false
  const email = user.email.trim().toLowerCase()
  if (isAdminEmail(email) || FULL_ACCESS_EMAILS.has(email)) return true
  return normalizePlan(user.plan || 'FREE') !== 'FREE'
}

export const SHORTS_LAB_REQUIRED_PLAN = 'YOUTUBE_PROMO'

export function shortsLabUpgradeResponse() {
  return {
    error: 'Shorts Lab은 월 9,900원 플랜부터 이용할 수 있습니다.',
    requiredPlan: SHORTS_LAB_REQUIRED_PLAN,
  }
}
