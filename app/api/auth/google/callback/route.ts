import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { dbService } from '../../../../../lib/db-service'
import { exchangeGoogleCode, fetchGoogleUserInfo } from '../../../../../lib/google/oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
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
    const expectedState = cookieStore.get('google_oauth_state')?.value
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(new URL('/login?error=google_state_invalid', request.url))
    }

    const token = await exchangeGoogleCode(request, code)
    const profile = await fetchGoogleUserInfo(token.access_token)
    await dbService.getOrCreateUser(profile.email, profile.name || profile.email.split('@')[0])

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.delete('google_oauth_state')
    response.cookies.set('instaagent_session_email', profile.email, {
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })

    return response
  } catch (err) {
    console.error('Google OAuth callback failed:', err)
    return NextResponse.redirect(new URL('/login?error=google_oauth_failed', request.url))
  }
}
