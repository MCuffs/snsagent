import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import {
  issueBillingKey,
  approveBillingPayment,
  createNicepayOrderId,
  nextMonthlyBillingDate,
  isPaidPlan,
  NicepayError,
  type PaidPlan,
} from '../../../../lib/nicepay'
import { normalizePlan } from '../../../../lib/limits-types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const plan = body?.plan as string | undefined
  const authToken = body?.authToken as string | undefined
  const orderId = body?.orderId as string | undefined

  if (!isPaidPlan(plan ?? null)) {
    return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
  }
  if (!authToken || !orderId) {
    return NextResponse.json({ error: '결제 인증 정보가 불완전합니다.' }, { status: 400 })
  }

  const currentPlan = normalizePlan(user.plan ?? 'FREE')
  if (user.nicepaySubscriptionStatus === 'ACTIVE' || user.tossSubscriptionStatus === 'ACTIVE' || user.paypalSubscriptionId) {
    return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
  }
  if (plan === 'LITE' && currentPlan === 'LITE') {
    return NextResponse.json({ error: '이미 사용 가능한 1회권이 있습니다.' }, { status: 409 })
  }

  let bid: string | null = null
  try {
    const billing = await issueBillingKey(authToken, orderId)
    bid = billing.bid

    const payOrderId = createNicepayOrderId('start', `${authToken}:${plan}`)
    const payment = await approveBillingPayment({
      bid,
      orderId: payOrderId,
      plan: plan as PaidPlan,
      buyerEmail: user.email,
      buyerName: user.name,
    })

    const now = new Date()
    const nextBillingAt = nextMonthlyBillingDate(now)

    await dbService.updateUserNicepay(user.id, {
      nicepayBid: bid,
      nicepaySubscriptionStatus: 'ACTIVE',
      nicepayLastOrderId: payment.tid,
      nicepayLastPaidAt: now,
      nicepayNextBillingAt: nextBillingAt,
      plan,
    })

    console.log(`[NicePay] User ${user.id} subscribed to ${plan}. tid=${payment.tid}`)
    return NextResponse.json({ success: true, plan, nextBillingAt: nextBillingAt.toISOString() })
  } catch (error) {
    if (error instanceof NicepayError) {
      console.error(`[NicePay] Register failed: ${error.code} — ${error.message}`)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error('[NicePay] Register unexpected error', error)
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
