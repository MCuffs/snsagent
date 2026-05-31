import { dbService } from '../../../../lib/db-service'
import { nextMonthlyBillingDate } from '../../../../lib/nicepay'

export const runtime = 'nodejs'

function webhookString(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ success: true })
  }

  const eventType = webhookString(body.eventType) || webhookString(body.type)
  const tid = webhookString(body.tid)
  const resultCode = webhookString(body.resultCode)
  const bid = webhookString(body.bid)

  console.log(`[NicePay Webhook] eventType=${eventType} resultCode=${resultCode} hasTid=${Boolean(tid)} hasBid=${Boolean(bid)}`)

  try {
    if (eventType === 'BILLING' || resultCode === '0000') {
      await handleBillingSuccess({ tid, bid })
    }
    if (eventType === 'BILLING_FAIL' || (resultCode && resultCode !== '0000' && bid)) {
      await handleBillingFail({ bid, resultCode, resultMsg: webhookString(body.resultMsg) })
    }
    if (eventType === 'BILLING_EXPIRE') {
      await handleBillingExpire({ bid })
    }
  } catch (error) {
    console.error('[NicePay Webhook] Handler error', error)
  }

  return Response.json({ success: true })
}

async function handleBillingSuccess({ tid, bid }: { tid: string; bid: string }) {
  if (!bid) return
  const user = await dbService.getUserByNicepayBid(bid)
  if (!user) {
    console.warn(`[NicePay Webhook] No user found for bid=${bid}`)
    return
  }
  const now = new Date()
  await dbService.updateUserNicepay(user.id, {
    nicepaySubscriptionStatus: 'ACTIVE',
    nicepayLastPaidAt: now,
    nicepayNextBillingAt: nextMonthlyBillingDate(now),
    nicepayLastOrderId: tid,
  })
  console.log(`[NicePay Webhook] Billing success — user=${user.id} tid=${tid}`)
}

async function handleBillingFail({ bid, resultCode, resultMsg }: { bid: string; resultCode: string; resultMsg: string }) {
  if (!bid) return
  const user = await dbService.getUserByNicepayBid(bid)
  if (!user) return
  await dbService.updateUserNicepay(user.id, { nicepaySubscriptionStatus: 'PAST_DUE' })
  console.warn(`[NicePay Webhook] Billing failed — user=${user.id} code=${resultCode} msg=${resultMsg}`)
}

async function handleBillingExpire({ bid }: { bid: string }) {
  if (!bid) return
  const user = await dbService.getUserByNicepayBid(bid)
  if (!user) return
  await dbService.updateUserNicepay(user.id, {
    nicepayBid: null,
    nicepaySubscriptionStatus: 'CANCELED',
    nicepayCanceledAt: new Date(),
    plan: 'FREE',
  })
  console.log(`[NicePay Webhook] Billing expired — user=${user.id} downgraded to FREE`)
}
