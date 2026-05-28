import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
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
  expireBillingKey,
  isPaidPlan as isNicepayPaidPlan,
  nextMonthlyBillingDate as nicepayNextMonth,
} from '../../../../lib/nicepay'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handleBillingRenewal(request)
}

export async function POST(request: NextRequest) {
  return handleBillingRenewal(request)
}

async function handleBillingRenewal(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const subscriptions = await dbService.getDueTossSubscriptions(now)
  const results: Array<{ userId: string; status: 'paid' | 'failed'; error?: string }> = []

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
      await dbService.updateUserToss(user.id, {
        plan: 'FREE',
        tossSubscriptionStatus: 'PAST_DUE',
      })
      results.push({ userId: user.id, status: 'failed', error: 'Billing approval failed' })
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
      await dbService.updateUserNicepay(user.id, {
        plan: 'FREE',
        nicepaySubscriptionStatus: 'PAST_DUE',
      })
      results.push({ userId: user.id, status: 'failed', error: 'NicePay billing approval failed' })
    }
  }

  return NextResponse.json({ success: true, processedCount: results.length, results })
}
