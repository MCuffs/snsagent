/**
 * PayPal one-time setup script
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy VERCEL_DOMAIN=https://your-app.vercel.app node scripts/paypal-setup.mjs
 *
 * Add PAYPAL_SANDBOX=true to use the sandbox environment.
 *
 * What it does:
 *   1. Creates PayPal products + monthly billing plans for STARTER / PRO / AGENCY
 *   2. Registers a webhook endpoint for your domain
 *   3. Prints all Vercel env var commands to run
 */

const SANDBOX = process.env.PAYPAL_SANDBOX === 'true'
const PAYPAL_BASE = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const DOMAIN = process.env.VERCEL_DOMAIN

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.')
  console.error('  PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy VERCEL_DOMAIN=https://... node scripts/paypal-setup.mjs')
  process.exit(1)
}

if (!DOMAIN) {
  console.error('VERCEL_DOMAIN is required. Example: VERCEL_DOMAIN=https://shuffla.vercel.app')
  process.exit(1)
}

const BASE_URL = DOMAIN.startsWith('http') ? DOMAIN : `https://${DOMAIN}`

async function getToken() {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Token error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function api(token, method, path, body) {
  const res = await fetch(`${PAYPAL_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

const PLANS = [
  { key: 'STARTER', name: 'Shuffla Starter', description: '1인 브랜드와 소상공인을 위한 플랜', amount: '21.00', currency: 'USD' },
  { key: 'PRO',     name: 'Shuffla Pro',     description: '성장하는 브랜드를 위한 고급 플랜',       amount: '57.00', currency: 'USD' },
  { key: 'AGENCY',  name: 'Shuffla Agency',  description: '다수 브랜드를 관리하는 팀과 대행사용 플랜', amount: '145.00', currency: 'USD' },
]

async function main() {
  console.log(`🚀 PayPal 설정 시작 (${SANDBOX ? '🧪 Sandbox' : '🔴 Live'})\n`)

  const token = await getToken()
  console.log('✅ 인증 성공\n')

  const planIds = {}

  for (const plan of PLANS) {
    console.log(`📦 ${plan.name} 플랜 생성 중...`)

    // Create product
    const product = await api(token, 'POST', '/v1/catalogs/products', {
      name: plan.name,
      description: plan.description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    })
    console.log(`   상품 생성: ${product.id}`)

    // Create billing plan
    const billingPlan = await api(token, 'POST', '/v1/billing/plans', {
      product_id: product.id,
      name: `${plan.name} Monthly`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: plan.amount, currency_code: plan.currency },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    })
    planIds[plan.key] = billingPlan.id
    console.log(`   플랜 생성: ${billingPlan.id}`)
  }

  // Register webhook
  console.log('\n🔗 웹훅 등록 중...')
  const webhookUrl = `${BASE_URL}/api/paypal/webhook`
  const webhook = await api(token, 'POST', '/v1/notifications/webhooks', {
    url: webhookUrl,
    event_types: [
      { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
      { name: 'BILLING.SUBSCRIPTION.UPDATED' },
      { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
      { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
      { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
      { name: 'PAYMENT.SALE.COMPLETED' },
    ],
  })
  console.log(`   웹훅 생성: ${webhook.id} → ${webhookUrl}`)

  // Print env var commands
  console.log('\n' + '='.repeat(70))
  console.log('✅ 완료! 아래 명령어를 실행해 Vercel에 환경변수를 등록하세요:')
  console.log('='.repeat(70) + '\n')

  const envVars = {
    PAYPAL_CLIENT_ID: CLIENT_ID,
    PAYPAL_CLIENT_SECRET: CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: webhook.id,
    NEXT_PUBLIC_PAYPAL_CLIENT_ID: CLIENT_ID,
    NEXT_PUBLIC_PAYPAL_PLAN_STARTER: planIds.STARTER,
    NEXT_PUBLIC_PAYPAL_PLAN_PRO: planIds.PRO,
    NEXT_PUBLIC_PAYPAL_PLAN_AGENCY: planIds.AGENCY,
    ...(SANDBOX ? { PAYPAL_SANDBOX: 'true' } : {}),
  }

  for (const [name, value] of Object.entries(envVars)) {
    console.log(`echo "${value}" | vercel env add ${name} production`)
  }

  console.log('\n📋 환경변수 요약:')
  for (const [name, value] of Object.entries(envVars)) {
    const display = String(value).length > 30 ? String(value).slice(0, 30) + '...' : value
    console.log(`  ${name}=${display}`)
  }
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message)
  process.exit(1)
})
