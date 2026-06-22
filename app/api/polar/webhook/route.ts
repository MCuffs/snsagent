import { NextRequest, NextResponse } from 'next/server'
import { verifyPolarWebhook, planFromPolarProductId } from '../../../../lib/polar'
import { dbService } from '../../../../lib/db-service'
import prisma from '../../../../lib/db'
import {
  paymentStatusFromPolarOrder,
  polarCentsToMajorUnits,
  polarOrderTimestamp,
  type PolarOrderWebhookData,
} from '../../../../lib/polar-orders'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 })
  }

  const headers = {
    'webhook-id': request.headers.get('webhook-id') ?? undefined,
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? undefined,
    'webhook-signature': request.headers.get('webhook-signature') ?? undefined,
  }

  const valid = await verifyPolarWebhook(rawBody, headers)
  if (!valid) {
    console.warn('[Polar Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: { type: string; timestamp?: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data } = event
  console.log(`[Polar Webhook] ${type}`)

  try {
    if (type === 'order.paid' || type === 'order.refunded') {
      await syncPolarOrder(type, data as PolarOrderWebhookData, event.timestamp)
    } else if (type === 'subscription.active' || type === 'subscription.created') {
      const subscriptionId = data.id as string | undefined
      const productId = (data.product_id ?? (data.product as { id?: string } | undefined)?.id) as string | undefined
      const customerEmail = (data.customer as { email?: string } | undefined)?.email
      const userId = (data.metadata as Record<string, string> | undefined)?.userId

      if (!subscriptionId || !productId || !customerEmail) {
        console.warn('[Polar Webhook] Missing required fields', { subscriptionId, productId, customerEmail })
        return NextResponse.json({ received: true })
      }

      const plan = planFromPolarProductId(productId)
      if (!plan) {
        console.warn('[Polar Webhook] Unknown product id', productId)
        return NextResponse.json({ received: true })
      }

      // Prefer userId from metadata, fallback to email lookup
      let user = userId ? await dbService.getUser(userId) : null
      if (!user) user = await dbService.getUserByEmail(customerEmail)
      if (!user) {
        console.warn('[Polar Webhook] User not found', { userId, customerEmail })
        return NextResponse.json({ received: true })
      }

      // Idempotency: skip if already on this subscription
      if (user.polarSubscriptionId === subscriptionId) {
        return NextResponse.json({ received: true })
      }

      await dbService.updateUserPolar(user.id, {
        polarSubscriptionId: subscriptionId,
        polarSubscriptionStatus: 'active',
        plan,
      })
      console.log(`[Polar Webhook] Activated ${plan} for user ${user.id}`)
    } else if (
      type === 'subscription.canceled' ||
      type === 'subscription.revoked'
    ) {
      const subscriptionId = data.id as string | undefined
      if (!subscriptionId) return NextResponse.json({ received: true })

      const user = await dbService.getUserByPolarSubscriptionId(subscriptionId)
      if (!user) return NextResponse.json({ received: true })

      await dbService.updateUserPolar(user.id, {
        polarSubscriptionId: null,
        polarSubscriptionStatus: type === 'subscription.revoked' ? 'revoked' : 'canceled',
        plan: 'FREE',
      })
      console.log(`[Polar Webhook] Downgraded user ${user.id} to FREE (${type})`)
    } else if (type === 'subscription.updated' || type === 'subscription.uncanceled') {
      const subscriptionId = data.id as string | undefined
      const status = data.status as string | undefined
      if (!subscriptionId || !status) return NextResponse.json({ received: true })

      const user = await dbService.getUserByPolarSubscriptionId(subscriptionId)
      if (!user) return NextResponse.json({ received: true })

      await dbService.updateUserPolar(user.id, { polarSubscriptionStatus: status })
      console.log(`[Polar Webhook] Updated status to ${status} for user ${user.id}`)
    }
  } catch (err) {
    console.error('[Polar Webhook] Handler error', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function syncPolarOrder(
  type: 'order.paid' | 'order.refunded',
  order: PolarOrderWebhookData,
  eventTimestamp?: string,
) {
  if (!order.id || !order.customer) {
    throw new Error(`Invalid ${type} payload: missing order id or customer`)
  }

  const metadataUserId = typeof order.metadata?.userId === 'string' ? order.metadata.userId : null
  const externalUserId = order.customer.external_id || null
  const customerEmail = order.customer.email || null

  let user = metadataUserId
    ? await prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true } })
    : null
  if (!user && externalUserId) {
    user = await prisma.user.findUnique({ where: { id: externalUserId }, select: { id: true } })
  }
  if (!user && customerEmail) {
    user = await prisma.user.findUnique({ where: { email: customerEmail }, select: { id: true } })
  }
  if (!user && order.subscription_id) {
    user = await prisma.user.findUnique({
      where: { polarSubscriptionId: order.subscription_id },
      select: { id: true },
    })
  }
  if (!user) {
    throw new Error(`Unable to resolve Shuffla user for Polar order ${order.id}`)
  }

  const amount = polarCentsToMajorUnits(order.total_amount)
  const refundedAmount = polarCentsToMajorUnits(order.refunded_amount)
  const occurredAt = polarOrderTimestamp(order, eventTimestamp)
  const status = paymentStatusFromPolarOrder(order)
  const currency = (order.currency || 'krw').toLowerCase()

  await prisma.paymentRecord.upsert({
    where: { orderId: order.id },
    create: {
      userId: user.id,
      orderId: order.id,
      provider: 'polar',
      amount,
      currency,
      refundedAmount,
      pgTransactionId: order.checkout_id || order.id,
      status,
      paidAt: type === 'order.paid'
        ? occurredAt
        : polarOrderTimestamp(order, order.created_at),
      refundedAt: refundedAmount > 0 ? occurredAt : null,
    },
    update: {
      userId: user.id,
      provider: 'polar',
      amount,
      currency,
      refundedAmount,
      pgTransactionId: order.checkout_id || order.id,
      status,
      ...(type === 'order.paid' ? { paidAt: occurredAt } : {}),
      refundedAt: refundedAmount > 0 ? occurredAt : null,
    },
  })

  console.log(`[Polar Webhook] Synced ${type} for order ${order.id}`)
}
