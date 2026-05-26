import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import {
  approveBillingPayment,
  createTossOrderId,
  findPaymentByOrderId,
  isPaidPlan,
  nextMonthlyBillingDate,
} from '../../../../lib/tosspayments'

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

  return NextResponse.json({ success: true, processedCount: results.length, results })
}
