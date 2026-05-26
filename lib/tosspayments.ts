import { createHash } from 'crypto'
import { PRICING_PLANS, SubscriptionPlan } from './limits-types'

const TOSS_BASE_URL = 'https://api.tosspayments.com'

export type PaidPlan = Exclude<SubscriptionPlan, 'FREE'>

const PLAN_AMOUNTS: Record<PaidPlan, number> = {
  LITE: 3000,
  PRO: 19000,
  UNLIMITED: 45000,
}

export function isPaidPlan(plan: string | null): plan is PaidPlan {
  return plan === 'LITE' || plan === 'PRO' || plan === 'UNLIMITED'
}

export function tossPlanOrder(plan: PaidPlan) {
  return {
    amount: PLAN_AMOUNTS[plan],
    orderName: `Shuffla ${PRICING_PLANS[plan].name} monthly subscription`,
  }
}

function getAuthorizationHeader() {
  const secretKey = process.env.TOSS_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('TOSS_SECRET_KEY must be set')
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

async function callToss<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${TOSS_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string }
    throw new TossPaymentsError(
      response.status,
      error.code || 'TOSS_REQUEST_FAILED',
      error.message || `Toss Payments request failed: ${response.status}`,
    )
  }

  if (response.status === 204 || init.method === 'DELETE') return undefined as T
  return response.json() as Promise<T>
}

export class TossPaymentsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'TossPaymentsError'
  }
}

export interface TossBillingAuthorization {
  billingKey: string
  customerKey: string
  method: string
}

export interface TossPayment {
  paymentKey: string
  orderId: string
  status: string
  totalAmount: number
}

export async function issueBillingKey(authKey: string, customerKey: string) {
  return callToss<TossBillingAuthorization>('/v1/billing/authorizations/issue', {
    method: 'POST',
    body: JSON.stringify({ authKey, customerKey }),
  })
}

export async function approveBillingPayment(input: {
  billingKey: string
  customerKey: string
  orderId: string
  plan: PaidPlan
  customerEmail?: string
  customerName?: string | null
}) {
  const order = tossPlanOrder(input.plan)
  return callToss<TossPayment>(`/v1/billing/${encodeURIComponent(input.billingKey)}`, {
    method: 'POST',
    body: JSON.stringify({
      customerKey: input.customerKey,
      orderId: input.orderId,
      orderName: order.orderName,
      amount: order.amount,
      customerEmail: input.customerEmail,
      customerName: input.customerName || undefined,
    }),
  })
}

export async function findPaymentByOrderId(orderId: string) {
  try {
    return await callToss<TossPayment>(`/v1/payments/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
    })
  } catch (error) {
    if (error instanceof TossPaymentsError && error.status === 404) return null
    throw error
  }
}

export async function deleteBillingKey(billingKey: string) {
  await callToss<void>(`/v1/billing/${encodeURIComponent(billingKey)}`, {
    method: 'DELETE',
  })
}

export function createTossOrderId(scope: 'start' | 'renew', seed: string) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 28)
  return `shuffla_${scope}_${digest}`
}

export function nextMonthlyBillingDate(from: Date) {
  const next = new Date(from)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}
