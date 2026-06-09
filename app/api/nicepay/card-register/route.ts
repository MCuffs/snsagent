import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import {
  createNicepayOrderId,
  issueDirectBillingKey,
  isPaidPlan,
  nextMonthlyBillingDate,
  NicepayError,
  approveBillingPayment,
  decryptCardDataServer,
  type PaidPlan,
} from '../../../../lib/nicepay'
import { readNicepayReturnToken } from '../../../../lib/nicepay-return-token'
import { normalizePlan } from '../../../../lib/limits-types'

export const runtime = 'nodejs'

const registerSchema = z.object({
  token: z.string().min(1, '결제 토큰이 누락되었습니다.'),
  ciphertext: z.string().min(1, '암호화된 데이터가 누락되었습니다.'),
  iv: z.string().min(1, '암호화 IV가 누락되었습니다.'),
  plan: z.string().min(1, '구독 플랜이 누락되었습니다.'),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = registerSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || '잘못된 요청 형식입니다.' }, { status: 400 })
    }

    const { token, ciphertext, iv, plan } = parsed.data

    if (!isPaidPlan(plan)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    // 1. Verify and read return token
    const tokenPayload = readNicepayReturnToken(token)
    if (!tokenPayload) {
      return NextResponse.json({ error: '결제 토큰이 만료되었거나 올바르지 않습니다.' }, { status: 400 })
    }

    // 2. Validate token ownership and plan
    if (tokenPayload.userId !== user.id) {
      return NextResponse.json({ error: '잘못된 사용자 결제 요청입니다.' }, { status: 403 })
    }
    if (tokenPayload.plan !== plan) {
      return NextResponse.json({ error: '선택한 플랜이 토큰 정보와 일치하지 않습니다.' }, { status: 400 })
    }

    // 3. Decrypt card data from Client
    let decryptedText = ''
    try {
      decryptedText = decryptCardDataServer(ciphertext, iv, tokenPayload.encryptionKey)
    } catch (err) {
      console.error('[NicePay CardRegister] Decryption failed:', err)
      return NextResponse.json({ error: '보안 데이터 복호화에 실패했습니다.' }, { status: 400 })
    }

    // Parse the decrypted card data
    const params = new URLSearchParams(decryptedText)
    const cardNo = (params.get('cardNo') || '').replace(/-/g, '')
    const cardExpire = params.get('cardExpire') || ''
    const idNo = params.get('idNo') || ''
    const cardPw = params.get('cardPw') || ''

    if (!cardNo || !cardExpire || !idNo || !cardPw) {
      return NextResponse.json({ error: '카드 정보를 모두 입력해 주세요.' }, { status: 400 })
    }
    if (!/^\d{14,16}$/.test(cardNo)) {
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
      cardNo,
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
