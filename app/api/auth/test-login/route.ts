import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { normalizeSessionEmail, sessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/auth/session'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const uniqueEmail = normalizeSessionEmail(`local-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shuffla.local`)
  await dbService.getOrCreateUser(uniqueEmail, 'Local Test User')

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, uniqueEmail, sessionCookieOptions())

  return NextResponse.redirect(new URL('/brand', request.url))
}
