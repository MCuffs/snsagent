import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { getNicepayReturnTokenSecret } from './env'
import { isPaidPlan, PaidPlan } from './nicepay'


const TOKEN_TTL_MS = 60 * 60 * 1000

export interface NicepayReturnTokenPayload {
  userId: string
  plan: PaidPlan
  expiresAt: number
  encryptionKey: string
}

export function createNicepayReturnToken(userId: string, plan: PaidPlan, now = Date.now()) {
  const encryptionKey = randomBytes(32).toString('base64')
  const payload = {
    userId,
    plan,
    expiresAt: now + TOKEN_TTL_MS,
    encryptionKey,
  } satisfies NicepayReturnTokenPayload
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function readNicepayReturnToken(token: string | null | undefined, now = Date.now()) {
  if (!token) return null

  const [encoded, signature, extra] = token.split('.')
  if (!encoded || !signature || extra) return null

  const expected = Buffer.from(sign(encoded))
  const provided = Buffer.from(signature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<NicepayReturnTokenPayload>
    const expiresAt = payload.expiresAt
    if (!payload.userId || !isPaidPlan(payload.plan ?? null)) return null
    if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return null
    return payload as NicepayReturnTokenPayload
  } catch {
    return null
  }
}

function sign(payload: string) {
  return createHmac('sha256', getNicepayReturnTokenSecret()).update(payload).digest('base64url')
}
