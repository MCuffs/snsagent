import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

export function verifyBearerSecret(authorization: string | null, expectedSecret: string | undefined) {
  const expected = expectedSecret?.trim()
  if (!expected) return false
  if (!authorization?.startsWith('Bearer ')) return false

  const provided = authorization.slice('Bearer '.length).trim()
  if (!provided) return false

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Verify request secret via Authorization: Bearer header (default).
 * URL query parameter fallback is disabled by default to prevent secret leakage in logs.
 * Set WEBHOOK_ALLOW_QUERY_SECRET=true to enable query parameter authentication
 * (only for providers that don't support custom headers, e.g., NicePay).
 */
export function verifyRequestSecret(request: Request, expectedSecret: string | undefined) {
  if (verifyBearerSecret(request.headers.get('authorization'), expectedSecret)) return true

  // URL query parameter fallback — opt-in only
  if (process.env.WEBHOOK_ALLOW_QUERY_SECRET !== 'true') return false

  const expected = expectedSecret?.trim()
  if (!expected) return false

  const provided = new URL(request.url).searchParams.get('secret')?.trim()
  if (!provided) return false

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

export function unauthorizedJson(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}
