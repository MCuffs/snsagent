import { createHash, createHmac } from 'crypto'
import { PRICING_PLANS, type SubscriptionPlan } from './limits-types'

const NICEPAY_BASE_URL = 'https://api.nicepay.co.kr'

export type NicePayPlan = Exclude<SubscriptionPlan, 'FREE'>

const PLAN_AMOUNTS: Record<NicePayPlan, number> = {
  LITE: 3000,
  PRO: 19000,
  UNLIMITED: 45000,
}

export function isPaidPlan(plan: string | null): plan is NicePayPlan {
  return plan === 'LITE' || plan === 'PRO' || plan === 'UNLIMITED'
}

function getCredentials() {
  const clientKey = process.env.NICEPAY_CLIENT_KEY?.trim()
  const secretKey = process.env.NICEPAY_SECRET_KEY?.trim()
  if (!clientKey || !secretKey) throw new Error('NICEPAY_CLIENT_KEY and NICEPAY_SECRET_KEY must be set')
  return { clientKey, secretKey }
}

function getAuthorizationHeader() {
  const { clientKey, secretKey } = getCredentials()
  return `Basic ${Buffer.from(`${clientKey}:${secretKey}`).toString('base64')}`
}

async function callNicePay<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${NICEPAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({})) as Record<string, unknown>

  if (!response.ok || (data.resultCode && data.resultCode !== '0000')) {
    throw new NicePayError(
      response.status,
      String(data.resultCode || 'NICEPAY_REQUEST_FAILED'),
      String(data.resultMsg || `NicePay request failed: ${response.status}`),
    )
  }

  return data as T
}

export class NicePayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'NicePayError'
  }
}

// ─── Order ID ────────────────────────────────────────────────────────────────

export function createNicePayOrderId(scope: 'start' | 'renew', seed: string) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 24)
  return `sf_${scope}_${digest}`
}

export function nextMonthlyBillingDate(from: Date) {
  const next = new Date(from)
  next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyNicePayWebhookSignature(payload: string, receivedSignature: string): boolean {
  const { secretKey } = getCredentials()
  const expected = createHmac('sha256', secretKey).update(payload).digest('hex')
  return expected === receivedSignature
}

// ─── Billing (정기결제) ────────────────────────────────────────────────────────

export interface NicePayBillingKeyResponse {
  resultCode: string
  resultMsg: string
  bid: string       // billingKey
  authDate: string
  cardCode: string
  cardName: string
  cardNum: string
}

export interface NicePayPaymentResponse {
  resultCode: string
  resultMsg: string
  tid: string        // transaction ID
  orderId: string
  amount: number
  status: string     // 'paid'
  paidAt: string
}

export interface NicePayCancelResponse {
  resultCode: string
  resultMsg: string
  tid: string
  cancelAmt: number
  status: string
}

// 카드 빌링키 등록 (최초 1회 결제와 함께)
export async function registerBillingKey(params: {
  orderId: string
  amount: number
  goodsName: string
  cardNo: string
  expYear: string
  expMonth: string
  idNo: string       // 생년월일 6자리 또는 사업자번호
  cardPw: string     // 카드 비밀번호 앞 2자리
  buyerEmail?: string
  buyerName?: string
}) {
  return callNicePay<NicePayBillingKeyResponse>('/v1/subscribe/regist', {
    method: 'POST',
    body: JSON.stringify({
      encData: '',  // 직접 카드 정보 전달 방식 (테스트용)
      orderId: params.orderId,
      amount: params.amount,
      goodsName: params.goodsName,
      cardNo: params.cardNo,
      expYear: params.expYear,
      expMonth: params.expMonth,
      idNo: params.idNo,
      cardPw: params.cardPw,
      buyerEmail: params.buyerEmail,
      buyerName: params.buyerName,
    }),
  })
}

// 빌링키로 정기결제 승인
export async function chargeBillingKey(params: {
  bid: string         // billingKey
  orderId: string
  plan: NicePayPlan
  buyerEmail?: string
  buyerName?: string | null
}) {
  const amount = PLAN_AMOUNTS[params.plan]
  const goodsName = `Shuffla ${PRICING_PLANS[params.plan].name} 월 구독`

  return callNicePay<NicePayPaymentResponse>('/v1/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      bid: params.bid,
      orderId: params.orderId,
      amount,
      goodsName,
      buyerEmail: params.buyerEmail,
      buyerName: params.buyerName || undefined,
    }),
  })
}

// 결제 취소
export async function cancelPayment(params: {
  tid: string
  orderId: string
  amount: number
  reason?: string
}) {
  return callNicePay<NicePayCancelResponse>(`/v1/payments/${encodeURIComponent(params.tid)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      orderId: params.orderId,
      amount: params.amount,
      reason: params.reason || '구독 취소',
    }),
  })
}

// 빌링키 삭제
export async function deleteBillingKey(bid: string) {
  return callNicePay<{ resultCode: string; resultMsg: string }>(`/v1/subscribe/${encodeURIComponent(bid)}/expire`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function nicePayPlanAmount(plan: NicePayPlan) {
  return PLAN_AMOUNTS[plan]
}

// ─── Aliases for remote-originated routes (camelCase style) ──────────────────

export type PaidPlan = NicePayPlan
export class NicepayError extends NicePayError {}

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

export function createNicepayOrderId(scope: 'start' | 'regist' | 'renew' | 'expire', seed: string) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 28)
  return `shuffla_${scope}_${digest}`
}

// authToken 방식 빌링키 발급 (NicePay JS SDK 인증 후 콜백)
export async function issueBillingKey(authToken: string, orderId: string): Promise<NicepayBillingKey> {
  return callNicePay<NicepayBillingKey>('/v1/subscribe/regist', {
    method: 'POST',
    body: JSON.stringify({ authToken, orderId }),
  })
}

// 빌링키로 결제 승인 (원격 방식 - approveBillingPayment alias)
export async function approveBillingPayment(params: {
  bid: string
  orderId: string
  plan: NicePayPlan
  buyerName?: string | null
  buyerEmail?: string
}): Promise<NicepayPayment> {
  const amount = PLAN_AMOUNTS[params.plan]
  const goodsName = `Shuffla ${PRICING_PLANS[params.plan].name} 월 구독`
  return callNicePay<NicepayPayment>(`/v1/subscribe/${encodeURIComponent(params.bid)}`, {
    method: 'POST',
    body: JSON.stringify({
      orderId: params.orderId,
      amount,
      goodsName,
      buyerName: params.buyerName || undefined,
      buyerEmail: params.buyerEmail || undefined,
      useShopInterest: false,
    }),
  })
}

// 빌링키 만료 (원격 방식 - expireBillingKey alias)
export async function expireBillingKey(bid: string, orderId: string) {
  return callNicePay<{ resultCode: string; resultMsg: string }>(`/v1/subscribe/${encodeURIComponent(bid)}/expire`, {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  })
}
