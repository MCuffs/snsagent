import { isProduction } from '../env'

export const SESSION_COOKIE_NAME = 'instaagent_session_email'
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
