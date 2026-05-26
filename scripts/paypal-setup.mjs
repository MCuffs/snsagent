/**
 * Creates PayPal monthly plans for international customers.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy VERCEL_DOMAIN=https://your-app.vercel.app node scripts/paypal-setup.mjs
 *
 * Add PAYPAL_SANDBOX=true to use the sandbox environment.
 */

const sandbox = process.env.PAYPAL_SANDBOX === 'true'
const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
const clientId = process.env.PAYPAL_CLIENT_ID
const clientSecret = process.env.PAYPAL_CLIENT_SECRET
const domain = process.env.VERCEL_DOMAIN

if (!clientId || !clientSecret || !domain) {
  console.error('PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and VERCEL_DOMAIN are required.')
  process.exit(1)
}

const appUrl = domain.startsWith('http') ? domain : `https://${domain}`
const plans = [
  { key: 'LITE', name: 'Shuffla Single', description: '월 1회 카드뉴스 생성 플랜', amount: '3000' },
  { key: 'PRO', name: 'Shuffla Creator', description: '월 20회 카드뉴스 생성, 캠페인별 AI 배경 재생성 1회분 포함', amount: '19000' },
  { key: 'UNLIMITED', name: 'Shuffla Studio', description: '월 30회 카드뉴스 생성 플랜', amount: '45000' },
]

async function getToken() {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) throw new Error(`PayPal token request failed: ${response.status}`)
  const body = await response.json()
  return body.access_token
}

async function api(token, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  const token = await getToken()
  const planIds = {}

  for (const plan of plans) {
    const product = await api(token, 'POST', '/v1/catalogs/products', {
      name: plan.name,
      description: plan.description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    })
    const billingPlan = await api(token, 'POST', '/v1/billing/plans', {
      product_id: product.id,
      name: `${plan.name} Monthly`,
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: { interval_unit: 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: plan.amount, currency_code: 'KRW' } },
      }],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    })
    planIds[plan.key] = billingPlan.id
    console.log(`${plan.name}: ${billingPlan.id}`)
  }

  const webhook = await api(token, 'POST', '/v1/notifications/webhooks', {
    url: `${appUrl}/api/paypal/webhook`,
    event_types: [
      { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
      { name: 'BILLING.SUBSCRIPTION.UPDATED' },
      { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
      { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
      { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
    ],
  })

  console.log('\nConfigure these deployment variables:')
  console.log(`PAYPAL_WEBHOOK_ID=${webhook.id}`)
  console.log(`NEXT_PUBLIC_PAYPAL_CLIENT_ID=${clientId}`)
  console.log(`NEXT_PUBLIC_PAYPAL_PLAN_LITE=${planIds.LITE}`)
  console.log(`NEXT_PUBLIC_PAYPAL_PLAN_PRO=${planIds.PRO}`)
  console.log(`NEXT_PUBLIC_PAYPAL_PLAN_UNLIMITED=${planIds.UNLIMITED}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
