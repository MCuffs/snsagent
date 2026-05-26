import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../../lib/auth/user'
import { dbService } from '../../../../../../lib/db-service'
import {
  approveBillingPayment,
  createTossOrderId,
  deleteBillingKey,
  isPaidPlan,
  issueBillingKey,
  nextMonthlyBillingDate,
} from '../../../../../../lib/tosspayments'

export const runtime = 'nodejs'

function redirectToBilling(request: NextRequest, key: 'success' | 'canceled', message?: string) {
  const url = new URL('/billing', request.url)
  url.searchParams.set(key, 'true')
  if (message) url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return redirectToBilling(request, 'canceled', '로그인이 필요합니다.')

  const authKey = request.nextUrl.searchParams.get('authKey')
  const customerKey = request.nextUrl.searchParams.get('customerKey')
  const plan = request.nextUrl.searchParams.get('plan')

  if (!authKey || !customerKey || !isPaidPlan(plan)) {
    return redirectToBilling(request, 'canceled', '결제 인증 정보가 올바르지 않습니다.')
  }
  if (customerKey !== user.tossCustomerKey) {
    return redirectToBilling(request, 'canceled', '결제 고객 정보가 일치하지 않습니다.')
  }
  if (user.tossSubscriptionStatus === 'ACTIVE' || user.paypalSubscriptionId) {
    return redirectToBilling(request, 'canceled', '이미 활성 구독이 있습니다.')
  }

  let billingKey: string | null = null
  let paymentCompleted = false
  try {
    const billing = await issueBillingKey(authKey, customerKey)
    billingKey = billing.billingKey
    const orderId = createTossOrderId('start', `${authKey}:${plan}`)

    await dbService.updateUserToss(user.id, {
      tossBillingKey: billing.billingKey,
      tossLastOrderId: orderId,
      tossSubscriptionStatus: 'PENDING',
    })

    const payment = await approveBillingPayment({
      billingKey: billing.billingKey,
      customerKey,
      orderId,
      plan,
      customerEmail: user.email,
      customerName: user.name,
    })

    if (payment.status !== 'DONE') {
      throw new Error('토스페이먼츠 결제가 완료 상태가 아닙니다.')
    }
    paymentCompleted = true

    const paidAt = new Date()
    await dbService.updateUserToss(user.id, {
      plan,
      tossPaymentKey: payment.paymentKey,
      tossSubscriptionStatus: 'ACTIVE',
      tossLastPaidAt: paidAt,
      tossNextBillingAt: nextMonthlyBillingDate(paidAt),
      tossCanceledAt: null,
    })

    return redirectToBilling(request, 'success')
  } catch (error) {
    console.error('[Toss Billing Callback]', error)
    if (billingKey && !paymentCompleted) {
      await deleteBillingKey(billingKey).catch(deleteError => {
        console.error('[Toss Billing Cleanup]', deleteError)
      })
    }
    if (!paymentCompleted) {
      await dbService.updateUserToss(user.id, {
        tossBillingKey: null,
        tossSubscriptionStatus: null,
        tossNextBillingAt: null,
      }).catch(() => undefined)
    }
    return redirectToBilling(request, 'canceled', '결제 승인에 실패했습니다. 다시 시도해주세요.')
  }
}
