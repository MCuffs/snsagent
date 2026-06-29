const POLAR_API_BASE = 'https://api.polar.sh'

function getPolarApiKey() {
  const key = process.env.POLAR_API_KEY?.trim()
  if (!key) throw new Error('POLAR_API_KEY is not set')
  return key
}

async function callPolar<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${POLAR_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPolarApiKey()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Polar API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export interface PolarCheckoutSession {
  id: string
  url: string
}

export async function createCheckoutSession(input: {
  productId: string
  customerId?: string
  customerEmail?: string
  successUrl: string
  metadata?: Record<string, string>
}): Promise<PolarCheckoutSession> {
  return callPolar<PolarCheckoutSession>('/v1/checkouts/', {
    method: 'POST',
    body: JSON.stringify({
      product_id: input.productId,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      success_url: input.successUrl,
      metadata: input.metadata ?? {},
    }),
  })
}

export interface PolarSubscription {
  id: string
  status: string
  product_id: string
  customer_id: string
  customer: { id: string; email: string; name?: string | null }
  cancel_at_period_end: boolean
  current_period_start: string
  current_period_end: string | null
}

export async function getSubscription(subscriptionId: string): Promise<PolarSubscription> {
  return callPolar<PolarSubscription>(`/v1/subscriptions/${subscriptionId}`)
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await callPolar(`/v1/subscriptions/${subscriptionId}`, { method: 'DELETE' })
}

// Standard Webhooks signature verification (https://www.standardwebhooks.com/)
export async function verifyPolarWebhook(
  rawBody: string,
  headers: { 'webhook-id'?: string; 'webhook-timestamp'?: string; 'webhook-signature'?: string },
): Promise<boolean> {
  const secret = process.env.POLAR_WEBHOOK_SECRET?.trim()
  if (!secret) return false

  const msgId = headers['webhook-id']
  const msgTimestamp = headers['webhook-timestamp']
  const msgSignature = headers['webhook-signature']
  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject timestamps more than 5 minutes old
  const ts = Number(msgTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const toSign = `${msgId}.${msgTimestamp}.${rawBody}`

  // Secret may be prefixed with "whsec_"
  const rawSecret = secret.startsWith('whsec_')
    ? secret.slice('whsec_'.length)
    : secret
  const keyBytes = Buffer.from(rawSecret, 'base64')

  const { createHmac } = await import('crypto')
  const expectedSig = createHmac('sha256', keyBytes).update(toSign).digest('base64')

  // webhook-signature may contain multiple space-separated "v1,<sig>" values
  const sigs = msgSignature.split(' ')
  for (const sig of sigs) {
    const parts = sig.split(',')
    if (parts.length < 2) continue
    const version = parts[0]
    const value = parts.slice(1).join(',')
    if (version === 'v1' && value === expectedSig) return true
  }
  return false
}

// Product ID → plan mapping via env vars
export const POLAR_PRODUCT_IDS: Record<'YOUTUBE_PROMO' | 'PRO' | 'UNLIMITED', string | undefined> = {
  YOUTUBE_PROMO: process.env.POLAR_PRODUCT_YOUTUBE_PROMO?.trim() || process.env.NEXT_PUBLIC_POLAR_PRODUCT_YOUTUBE_PROMO?.trim(),
  PRO: process.env.POLAR_PRODUCT_PRO?.trim() || process.env.NEXT_PUBLIC_POLAR_PRODUCT_PRO?.trim(),
  UNLIMITED: process.env.POLAR_PRODUCT_UNLIMITED?.trim() || process.env.NEXT_PUBLIC_POLAR_PRODUCT_UNLIMITED?.trim(),
}

export function planFromPolarProductId(productId: string): 'YOUTUBE_PROMO' | 'PRO' | 'UNLIMITED' | null {
  for (const plan of ['YOUTUBE_PROMO', 'PRO', 'UNLIMITED'] as const) {
    if (POLAR_PRODUCT_IDS[plan] === productId) return plan
  }
  return null
}
