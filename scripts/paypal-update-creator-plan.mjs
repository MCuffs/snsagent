/**
 * Updates the international PayPal Creator plan entitlement wording.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... NEXT_PUBLIC_PAYPAL_PLAN_PRO=P-... node scripts/paypal-update-creator-plan.mjs
 *   Add PAYPAL_SANDBOX=true when updating a sandbox plan.
 */

const sandbox = process.env.PAYPAL_SANDBOX === 'true'
const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
const clientId = process.env.PAYPAL_CLIENT_ID
const clientSecret = process.env.PAYPAL_CLIENT_SECRET
const planId = process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO

if (!clientId || !clientSecret || !planId) {
  console.error('PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and NEXT_PUBLIC_PAYPAL_PLAN_PRO are required.')
  process.exit(1)
}

async function main() {
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!tokenResponse.ok) throw new Error(`PayPal token request failed: ${tokenResponse.status}`)
  const token = (await tokenResponse.json()).access_token

  const response = await fetch(`${baseUrl}/v1/billing/plans/${planId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      { op: 'replace', path: '/description', value: '월 20회 카드뉴스 생성, 캠페인별 AI 배경 재생성 1회분 포함' },
    ]),
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`PayPal plan update failed: ${response.status} ${await response.text()}`)
  }
  console.log(`Creator PayPal plan description updated: ${planId}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
