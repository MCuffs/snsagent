import { User } from './db-service'
import { normalizePlan } from './limits-types'
import {
  createNicepayOrderId,
  isPaidPlan,
  issueBillingKey,
  nextMonthlyBillingDate,
  NicepayError,
  PaidPlan,
  PLAN_AMOUNTS,
  serverApprove,
} from './nicepay'

export interface NicepayApprovalInput {
  tid?: string
  authToken?: string
  orderId?: string
  plan?: string
}

export type NicepayApprovalResult =
  | { ok: true; offer?: 'regeneration' }
  | { ok: false; status: number; error: string; offer?: 'regeneration' }

export async function approveNicepayPaymentForUser(
  user: User,
  input: NicepayApprovalInput,
  updateUserNicepay: (userId: string, data: {
    nicepayBid?: string | null
    nicepaySubscriptionStatus?: string | null
    nicepayNextBillingAt?: Date | null
    nicepayLastPaidAt?: Date | null
    nicepayCanceledAt?: Date | null
    nicepayLastOrderId?: string | null
    plan?: string
  }) => Promise<void>,
): Promise<NicepayApprovalResult> {
  const { tid, authToken, orderId, plan } = input

  if (!tid || !authToken || !orderId || !isPaidPlan(plan ?? null)) {
    return { ok: false, status: 400, error: '결제 인증 정보가 올바르지 않습니다.' }
  }

  const validPlan = plan as PaidPlan

  if (
    user.tossSubscriptionStatus === 'ACTIVE' ||
    user.paypalSubscriptionId ||
    user.nicepaySubscriptionStatus === 'ACTIVE'
  ) {
    return { ok: false, status: 409, error: '이미 활성 구독이 있습니다.' }
  }

  if (validPlan === 'LITE' && normalizePlan(user.plan) === 'LITE') {
    return { ok: false, status: 409, error: '이미 사용 가능한 1회권이 있습니다.', offer: 'regeneration' }
  }

  const expectedAmount = PLAN_AMOUNTS[validPlan]
  console.log(`[NicePay Approve] user=${user.id} plan=${validPlan} amount=${expectedAmount} tid=${tid}`)

  const approveResult = await serverApprove({ tid, amount: expectedAmount, orderId })

  if (approveResult.resultCode !== '0000') {
    console.error(`[NicePay Approve] Payment approval failed: code=${approveResult.resultCode} msg=${approveResult.resultMsg}`)
    return {
      ok: false,
      status: 400,
      error: approveResult.resultMsg || `결제 승인에 실패했습니다. (코드: ${approveResult.resultCode})`,
    }
  }

  const paidAt = new Date()

  if (validPlan === 'LITE') {
    await updateUserNicepay(user.id, {
      plan: validPlan,
      nicepayBid: null,
      nicepaySubscriptionStatus: null,
      nicepayLastPaidAt: paidAt,
      nicepayNextBillingAt: null,
      nicepayCanceledAt: null,
      nicepayLastOrderId: orderId,
    })
    return { ok: true, offer: 'regeneration' }
  }

  try {
    const registOrderId = createNicepayOrderId('regist', `${user.id}:${orderId}`)
    console.log(`[NicePay Approve] Issuing billing key for user=${user.id} registOrderId=${registOrderId}`)
    const billing = await issueBillingKey(authToken, registOrderId)

    await updateUserNicepay(user.id, {
      plan: validPlan,
      nicepayBid: billing.bid,
      nicepaySubscriptionStatus: 'ACTIVE',
      nicepayLastPaidAt: paidAt,
      nicepayNextBillingAt: nextMonthlyBillingDate(paidAt),
      nicepayCanceledAt: null,
      nicepayLastOrderId: orderId,
    })
    console.log(`[NicePay Approve] Subscription activated for user=${user.id} plan=${validPlan}`)
  } catch (error) {
    console.error('[NicePay BID Issue Failed]', error)
    await updateUserNicepay(user.id, {
      nicepayBid: null,
      nicepaySubscriptionStatus: 'PENDING',
      nicepayLastPaidAt: paidAt,
      nicepayLastOrderId: orderId,
    })
    return {
      ok: false,
      status: 502,
      error: '결제는 완료되었으나 정기결제 등록에 실패했습니다. 고객센터에 문의해 주세요.',
    }
  }

  return { ok: true }
}

export function nicepayUnexpectedError(error: unknown) {
  console.error('[NicePay Approve] Unexpected error:', error)
  if (error instanceof NicepayError) {
    console.error(`[NicePay Approve] NicepayError: code=${error.code} status=${error.status} msg=${error.message}`)
    return { status: 400, error: error.message }
  }
  return { status: 500, error: '결제 처리 중 예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
}
