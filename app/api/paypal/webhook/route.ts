import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { planFromPayPalPlanId, verifyWebhookSignature } from '../../../../lib/paypal'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headers: Record<string, string> = {}
  for (const key of [
    'paypal-auth-algo',
    'paypal-cert-url',
    'paypal-transmission-id',
    'paypal-transmission-sig',
    'paypal-transmission-time',
  ]) {
    headers[key] = request.headers.get(key) ?? ''
  }

  if (!await verifyWebhookSignature(body, headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: { event_type: string; resource: { id?: string; status?: string; plan_id?: string; custom_id?: string } }
  try {
    event = JSON.parse(body) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const subscriptionId = event.resource.id
    if (!subscriptionId) return NextResponse.json({ received: true })
    let user = await dbService.getUserByPayPalSubscriptionId(subscriptionId)

    if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' && !user && event.resource.custom_id) {
      user = await dbService.getUser(event.resource.custom_id)
      const plan = planFromPayPalPlanId(event.resource.plan_id || '')
      if (user && plan && !user.tossBillingKey && !user.paypalSubscriptionId) {
        await dbService.updateUserPayPal(user.id, {
          paypalSubscriptionId: subscriptionId,
          paypalSubscriptionStatus: 'ACTIVE',
          plan,
        })
      }
      return NextResponse.json({ received: true })
    }

    if (!user) return NextResponse.json({ received: true })

    if (
      event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED' ||
      event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED'
    ) {
      await dbService.updateUserPayPal(user.id, {
        paypalSubscriptionId: null,
        paypalSubscriptionStatus: 'CANCELLED',
        plan: 'FREE',
      })
    } else if (event.event_type === 'BILLING.SUBSCRIPTION.UPDATED') {
      await dbService.updateUserPayPal(user.id, {
        paypalSubscriptionStatus: event.resource.status || 'ACTIVE',
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[PayPal Webhook]', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
