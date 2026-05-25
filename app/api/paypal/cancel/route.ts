import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { cancelSubscription } from '../../../../lib/paypal'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (!user.paypalSubscriptionId) {
      return NextResponse.json({ error: '활성 구독이 없습니다.' }, { status: 400 })
    }

    await cancelSubscription(user.paypalSubscriptionId, '사용자 요청')

    await dbService.updateUserPayPal(user.id, {
      paypalSubscriptionId: null,
      paypalSubscriptionStatus: 'CANCELLED',
      plan: 'FREE',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PayPal Cancel]', error)
    return NextResponse.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 })
  }
}
