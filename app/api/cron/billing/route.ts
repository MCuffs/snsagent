import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { saveErrorLog } from '../../../../lib/errorLogger'
import {
  approveBillingPayment,
  createTossOrderId,
  deleteBillingKey,
  findPaymentByOrderId,
  isPaidPlan,
  nextMonthlyBillingDate,
} from '../../../../lib/tosspayments'
import {
  approveBillingPayment as approveNicepayPayment,
  createNicepayOrderId,
  isPaidPlan as isNicepayPaidPlan,
  nextMonthlyBillingDate as nicepayNextMonth,
} from '../../../../lib/nicepay'

export const dynamic = 'force-dynamic'

async function sendBillingFailureAlert(userId: string, plan: string, provider: 'toss' | 'nicepay', errorMsg: string) {
  const webhookUrl = process.env.BILLING_ALERT_WEBHOOK_URL
  if (!webhookUrl) return

  const payload = {
    text: `🚨 *[CRITICAL] 결제 갱신 실패 알림* 🚨\n\n*사용자 ID:* ${userId}\n*요금제:* ${plan}\n*결제 수단:* ${provider.toUpperCase()}\n*오류 내용:* ${errorMsg}\n*발생 시각:* ${new Date().toISOString()}`
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[Billing Alert] Failed to send webhook alert:', err)
  }
}

export async function GET(request: NextRequest) {
  return handleBillingRenewal(request)
}

export async function POST(request: NextRequest) {
  return handleBillingRenewal(request)
}

async function handleBillingRenewal(request: NextRequest) {
  // 1. Cron Secret Verification (aligned with publish cron)
  const systemSecret = process.env.CRON_SECRET
  if (!systemSecret) {
    console.error('[Billing Cron] CRON_SECRET env var is not set — refusing to run')
    return NextResponse.json(
      { success: false, error: 'Cron secret not configured on this server.' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')

  let providedSecret = ''
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedSecret = authHeader.substring(7)
  } else if (querySecret) {
    providedSecret = querySecret
  }

  if (providedSecret !== systemSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized. Invalid secret key.' },
      { status: 401 }
    )
  }

  const now = new Date()
  const subscriptions = await dbService.getDueTossSubscriptions(now)
  const results: Array<{ userId: string; status: 'paid' | 'failed'; error?: string }> = []

  // Toss renewals
  for (const user of subscriptions) {
    if (user.plan === 'LITE') {
      if (user.tossBillingKey) {
        await deleteBillingKey(user.tossBillingKey).catch(error => {
          console.error('[Toss Legacy One-time Cleanup]', user.id, error)
        })
      }
      await dbService.updateUserToss(user.id, {
        tossBillingKey: null,
        tossSubscriptionStatus: null,
        tossNextBillingAt: null,
      })
      continue
    }

    if (!user.tossBillingKey || !user.tossCustomerKey || !isPaidPlan(user.plan) || !user.tossNextBillingAt) {
      continue
    }

    const orderId = createTossOrderId('renew', `${user.id}:${user.tossNextBillingAt.toISOString()}`)
    try {
      const existing = await findPaymentByOrderId(orderId)
      const payment = existing?.status === 'DONE'
        ? existing
        : await approveBillingPayment({
            billingKey: user.tossBillingKey,
            customerKey: user.tossCustomerKey,
            orderId,
            plan: user.plan,
            customerEmail: user.email,
            customerName: user.name,
          })

      if (payment.status !== 'DONE') throw new Error('Payment is not DONE')

      await dbService.updateUserToss(user.id, {
        tossPaymentKey: payment.paymentKey,
        tossLastOrderId: orderId,
        tossSubscriptionStatus: 'ACTIVE',
        tossLastPaidAt: now,
        tossNextBillingAt: nextMonthlyBillingDate(user.tossNextBillingAt),
      })
      results.push({ userId: user.id, status: 'paid' })
    } catch (error) {
      console.error('[Toss Billing Renewal]', user.id, error)
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // Save error log to DB
      await saveErrorLog(user.id, 'TossBillingRenewalCron', error, {
        orderId,
        plan: user.plan,
        customerKey: user.tossCustomerKey,
      })

      // Send webhook alert
      await sendBillingFailureAlert(user.id, user.plan, 'toss', errorMsg)

      // Grace period calculation (3 days retry logic)
      const dueDate = user.tossNextBillingAt || now
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))

      if (daysPastDue < 3) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        await dbService.updateUserToss(user.id, {
          tossSubscriptionStatus: 'PAST_DUE',
          tossNextBillingAt: tomorrow,
        })
        console.log(`[Toss Renewal] Grace period retry queued for user ${user.id} (Days past due: ${daysPastDue})`)
      } else {
        await dbService.updateUserToss(user.id, {
          plan: 'FREE',
          tossSubscriptionStatus: 'CANCELED',
          tossNextBillingAt: null,
        })
        console.log(`[Toss Renewal] Grace period expired. User ${user.id} downgraded to FREE.`)
      }

      results.push({ userId: user.id, status: 'failed', error: errorMsg })
    }
  }

  // NicePay renewals
  const nicepaySubscriptions = await dbService.getDueNicepaySubscriptions(now)

  for (const user of nicepaySubscriptions) {
    if (!user.nicepayBid || !isNicepayPaidPlan(user.plan) || !user.nicepayNextBillingAt) {
      continue
    }

    const orderId = createNicepayOrderId('renew', `${user.id}:${user.nicepayNextBillingAt.toISOString()}`)
    try {
      const payment = await approveNicepayPayment({
        bid: user.nicepayBid,
        orderId,
        plan: user.plan,
        buyerName: user.name,
        buyerEmail: user.email,
      })

      if (payment.status !== 'paid') throw new Error('NicePay payment is not paid')

      await dbService.updateUserNicepay(user.id, {
        nicepayLastOrderId: orderId,
        nicepaySubscriptionStatus: 'ACTIVE',
        nicepayLastPaidAt: now,
        nicepayNextBillingAt: nicepayNextMonth(user.nicepayNextBillingAt),
      })
      results.push({ userId: user.id, status: 'paid' })
    } catch (error) {
      console.error('[NicePay Billing Renewal]', user.id, error)
      const errorMsg = error instanceof Error ? error.message : String(error)

      // Save error log to DB
      await saveErrorLog(user.id, 'NicepayBillingRenewalCron', error, {
        orderId,
        plan: user.plan,
        nicepayBid: user.nicepayBid,
      })

      // Send webhook alert
      await sendBillingFailureAlert(user.id, user.plan, 'nicepay', errorMsg)

      // Grace period calculation (3 days retry logic)
      const dueDate = user.nicepayNextBillingAt || now
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))

      if (daysPastDue < 3) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        await dbService.updateUserNicepay(user.id, {
          nicepaySubscriptionStatus: 'PAST_DUE',
          nicepayNextBillingAt: tomorrow,
        })
        console.log(`[NicePay Renewal] Grace period retry queued for user ${user.id} (Days past due: ${daysPastDue})`)
      } else {
        await dbService.updateUserNicepay(user.id, {
          plan: 'FREE',
          nicepaySubscriptionStatus: 'CANCELED',
          nicepayNextBillingAt: null,
        })
        console.log(`[NicePay Renewal] Grace period expired. User ${user.id} downgraded to FREE.`)
      }

      results.push({ userId: user.id, status: 'failed', error: errorMsg })
    }
  }

  return NextResponse.json({ success: true, processedCount: results.length, results })
}
