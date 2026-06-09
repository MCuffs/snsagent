import { z } from 'zod'
import { dbService } from '../../../../lib/db-service'
import { nextMonthlyBillingDate } from '../../../../lib/nicepay'
import { unauthorizedJson, verifyRequestSecret } from '../../../../lib/security'

export const runtime = 'nodejs'

const webhookSchema = z.object({
  eventType: z.string().optional(),
  type: z.string().optional(),
  tid: z.string().optional(),
  resultCode: z.string().optional(),
  bid: z.string().optional(),
  resultMsg: z.string().optional(),
})

function nicepayOk() {
  return new Response('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: Request) {
  const webhookSecret = process.env.NICEPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[NicePay Webhook] NICEPAY_WEBHOOK_SECRET is not configured; refusing to process webhook')
    return Response.json(
      { success: false, error: 'NicePay webhook secret is not configured.' },
      { status: 500 },
    )
  }

  if (!verifyRequestSecret(request, webhookSecret)) {
    return unauthorizedJson('Unauthorized NicePay webhook request.')
  }

  const rawBody = await request.text()

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    console.warn('[NicePay Webhook] Received non-JSON webhook verification request')
    return nicepayOk()
  }

  const validation = webhookSchema.safeParse(parsedBody)
  if (!validation.success) {
    console.warn('[NicePay Webhook] Invalid webhook payload format:', validation.error.message)
    return nicepayOk()
  }

  const data = validation.data
  const eventType = data.eventType || data.type || ''
  const tid = data.tid || ''
  const resultCode = data.resultCode || ''
  const bid = data.bid || ''


  console.log(`[NicePay Webhook] eventType=${eventType} resultCode=${resultCode} hasTid=${Boolean(tid)} hasBid=${Boolean(bid)}`)

  try {
    if (eventType === 'BILLING' || resultCode === '0000') {
      await handleBillingSuccess({ tid, bid })
    }
    if (eventType === 'BILLING_FAIL' || (resultCode && resultCode !== '0000' && bid)) {
      await handleBillingFail({ bid, resultCode, resultMsg: data.resultMsg || '' })
    }
    if (eventType === 'BILLING_EXPIRE') {
      await handleBillingExpire({ bid })
    }
  } catch (error) {
    console.error('[NicePay Webhook] Handler error', error)
  }

  return nicepayOk()
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
