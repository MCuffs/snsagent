import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { isProduction } from '../../../../lib/env'
import { createSessionToken, LEGACY_SESSION_COOKIE_NAME, normalizeSessionEmail, sessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/auth/session'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (isProduction()) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const uniqueEmail = normalizeSessionEmail(`local-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shuffla.local`)
  await dbService.getOrCreateUser(uniqueEmail, 'Local Test User')

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(uniqueEmail), sessionCookieOptions())
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)

  return NextResponse.redirect(new URL('/concept', request.url))
}
