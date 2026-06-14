import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSessionToken, GOOGLE_OAUTH_STATE_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME, normalizeSessionEmail, SESSION_COOKIE_NAME, sessionCookieOptions } from '../../../../../lib/auth/session'
import { dbService } from '../../../../../lib/db-service'
import { exchangeGoogleCode, fetchGoogleUserInfo } from '../../../../../lib/google/oauth'
import { saveErrorLog } from '../../../../../lib/errorLogger'
import { isLikelyDatabaseConnectionError } from '../../../../../lib/runtime-diagnostics'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../../lib/rateLimiter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') || '127.0.0.1'
  const rl = await checkRateLimit(`rate_limit:auth:${ip}`, RATE_LIMIT_PRESETS.auth)
  if (rl.limited) {
    return NextResponse.redirect(new URL('/login?error=too_many_requests', request.url))
  }

  const requestUrl = new URL(request.url)

  try {
    const error = requestUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url))
    }

    const code = requestUrl.searchParams.get('code')
    const state = requestUrl.searchParams.get('state')
    if (!code || !state) {
      return NextResponse.redirect(new URL('/login?error=google_callback_invalid', request.url))
    }

    const cookieStore = await cookies()
    const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(new URL('/login?error=google_state_invalid', request.url))
    }

    const token = await exchangeGoogleCode(request, code)
    const profile = await fetchGoogleUserInfo(token.access_token)
    const email = normalizeSessionEmail(profile.email)
    const user = await dbService.getOrCreateUser(email, profile.name || email.split('@')[0])
    if (user.accountStatus && user.accountStatus !== 'active') {
      return NextResponse.redirect(new URL('/login?error=account_blocked', request.url))
    }

    const response = NextResponse.redirect(new URL('/concept', request.url))
    response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME)
    response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(email), sessionCookieOptions())
    response.cookies.delete(LEGACY_SESSION_COOKIE_NAME)

    return response
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    await saveErrorLog(null, 'google_oauth_callback', err)
    if (isLikelyDatabaseConnectionError(err)) {
      return NextResponse.redirect(new URL('/login?error=database_unavailable', request.url))
    }
    return NextResponse.redirect(new URL('/login?error=google_oauth_failed', request.url))
  }
}
