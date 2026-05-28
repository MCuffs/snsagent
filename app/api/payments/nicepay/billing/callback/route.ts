import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../../lib/auth/user'
import { dbService } from '../../../../../../lib/db-service'
import {
  approveBillingPayment,
  createNicepayOrderId,
  expireBillingKey,
  isPaidPlan,
  issueBillingKey,
  nextMonthlyBillingDate,
} from '../../../../../../lib/nicepay'
import { normalizePlan } from '../../../../../../lib/limits-types'

export const runtime = 'nodejs'

function redirectToBilling(request: NextRequest, key: 'success' | 'canceled', message?: string, offer?: string) {
  const url = new URL('/billing', request.url)
  url.searchParams.set(key, 'true')
  if (message) url.searchParams.set('message', message)
  if (offer) url.searchParams.set('offer', offer)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return redirectToBilling(request, 'canceled', '로그인이 필요합니다.')

  const authToken = request.nextUrl.searchParams.get('authToken')
  const orderId = request.nextUrl.searchParams.get('orderId')
  const plan = request.nextUrl.searchParams.get('plan')

  if (!authToken || !orderId || !isPaidPlan(plan)) {
    return redirectToBilling(request, 'canceled', '결제 인증 정보가 올바르지 않습니다.')
  }
  if (user.tossSubscriptionStatus === 'ACTIVE' || user.paypalSubscriptionId || user.nicepaySubscriptionStatus === 'ACTIVE') {
    return redirectToBilling(request, 'canceled', '이미 활성 구독이 있습니다.')
  }
  if (plan === 'LITE' && normalizePlan(user.plan) === 'LITE') {
    return redirectToBilling(request, 'canceled', '이미 사용 가능한 1회권이 있습니다.', 'regeneration')
  }

  let bid: string | null = null
  let paymentCompleted = false
  try {
    const billing = await issueBillingKey(authToken, orderId)
    bid = billing.bid

    const payOrderId = createNicepayOrderId('start', `${authToken}:${plan}`)

    await dbService.updateUserNicepay(user.id, {
      nicepayBid: bid,
      nicepayLastOrderId: payOrderId,
      nicepaySubscriptionStatus: 'PENDING',
    })

    const payment = await approveBillingPayment({
      bid,
      orderId: payOrderId,
      plan,
      buyerName: user.name,
      buyerEmail: user.email,
    })

    if (payment.status !== 'paid') {
      throw new Error('나이스페이 결제가 완료 상태가 아닙니다.')
    }
    paymentCompleted = true

    const paidAt = new Date()
    if (plan === 'LITE') {
      await dbService.updateUserNicepay(user.id, {
        plan,
        nicepayBid: null,
        nicepaySubscriptionStatus: null,
        nicepayLastPaidAt: paidAt,
        nicepayNextBillingAt: null,
        nicepayCanceledAt: null,
      })
      await expireBillingKey(bid, createNicepayOrderId('expire', bid)).catch(err => {
        console.error('[NicePay One-time Cleanup]', err)
      })
      return redirectToBilling(request, 'success', undefined, 'regeneration')
    }

    await dbService.updateUserNicepay(user.id, {
      plan,
      nicepaySubscriptionStatus: 'ACTIVE',
      nicepayLastPaidAt: paidAt,
      nicepayNextBillingAt: nextMonthlyBillingDate(paidAt),
      nicepayCanceledAt: null,
    })

    return redirectToBilling(request, 'success')
  } catch (error) {
    console.error('[NicePay Billing Callback]', error)
    if (bid && !paymentCompleted) {
      await expireBillingKey(bid, createNicepayOrderId('expire', bid)).catch(err => {
        console.error('[NicePay Billing Cleanup]', err)
      })
    }
    if (!paymentCompleted) {
      await dbService.updateUserNicepay(user.id, {
        nicepayBid: null,
        nicepaySubscriptionStatus: null,
        nicepayNextBillingAt: null,
      }).catch(() => undefined)
    }
    return redirectToBilling(request, 'canceled', '결제 승인에 실패했습니다. 다시 시도해주세요.')
  }
}
