import crypto from 'crypto'
import { dbService } from '../../../../lib/db-service'
import prisma from '../../../../lib/db'

export const runtime = 'nodejs'

type FastSpringValue = Record<string, unknown>

function asRecord(value: unknown): FastSpringValue | null {
  return typeof value === 'object' && value !== null ? value as FastSpringValue : null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function extractEmail(data: unknown): string | null {
  const record = asRecord(data)
  if (!record) return null
  const account = asRecord(record.account)
  const accountContact = asRecord(account?.contact)
  const customer = asRecord(record.customer)
  const recipient = asRecord(record.recipient)
  const email =
    getString(accountContact?.email) ||
    getString(account?.email) ||
    getString(customer?.email) ||
    getString(recipient?.email) ||
    getString(record.email)

  if (typeof email === 'string' && email.includes('@')) {
    return email.trim().toLowerCase()
  }
  return null
}

function extractProductPaths(eventType: string, data: unknown): string[] {
  const record = asRecord(data)
  if (!record) return []
  const paths: string[] = []

  if (eventType === 'order.completed') {
    if (Array.isArray(record.items)) {
      for (const item of record.items) {
        const product = asRecord(item)?.product
        if (product) {
          if (typeof product === 'string') {
            paths.push(product)
          } else if (typeof product === 'object' && product !== null) {
            const productRecord = asRecord(product)
            const path = getString(productRecord?.product) || getString(productRecord?.name)
            if (path) paths.push(path)
          }
        }
      }
    }
  } else {
    if (record.product) {
      if (typeof record.product === 'string') {
        paths.push(record.product)
      } else if (typeof record.product === 'object' && record.product !== null) {
        const productRecord = asRecord(record.product)
        const path = getString(productRecord?.product) || getString(productRecord?.name)
        if (path) paths.push(path)
      }
    }
  }

  return paths
}

function detectPlanFromProduct(productPath: string): 'creator' | 'studio' | null {
  const pathLower = productPath.toLowerCase()
  if (pathLower.includes('creator') || pathLower.includes('pro')) {
    return 'creator'
  }
  if (pathLower.includes('studio') || pathLower.includes('unlimited')) {
    return 'studio'
  }
  return null
}

async function updateSubscriptionPlan(email: string, plan: 'creator' | 'studio' | 'free') {
  // Plan mapping for Shuffla standard User model
  let prismaPlan = 'FREE'
  if (plan === 'creator') prismaPlan = 'PRO'
  else if (plan === 'studio') prismaPlan = 'UNLIMITED'

  console.log(`[FastSpring Webhook] Updating plan for ${email} to ${plan} (Prisma: ${prismaPlan})`)

  // 1. Update standard User model using Prisma via dbService
  try {
    const user = await dbService.getUserByEmail(email)
    if (user) {
      await dbService.updateUserPlan(user.id, prismaPlan)
      console.log(`[FastSpring Webhook] Successfully updated User ${email} to plan ${prismaPlan}`)
    } else {
      console.warn(`[FastSpring Webhook] User not found with email ${email} in User table`)
    }
  } catch (err) {
    console.error(`[FastSpring Webhook] Failed to update standard User table:`, err)
  }

  // 2. Update profiles table using raw SQL fallback (as requested by user)
  try {
    // We execute a raw query in case there is a direct 'profiles' table on Supabase public schema
    await prisma.$executeRawUnsafe(
      `UPDATE "profiles" SET "plan" = $1 WHERE "email" = $2`,
      plan, // 'creator', 'studio', or 'free' as exact string
      email
    )
    console.log(`[FastSpring Webhook] Successfully updated profiles table for ${email} to plan ${plan}`)
  } catch (err) {
    // Skip logging stack trace since profiles table might not exist in Prisma schema or DB
    console.log(`[FastSpring Webhook] profiles table raw update skipped:`, (err as Error).message)
  }
}

export async function POST(request: Request) {
  const secret = process.env.FASTSPRING_WEBHOOK_SECRET
  if (!secret) {
    console.error('[FastSpring Webhook] FASTSPRING_WEBHOOK_SECRET is not configured')
    return Response.json(
      { success: false, error: 'FASTSPRING_WEBHOOK_SECRET is not configured.' },
      { status: 500 }
    )
  }

  // 1. Get raw request body for signature verification
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch (err) {
    console.error('[FastSpring Webhook] Failed to read request body:', err)
    return Response.json({ success: false, error: 'Failed to read body' }, { status: 400 })
  }

  // 2. Get signature header
  const signature = request.headers.get('x-fs-signature') || request.headers.get('X-FS-Signature')
  if (!signature) {
    console.warn('[FastSpring Webhook] Missing signature header')
    return Response.json({ success: false, error: 'Missing signature' }, { status: 400 })
  }

  // 3. Verify signature
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(rawBody)
  const computedSignature = hmac.digest('base64')

  if (computedSignature !== signature) {
    console.warn('[FastSpring Webhook] Signature verification failed')
    return Response.json({ success: false, error: 'Invalid signature' }, { status: 401 })
  }

  // 4. Parse events
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch (err) {
    console.error('[FastSpring Webhook] Failed to parse JSON body:', err)
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const events = asRecord(payload)?.events
  if (!events || !Array.isArray(events)) {
    console.warn('[FastSpring Webhook] Missing events array in payload')
    return Response.json({ success: true, message: 'No events processed' }, { status: 200 })
  }

  console.log(`[FastSpring Webhook] Processing ${events.length} event(s)`)

  for (const event of events) {
    const eventType = event.type
    const eventId = event.id
    if (!eventType) continue

    console.log(`[FastSpring Webhook] Event ID: ${eventId}, Type: ${eventType}`)

    try {
      if (
        eventType === 'order.completed' ||
        eventType === 'subscription.activated'
      ) {
        const email = extractEmail(event.data)
        if (!email) {
          console.warn(`[FastSpring Webhook] No email found in event ${eventId}`)
          continue
        }
        const productPaths = extractProductPaths(eventType, event.data)
        let resolvedPlan: 'creator' | 'studio' | null = null
        for (const path of productPaths) {
          const plan = detectPlanFromProduct(path)
          if (plan) {
            resolvedPlan = plan
            break
          }
        }
        if (resolvedPlan) {
          await updateSubscriptionPlan(email, resolvedPlan)
        } else {
          console.warn(`[FastSpring Webhook] No matching plan found for product paths:`, productPaths)
        }
      } else if (
        eventType === 'subscription.canceled' ||
        eventType === 'subscription.deactivated'
      ) {
        const email = extractEmail(event.data)
        if (!email) {
          console.warn(`[FastSpring Webhook] No email found in event ${eventId}`)
          continue
        }
        await updateSubscriptionPlan(email, 'free')
      } else {
        console.log(`[FastSpring Webhook] Ignored event type: ${eventType}`)
      }
    } catch (err) {
      console.error(`[FastSpring Webhook] Error processing event ${eventId}:`, err)
    }
  }

  return Response.json({ success: true }, { status: 200 })
}
