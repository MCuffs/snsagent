import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import {
  createNicepayOrderId,
  issueDirectBillingKey,
  isPaidPlan,
  nextMonthlyBillingDate,
  NicepayError,
  PLAN_AMOUNTS,
  approveBillingPayment,
  type PaidPlan,
} from '../../../../lib/nicepay'
import { normalizePlan } from '../../../../lib/limits-types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json() as {
      plan?: string
      cardNo?: string
      cardExpire?: string
      idNo?: string
      cardPw?: string
    }

    const { plan, cardNo, cardExpire, idNo, cardPw } = body

    if (!isPaidPlan(plan ?? null)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }
    if (!cardNo || !cardExpire || !idNo || !cardPw) {
      return NextResponse.json({ error: '카드 정보를 모두 입력해 주세요.' }, { status: 400 })
    }
    if (!/^\d{14,16}$/.test(cardNo.replace(/-/g, ''))) {
      return NextResponse.json({ error: '카드번호 형식이 올바르지 않습니다.' }, { status: 400 })
    }
    if (!/^\d{4}$/.test(cardExpire)) {
      return NextResponse.json({ error: '유효기간 형식이 올바르지 않습니다. (YYMM)' }, { status: 400 })
    }
    if (!/^\d{6}(\d{4})?$/.test(idNo)) {
      return NextResponse.json({ error: '생년월일(6자리) 또는 사업자번호(10자리)를 입력해 주세요.' }, { status: 400 })
    }
    if (!/^\d{2}$/.test(cardPw)) {
      return NextResponse.json({ error: '비밀번호 앞 2자리를 입력해 주세요.' }, { status: 400 })
    }

    const validPlan = plan as PaidPlan

    if (
      user.tossSubscriptionStatus === 'ACTIVE' ||
      user.paypalSubscriptionId ||
      user.nicepaySubscriptionStatus === 'ACTIVE'
    ) {
      return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
    }

    if (validPlan === 'LITE' && normalizePlan(user.plan) === 'LITE') {
      return NextResponse.json({ error: '이미 사용 가능한 1회권이 있습니다.' }, { status: 409 })
    }

    const registOrderId = createNicepayOrderId('regist', `${user.id}:${validPlan}:${Date.now()}`)
    const billing = await issueDirectBillingKey({
      orderId: registOrderId,
      cardNo: cardNo.replace(/-/g, ''),
      cardExpire,
      idNo,
      cardPw,
    })

    const renewOrderId = createNicepayOrderId('renew', `${user.id}:${validPlan}:${Date.now()}`)
    const payment = await approveBillingPayment({
      bid: billing.bid,
      orderId: renewOrderId,
      plan: validPlan,
      buyerName: user.name ?? undefined,
      buyerEmail: user.email ?? undefined,
    })

    const paidAt = new Date()
    await dbService.updateUserNicepay(user.id, {
      plan: validPlan,
      nicepayBid: billing.bid,
      nicepaySubscriptionStatus: validPlan === 'LITE' ? null : 'ACTIVE',
      nicepayLastPaidAt: paidAt,
      nicepayNextBillingAt: validPlan === 'LITE' ? null : nextMonthlyBillingDate(paidAt),
      nicepayCanceledAt: null,
      nicepayLastOrderId: payment.orderId,
    })

    return NextResponse.json({ success: true, offer: validPlan === 'LITE' ? 'regeneration' : undefined })
  } catch (error) {
    console.error('[NicePay CardRegister]', error)
    if (error instanceof NicepayError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 })
  }
}
