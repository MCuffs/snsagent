import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { stripe, STRIPE_PRICE_IDS } from '../../../../lib/stripe'
import { dbService } from '../../../../lib/db-service'
import { isSubscriptionPlan } from '../../../../lib/limits-types'
import { getAppBaseUrl } from '../../../../lib/env'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json() as { plan?: string }
    const plan = body.plan

    if (!plan || !isSubscriptionPlan(plan) || plan === 'FREE') {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
    }

    const priceId = STRIPE_PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json(
        { error: `${plan} 플랜의 Stripe Price ID가 설정되지 않았습니다.` },
        { status: 500 }
      )
    }

    const baseUrl = getAppBaseUrl(request)

    // Reuse existing Stripe customer or create new one
    let customerId = user.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await dbService.updateUserStripeCustomerId(user.id, customerId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?success=1`,
      cancel_url: `${baseUrl}/billing?canceled=1`,
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
      locale: 'ko',
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe Checkout]', error)
    const message = error instanceof Error ? error.message : '결제 세션 생성에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
