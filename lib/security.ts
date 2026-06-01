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

export function unauthorizedJson(message = 'Unauthorized') {
  return NextResponse.json({ success: false, error: message }, { status: 401 })
}
