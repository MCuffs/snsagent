import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyWebhookSignature, planFromPayPalPlanId } from '../../../../lib/paypal'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()

  const headers: Record<string, string> = {}
  for (const key of ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
                      'paypal-transmission-sig', 'paypal-transmission-time']) {
    headers[key] = request.headers.get(key) ?? ''
  }

  const verified = await verifyWebhookSignature(body, headers)
  if (!verified) {
    console.warn('[PayPal Webhook] Signature verification failed')
    // Accept anyway in sandbox mode to allow testing
    if (process.env.PAYPAL_SANDBOX !== 'true') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  }

  let event: { event_type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(body) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const resource = event.resource

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subscriptionId = resource.id as string
        const planId = (resource.plan_id as string) || ''
        const customId = resource.custom_id as string | undefined
        const userId = customId

        if (!userId) break

        const plan = planFromPayPalPlanId(planId) ?? undefined
        await dbService.updateUserPayPal(userId, {
          paypalSubscriptionId: subscriptionId,
          paypalSubscriptionStatus: 'ACTIVE',
          ...(plan ? { plan } : {}),
        })
        break
      }

      case 'BILLING.SUBSCRIPTION.UPDATED': {
        const subscriptionId = resource.id as string
        const status = resource.status as string
        const customId = resource.custom_id as string | undefined
        const userId = customId

        if (!userId) break

        await dbService.updateUserPayPal(userId, {
          paypalSubscriptionId: subscriptionId,
          paypalSubscriptionStatus: status,
        })
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subscriptionId = resource.id as string
        const customId = resource.custom_id as string | undefined
        const userId = customId

        if (!userId) {
          // Try lookup by subscriptionId
          const user = await dbService.getUserByPayPalSubscriptionId(subscriptionId)
          if (!user) break
          await dbService.updateUserPayPal(user.id, {
            paypalSubscriptionId: null,
            paypalSubscriptionStatus: 'CANCELLED',
            plan: 'FREE',
          })
          break
        }

        await dbService.updateUserPayPal(userId, {
          paypalSubscriptionId: null,
          paypalSubscriptionStatus: 'CANCELLED',
          plan: 'FREE',
        })
        break
      }

      case 'PAYMENT.SALE.COMPLETED':
        // Payment confirmed — no action needed, subscription already active
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[PayPal Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
