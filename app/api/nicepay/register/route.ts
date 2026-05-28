import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import {
  registerBillingKey,
  chargeBillingKey,
  createNicePayOrderId,
  nextMonthlyBillingDate,
  isPaidPlan,
  NicePayError,
  type NicePayPlan,
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
  const cardNo = body?.cardNo as string | undefined
  const expYear = body?.expYear as string | undefined
  const expMonth = body?.expMonth as string | undefined
  const idNo = body?.idNo as string | undefined
  const cardPw = body?.cardPw as string | undefined

  if (!isPaidPlan(plan ?? null)) {
    return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
  }
  if (!cardNo || !expYear || !expMonth || !idNo || !cardPw) {
    return NextResponse.json({ error: '카드 정보가 불완전합니다.' }, { status: 400 })
  }

  const currentPlan = normalizePlan(user.plan ?? 'FREE')
  if (user.nicepaySubscriptionStatus === 'ACTIVE' || user.tossSubscriptionStatus === 'ACTIVE' || user.paypalSubscriptionId) {
    return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
  }
  if (plan === 'LITE' && currentPlan === 'LITE') {
    return NextResponse.json({ error: '이미 사용 가능한 1회권이 있습니다.' }, { status: 409 })
  }

  const orderId = createNicePayOrderId('start', `${user.id}:${plan}:${Date.now()}`)

  try {
    const billing = await registerBillingKey({
      orderId,
      amount: 100,
      goodsName: `Shuffla 구독 등록`,
      cardNo,
      expYear,
      expMonth,
      idNo,
      cardPw,
      buyerEmail: user.email,
      buyerName: user.name ?? undefined,
    })

    const bid = billing.bid
    const chargeOrderId = createNicePayOrderId('start', `${user.id}:${plan}:charge`)
    const payment = await chargeBillingKey({
      bid,
      orderId: chargeOrderId,
      plan: plan as NicePayPlan,
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
    if (error instanceof NicePayError) {
      console.error(`[NicePay] Register failed: ${error.code} — ${error.message}`)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error('[NicePay] Register unexpected error', error)
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
