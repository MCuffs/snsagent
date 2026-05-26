import { createHmac, timingSafeEqual } from 'crypto'
import { getSessionSigningSecret, isProduction } from '../env'

export const SESSION_COOKIE_NAME = 'shuffla_session'
export const LEGACY_SESSION_COOKIE_NAME = 'instaagent_session_email'
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = 'google_oauth_state'

export function sessionCookieOptions() {
  return {
    maxAge: 30 * 24 * 60 * 60,
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

export function createSessionToken(email: string) {
  const encodedEmail = Buffer.from(normalizeSessionEmail(email), 'utf8').toString('base64url')
  return `${encodedEmail}.${sign(encodedEmail)}`
}

export function readSessionEmail(token: string | undefined) {
  if (!token) return null

  const [encodedEmail, signature, extra] = token.split('.')
  if (!encodedEmail || !signature || extra) return null

  const expected = Buffer.from(sign(encodedEmail))
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
