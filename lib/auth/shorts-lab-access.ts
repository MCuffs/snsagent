import { isAdminEmail } from './admin-emails'

// Shorts Lab은 어드민 전용 베타입니다. 접근 대상은 admin-emails
// (기본 관리자 + SUPER_USER_EMAILS 환경변수)와 동일하게 관리합니다.
export function canAccessShortsLab(email?: string | null) {
  return isAdminEmail(email)
}
