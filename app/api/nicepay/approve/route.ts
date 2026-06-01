import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import {
  serverApprove,
  issueBillingKey,
  createNicepayOrderId,
  isPaidPlan,
  nextMonthlyBillingDate,
  PLAN_AMOUNTS,
  NicepayError,
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
      tid?: string
      authToken?: string
      orderId?: string
      plan?: string
    }

    const { tid, authToken, orderId, plan } = body

    if (!tid || !authToken || !orderId || !isPaidPlan(plan ?? null)) {
      return NextResponse.json({ error: '결제 인증 정보가 올바르지 않습니다.' }, { status: 400 })
    }

    // isPaidPlan 통과 후 plan은 PaidPlan 타입으로 확정
    const validPlan = plan as import('../../../../lib/nicepay').PaidPlan

    if (
      user.tossSubscriptionStatus === 'ACTIVE' ||
      user.paypalSubscriptionId ||
      user.nicepaySubscriptionStatus === 'ACTIVE'
    ) {
      return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
    }

    if (plan === 'LITE' && normalizePlan(user.plan) === 'LITE') {
      return NextResponse.json({ error: '이미 사용 가능한 1회권이 있습니다.', offer: 'regeneration' }, { status: 409 })
    }

    // 서버 DB 기준 금액으로 검증 — 프론트에서 받은 amount는 절대 신뢰하지 않음
    const expectedAmount = PLAN_AMOUNTS[validPlan]

    // Server 승인 API 호출
    const approveResult = await serverApprove({ tid, amount: expectedAmount, orderId })

    if (approveResult.resultCode !== '0000') {
      return NextResponse.json(
        { error: approveResult.resultMsg || '결제 승인에 실패했습니다.' },
        { status: 400 },
      )
    }

    const paidAt = new Date()

    // BID 발급 (정기결제용) — LITE(1회권)는 불필요
    if (validPlan === 'LITE') {
      await dbService.updateUserNicepay(user.id, {
        plan: validPlan,
        nicepayBid: null,
        nicepaySubscriptionStatus: null,
        nicepayLastPaidAt: paidAt,
        nicepayNextBillingAt: null,
        nicepayCanceledAt: null,
        nicepayLastOrderId: orderId,
      })
      return NextResponse.json({ success: true, offer: 'regeneration' })
    }

    // PRO / UNLIMITED: BID 발급 후 정기결제 등록
    let bid: string | null = null
    try {
      const registOrderId = createNicepayOrderId('regist', `${user.id}:${orderId}`)
      const billing = await issueBillingKey(authToken, registOrderId)
      bid = billing.bid

      await dbService.updateUserNicepay(user.id, {
        plan: validPlan,
        nicepayBid: bid,
        nicepaySubscriptionStatus: 'ACTIVE',
        nicepayLastPaidAt: paidAt,
        nicepayNextBillingAt: nextMonthlyBillingDate(paidAt),
        nicepayCanceledAt: null,
        nicepayLastOrderId: orderId,
      })
    } catch (bidError) {
      console.error('[NicePay BID Issue Failed]', bidError)
      await dbService.updateUserNicepay(user.id, {
        nicepayBid: null,
        nicepaySubscriptionStatus: 'PENDING',
        nicepayLastPaidAt: paidAt,
        nicepayLastOrderId: orderId,
      })
      return NextResponse.json(
        { error: 'NicePay billing key registration failed after payment approval. Manual review is required.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NicePay Approve]', error)
    if (error instanceof NicepayError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
