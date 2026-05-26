import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { getSubscription, planFromPayPalPlanId } from '../../../../lib/paypal'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json() as { subscriptionId?: string }
    const { subscriptionId } = body

    if (!subscriptionId) {
      return NextResponse.json({ error: '유효하지 않은 요청입니다.' }, { status: 400 })
    }

    // Verify subscription is active with PayPal
    const subscription = await getSubscription(subscriptionId)
    if (subscription.status !== 'ACTIVE' && subscription.status !== 'APPROVED') {
      return NextResponse.json({ error: '구독이 활성화되지 않았습니다.' }, { status: 400 })
    }

    const plan = planFromPayPalPlanId(subscription.plan_id || '')
    if (!plan) {
      return NextResponse.json({ error: '등록되지 않은 PayPal 요금제입니다.' }, { status: 400 })
    }

    await dbService.updateUserPayPal(user.id, {
      paypalSubscriptionId: subscriptionId,
      paypalSubscriptionStatus: subscription.status,
      plan,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PayPal Activate]', error)
    return NextResponse.json({ error: '구독 활성화에 실패했습니다.' }, { status: 500 })
  }
}
