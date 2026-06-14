import { createHmac, timingSafeEqual } from 'crypto'
import { getSessionSigningSecret, isProduction } from '../env'

export const SESSION_COOKIE_NAME = 'shuffla_session'
export const LEGACY_SESSION_COOKIE_NAME = 'instaagent_session_email'
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state'
// 토큰 자체의 절대 만료 시간 (1시간). 로그인 후 경과 시간 기준.
export const SESSION_DURATION_SECONDS = 60 * 60 // 1 hour

export function sessionCookieOptions() {
  // maxAge를 의도적으로 빼서 "세션 쿠키"로 만든다.
  // → 브라우저(탭 전체) 종료 시 쿠키가 자동 삭제되어 세션이 끊긴다.
  // 토큰 내부 expiresAt은 SESSION_DURATION_SECONDS(1시간)로 여전히 강제되므로,
  // 브라우저를 닫지 않아도 1시간이 지나면 무효화된다.
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
  }
}

export function oauthStateCookieOptions() {
  return {
    maxAge: 10 * 60,
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
  }
}

export function normalizeSessionEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createSessionToken(email: string, createdAt = Date.now()) {
  const encodedEmail = Buffer.from(normalizeSessionEmail(email), 'utf8').toString('base64url')
  const expiresAt = createdAt + SESSION_DURATION_SECONDS * 1000
  const payload = `${encodedEmail}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function readSessionEmail(token: string | undefined, now = Date.now()) {
  if (!token) return null

  const [encodedEmail, expiresAtText, signature, extra] = token.split('.')
  if (!encodedEmail || !expiresAtText || !signature || extra) return null

  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null

  const expected = Buffer.from(sign(`${encodedEmail}.${expiresAtText}`))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }

  try {
    const email = Buffer.from(encodedEmail, 'base64url').toString('utf8')
    const normalizedEmail = normalizeSessionEmail(email)
    return normalizedEmail.includes('@') ? normalizedEmail : null
  } catch {
    return null
  }
}

function sign(payload: string) {
  return createHmac('sha256', getSessionSigningSecret()).update(payload).digest('base64url')
}
