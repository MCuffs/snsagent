import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { GOOGLE_OAUTH_STATE_COOKIE_NAME, oauthStateCookieOptions } from '../../../../../lib/auth/session'
import { buildGoogleOAuthUrl, hasGoogleOAuthConfig } from '../../../../../lib/google/oauth'
import { getGoogleOAuthSetupHint } from '../../../../../lib/runtime-diagnostics'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../../lib/rateLimiter'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') || '127.0.0.1'
  const rl = await checkRateLimit(`rate_limit:auth:${ip}`, RATE_LIMIT_PRESETS.auth)
  if (rl.limited) {
    return NextResponse.redirect(new URL('/login?error=too_many_requests', request.url))
  }

  if (!hasGoogleOAuthConfig()) {
    console.error('[Google OAuth] Missing local configuration.', getGoogleOAuthSetupHint())
    return NextResponse.redirect(new URL('/login?error=google_config_missing', request.url))
  }

  const state = crypto.randomBytes(24).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, oauthStateCookieOptions())

  return NextResponse.redirect(buildGoogleOAuthUrl({ request, state }))
}
