import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { buildGoogleOAuthUrl, hasGoogleOAuthConfig } from '../../../../../lib/google/oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!hasGoogleOAuthConfig()) {
    return NextResponse.redirect(new URL('/login?error=google_config_missing', request.url))
  }

  const state = crypto.randomBytes(24).toString('base64url')
  const cookieStore = await cookies()
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  })

  return NextResponse.redirect(buildGoogleOAuthUrl({ request, state }))
}
