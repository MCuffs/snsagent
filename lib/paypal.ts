const PAYPAL_BASE =
  process.env.PAYPAL_SANDBOX === 'true'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set')
  }
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`PayPal token error: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function getSubscription(subscriptionId: string) {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`PayPal subscription fetch error: ${res.status}`)
  return res.json() as Promise<{ id: string; status: string; subscriber?: { payer_id?: string } }>
}

export async function cancelSubscription(subscriptionId: string, reason = '사용자 요청') {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok && res.status !== 204) {
    throw new Error(`PayPal cancel error: ${res.status}`)
  }
}

export async function verifyWebhookSignature(body: string, headers: Record<string, string>): Promise<boolean> {
  const token = await getAccessToken()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) return false

  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  })
  if (!res.ok) return false
  const data = await res.json() as { verification_status: string }
  return data.verification_status === 'SUCCESS'
}

// PayPal billing plan IDs — set in env (NEXT_PUBLIC_ so client can read them)
export const PAYPAL_PLAN_IDS: Record<string, string | undefined> = {
  LITE: process.env.NEXT_PUBLIC_PAYPAL_PLAN_LITE,
  PRO: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO,
  UNLIMITED: process.env.NEXT_PUBLIC_PAYPAL_PLAN_UNLIMITED,
}

export function planFromPayPalPlanId(planId: string): string | null {
  for (const [plan, id] of Object.entries(PAYPAL_PLAN_IDS)) {
    if (id === planId) return plan
  }
  return null
}
