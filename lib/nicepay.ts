import { createHash } from 'crypto'
import { PRICING_PLANS, SubscriptionPlan } from './limits-types'

const NICEPAY_BASE_URL = 'https://api.nicepay.co.kr'

export type PaidPlan = Exclude<SubscriptionPlan, 'FREE'>

export const PLAN_AMOUNTS: Record<PaidPlan, number> = {
  LITE: 3000,
  PRO: 25000,
  UNLIMITED: 39000,
}

export function isPaidPlan(plan: string | null): plan is PaidPlan {
  return plan === 'LITE' || plan === 'PRO' || plan === 'UNLIMITED'
}

export function nicepayPlanOrder(plan: PaidPlan) {
  return {
    amount: PLAN_AMOUNTS[plan],
    goodsName: `Shuffla ${PRICING_PLANS[plan].name} 월 구독`,
  }
}

function getAuthorizationHeader() {
  const clientKey = process.env.NICEPAY_CLIENT_KEY?.trim()
  const secretKey = process.env.NICEPAY_SECRET_KEY?.trim()
  if (!clientKey || !secretKey) {
    throw new Error('NICEPAY_CLIENT_KEY and NICEPAY_SECRET_KEY must be set')
  }
  return `Basic ${Buffer.from(`${clientKey}:${secretKey}`).toString('base64')}`
}

async function callNicepay<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${NICEPAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  const data = await response.json() as { resultCode?: string; resultMsg?: string } & T

  if (!response.ok || (data.resultCode && data.resultCode !== '0000')) {
    throw new NicepayError(
      response.status,
      data.resultCode || 'NICEPAY_REQUEST_FAILED',
      data.resultMsg || `NicePay request failed: ${response.status}`,
    )
  }

  return data
}

export class NicepayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'NicepayError'
  }
}

export interface NicepayBillingKey {
  bid: string
  cardCode: string
  cardName: string
  cardNo: string
  cardExpire: string
}

export interface NicepayPayment {
  tid: string
  orderId: string
  status: string
  amount: number
}

// Server 승인: 브라우저에서 받은 tid + authToken으로 서버가 직접 승인 처리
export interface NicepayServerApproveResult {
  tid: string
  orderId: string
  status: string
  amount: number
  resultCode: string
  resultMsg: string
}

export async function serverApprove(input: {
  tid: string
  amount: number
  orderId: string
}): Promise<NicepayServerApproveResult> {
  return callNicepay<NicepayServerApproveResult>(`/v1/payments/${encodeURIComponent(input.tid)}`, {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      orderId: input.orderId,
    }),
  })
}

export async function issueBillingKey(authToken: string, orderId: string): Promise<NicepayBillingKey> {
  return callNicepay<NicepayBillingKey>('/v1/subscribe/regist', {
    method: 'POST',
    body: JSON.stringify({ authToken, orderId }),
  })
}

export async function approveBillingPayment(input: {
  bid: string
  orderId: string
  plan: PaidPlan
  buyerName?: string | null
  buyerEmail?: string
}): Promise<NicepayPayment> {
  const order = nicepayPlanOrder(input.plan)
  return callNicepay<NicepayPayment>(`/v1/subscribe/${encodeURIComponent(input.bid)}`, {
    method: 'POST',
    body: JSON.stringify({
      orderId: input.orderId,
      amount: order.amount,
      goodsName: order.goodsName,
      buyerName: input.buyerName || undefined,
      buyerEmail: input.buyerEmail || undefined,
      useShopInterest: false,
    }),
  })
}

export async function expireBillingKey(bid: string, orderId: string) {
  return callNicepay<{ resultCode: string; resultMsg: string }>(`/v1/subscribe/${encodeURIComponent(bid)}/expire`, {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}

export function createNicepayOrderId(scope: 'start' | 'regist' | 'renew' | 'expire', seed: string) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 28)
  return `shuffla_${scope}_${digest}`
}

export function nextMonthlyBillingDate(from: Date) {
  const next = new Date(from)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}
