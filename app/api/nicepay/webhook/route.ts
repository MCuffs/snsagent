import prisma from '../../../../lib/db'
import { dbService } from '../../../../lib/db-service'
import { nextMonthlyBillingDate } from '../../../../lib/nicepay'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const rawBody = await request.text()
  console.log('[NicePay Webhook] raw body:', rawBody)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ success: true })
  }

  const eventType = String(body.eventType || body.type || '')
  const tid = String(body.tid || '')
  const resultCode = String(body.resultCode || '')
  const bid = String(body.bid || '')

  console.log(`[NicePay Webhook] eventType=${eventType} tid=${tid} resultCode=${resultCode}`)

  try {
    if (eventType === 'BILLING' || resultCode === '0000') {
      await handleBillingSuccess({ tid, bid, amount: Number(body.amount || 0) })
    }
    if (eventType === 'BILLING_FAIL' || (resultCode && resultCode !== '0000' && bid)) {
      await handleBillingFail({ bid, resultCode, resultMsg: String(body.resultMsg || '') })
    }
    if (eventType === 'BILLING_EXPIRE') {
      await handleBillingExpire({ bid })
    }
  } catch (error) {
    console.error('[NicePay Webhook] Handler error', error)
  }

  return Response.json({ success: true })
}

async function handleBillingSuccess({ tid, bid, amount }: { tid: string; bid: string; amount: number }) {
  if (!bid) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user as any).findFirst({ where: { nicepayBid: bid } })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user as any).findFirst({ where: { nicepayBid: bid } })
  if (!user) return
  await dbService.updateUserNicepay(user.id, { nicepaySubscriptionStatus: 'PAST_DUE' })
  console.warn(`[NicePay Webhook] Billing failed — user=${user.id} code=${resultCode} msg=${resultMsg}`)
}

async function handleBillingExpire({ bid }: { bid: string }) {
  if (!bid) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma.user as any).findFirst({ where: { nicepayBid: bid } })
  if (!user) return
  await dbService.updateUserNicepay(user.id, {
    nicepayBid: null,
    nicepaySubscriptionStatus: 'CANCELED',
    nicepayCanceledAt: new Date(),
    plan: 'FREE',
  })
  console.log(`[NicePay Webhook] Billing expired — user=${user.id} downgraded to FREE`)
}
