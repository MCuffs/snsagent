import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { getSubscription, planFromPayPalPlanId } from '../../../../lib/paypal'
import { dbService } from '../../../../lib/db-service'
import { formatMissingConfigMessage, getPayPalConfigStatus } from '../../../../lib/runtime-diagnostics'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (user.tossBillingKey || user.paypalSubscriptionId) {
      return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
    }
    const config = getPayPalConfigStatus()
    if (!config.ready) {
      return NextResponse.json({ error: formatMissingConfigMessage('PayPal', config.missing) }, { status: 503 })
    }

    const body = await request.json() as { subscriptionId?: string }
    if (!body.subscriptionId) {
      return NextResponse.json({ error: '유효하지 않은 요청입니다.' }, { status: 400 })
    }

    const subscription = await getSubscription(body.subscriptionId)
    if (subscription.status !== 'ACTIVE' && subscription.status !== 'APPROVED') {
      return NextResponse.json({ error: '구독이 활성화되지 않았습니다.' }, { status: 400 })
    }

    if (subscription.custom_id !== user.id) {
      return NextResponse.json({ error: 'Subscription owner does not match the current user.' }, { status: 403 })
    }

    const existingOwner = await dbService.getUserByPayPalSubscriptionId(body.subscriptionId)
    if (existingOwner && existingOwner.id !== user.id) {
      return NextResponse.json({ error: 'Subscription is already linked to another user.' }, { status: 409 })
    }

    const plan = planFromPayPalPlanId(subscription.plan_id || '')
    if (!plan) {
      return NextResponse.json({ error: '등록되지 않은 PayPal 요금제입니다.' }, { status: 400 })
    }

    await dbService.updateUserPayPal(user.id, {
      paypalSubscriptionId: body.subscriptionId,
      paypalSubscriptionStatus: subscription.status,
      plan,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PayPal Activate]', error)
    return NextResponse.json({ error: '구독 활성화에 실패했습니다.' }, { status: 500 })
  }
}
