import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe, planFromPriceId } from '../../../../lib/stripe'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

// Stripe requires raw body for signature verification
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.userId
        const plan = session.metadata?.plan
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!userId || !plan) break

        await dbService.updateUserStripe(userId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeSubscriptionStatus: 'active',
          plan,
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) break

        const priceId = sub.items.data[0]?.price.id
        const plan = priceId ? planFromPriceId(priceId) : null
        const status = sub.status

        await dbService.updateUserStripe(userId, {
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: status,
          ...(plan ? { plan } : {}),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (!userId) break

        await dbService.updateUserStripe(userId, {
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: 'canceled',
          plan: 'FREE',
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const user = await dbService.getUserByStripeCustomerId(customerId)
        if (!user) break

        await dbService.updateUserStripe(user.id, {
          stripeSubscriptionStatus: 'past_due',
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
