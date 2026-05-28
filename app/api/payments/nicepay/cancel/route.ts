import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../lib/auth/user'
import { dbService } from '../../../../../lib/db-service'
import { createNicepayOrderId, expireBillingKey, NicepayError } from '../../../../../lib/nicepay'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (!user.nicepayBid) {
      return NextResponse.json({ error: '활성 나이스페이 구독이 없습니다.' }, { status: 400 })
    }

    try {
      await expireBillingKey(user.nicepayBid, createNicepayOrderId('expire', user.nicepayBid))
    } catch (error) {
      if (!(error instanceof NicepayError && error.status === 404)) throw error
    }

    await dbService.updateUserNicepay(user.id, {
      plan: 'FREE',
      nicepayBid: null,
      nicepaySubscriptionStatus: 'CANCELED',
      nicepayNextBillingAt: null,
      nicepayCanceledAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NicePay Billing Cancel]', error)
    return NextResponse.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 })
  }
}
