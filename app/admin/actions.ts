'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import prisma from '../../lib/db'
import { requireAdminUser } from '../../lib/admin'
import { cancelSubscription } from '../../lib/polar'

const VALID_PLANS = new Set(['FREE', 'PRO', 'UNLIMITED'])
const VALID_PAYMENT_STATUSES = new Set(['paid', 'cancelled', 'partial_refund', 'failed'])
const VALID_ACCOUNT_STATUSES = new Set(['active', 'blocked'])

export async function addAdminNoteAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const content = stringValue(formData, 'content')
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/users')
  if (!userId || !content) redirectWithFeedback(returnTo, 'error', '메모 내용을 입력해 주세요.')

  await prisma.adminNote.create({
    data: {
      userId,
      adminEmail: admin.email,
      content: content.slice(0, 3000),
    },
  })
  await logAdminAction(admin.email, 'admin_note.create', 'user', userId, content)
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', '관리자 메모를 저장했습니다.')
}

export async function addCreditsAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const amount = Number(stringValue(formData, 'amount'))
  const reason = stringValue(formData, 'reason') || 'Manual admin adjustment'
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/users')
  if (!userId || !Number.isInteger(amount) || amount === 0) {
    redirectWithFeedback(returnTo, 'error', '0이 아닌 정수 크레딧 수량을 입력해 주세요.')
  }

  await prisma.creditLedger.create({
    data: {
      userId,
      type: amount > 0 ? 'bonus' : 'adjustment',
      amount,
      reason,
      adminEmail: admin.email,
    },
  })
  await logAdminAction(admin.email, 'credit.adjust', 'user', userId, reason, { amount })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', `${amount > 0 ? '+' : ''}${amount} 크레딧을 반영했습니다.`)
}

export async function changeUserPlanAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const plan = stringValue(formData, 'plan').toUpperCase()
  const reason = stringValue(formData, 'reason') || 'Manual plan update'
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/users')
  if (!userId || !VALID_PLANS.has(plan)) redirectWithFeedback(returnTo, 'error', '유효한 플랜을 선택해 주세요.')

  await prisma.user.update({
    where: { id: userId },
    data: { plan },
  })
  await logAdminAction(admin.email, 'user.plan.update', 'user', userId, reason, { plan })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', `플랜을 ${plan}으로 변경했습니다.`)
}

export async function updateAccountStatusAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const status = stringValue(formData, 'status').toLowerCase()
  const reason = stringValue(formData, 'reason') || 'Manual account status update'
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/users')
  if (!userId || !VALID_ACCOUNT_STATUSES.has(status)) redirectWithFeedback(returnTo, 'error', '유효한 계정 상태를 선택해 주세요.')

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: status },
  })
  await logAdminAction(admin.email, `user.status.${status}`, 'user', userId, reason, { status })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', `계정 상태를 ${status}로 변경했습니다.`)
}

export async function updatePaymentStatusAction(formData: FormData) {
  const admin = await requireAdminUser()
  const paymentId = stringValue(formData, 'paymentId')
  const status = stringValue(formData, 'status').toLowerCase()
  const refundReason = stringValue(formData, 'refundReason')
  const internalNote = stringValue(formData, 'internalNote')
  const returnTo = adminReturnTo(formData, '/admin/payments')
  if (!paymentId || !VALID_PAYMENT_STATUSES.has(status)) redirectWithFeedback(returnTo, 'error', '유효한 결제 상태를 선택해 주세요.')

  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    select: { provider: true },
  })
  if (!payment || payment.provider !== 'manual') redirectWithFeedback(returnTo, 'error', '수동 결제 기록만 직접 수정할 수 있습니다.')

  await prisma.paymentRecord.update({
    where: { id: paymentId },
    data: {
      status,
      refundReason: refundReason || null,
      internalNote: internalNote || null,
      refundedAt: status === 'cancelled' || status === 'partial_refund' ? new Date() : null,
      updatedBy: admin.email,
    },
  })
  await logAdminAction(admin.email, 'payment.status.update', 'payment', paymentId, refundReason || internalNote, { status })
  revalidatePath('/admin')
  revalidatePath('/admin/payments')
  redirectWithFeedback(returnTo, 'message', '내부 결제 상태를 저장했습니다.')
}

export async function revokePolarSubscriptionAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const reason = stringValue(formData, 'reason')
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/users')
  if (!userId || !reason) redirectWithFeedback(returnTo, 'error', '즉시 해지 사유를 입력해 주세요.')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { polarSubscriptionId: true, polarSubscriptionStatus: true, plan: true },
  })
  if (!user?.polarSubscriptionId) redirectWithFeedback(returnTo, 'error', '활성 Polar 구독을 찾을 수 없습니다.')

  const subscriptionId = user.polarSubscriptionId
  try {
    await cancelSubscription(subscriptionId)
  } catch (error) {
    if (!(error instanceof Error && error.message.includes('404'))) {
      redirectWithFeedback(returnTo, 'error', 'Polar 구독 해지 요청에 실패했습니다.')
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      polarSubscriptionId: null,
      polarSubscriptionStatus: 'revoked',
      plan: 'FREE',
    },
  })
  await logAdminAction(admin.email, 'polar.subscription.revoke', 'user', userId, reason, {
    subscriptionId,
    previousStatus: user.polarSubscriptionStatus,
    previousPlan: user.plan,
  })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', 'Polar 구독을 즉시 해지하고 Free 플랜으로 전환했습니다.')
}

export async function createManualPaymentRecordAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const orderId = stringValue(formData, 'orderId')
  const amount = Number(stringValue(formData, 'amount') || 0)
  const pgTransactionId = stringValue(formData, 'pgTransactionId')
  const status = stringValue(formData, 'status') || 'paid'
  const internalNote = stringValue(formData, 'internalNote')
  const returnTo = adminReturnTo(formData, userId ? `/admin/users/${userId}` : '/admin/payments')
  if (!userId || !orderId || !VALID_PAYMENT_STATUSES.has(status)) {
    redirectWithFeedback(returnTo, 'error', '사용자, 주문 ID, 결제 상태를 확인해 주세요.')
  }

  let payment
  try {
    payment = await prisma.paymentRecord.create({
      data: {
        userId,
        orderId,
        provider: 'manual',
        amount: Number.isFinite(amount) ? Math.round(amount) : 0,
        pgTransactionId: pgTransactionId || null,
        status,
        paidAt: status === 'paid' ? new Date() : null,
        internalNote: internalNote || null,
        updatedBy: admin.email,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      redirectWithFeedback(returnTo, 'error', '이미 사용 중인 주문 ID입니다.')
    }
    redirectWithFeedback(returnTo, 'error', '내부 결제 기록 생성에 실패했습니다.')
  }
  await logAdminAction(admin.email, 'payment.manual.create', 'payment', payment.id, internalNote, { orderId, amount, status })
  revalidatePath('/admin/payments')
  revalidatePath(`/admin/users/${userId}`)
  redirectWithFeedback(returnTo, 'message', '내부 결제 기록을 생성했습니다.')
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function adminReturnTo(formData: FormData, fallback: string) {
  const value = stringValue(formData, 'returnTo')
  return value.startsWith('/admin') && !value.startsWith('//') ? value : fallback
}

function redirectWithFeedback(path: string, kind: 'message' | 'error', message: string): never {
  const url = new URL(path, 'http://admin.local')
  url.searchParams.delete('message')
  url.searchParams.delete('error')
  url.searchParams.set(kind, message)
  redirect(`${url.pathname}${url.search}`)
}

async function logAdminAction(
  adminEmail: string,
  action: string,
  targetType: string,
  targetId?: string,
  reason?: string,
  metadata?: Record<string, unknown>
) {
  await prisma.adminActionLog.create({
    data: {
      adminEmail,
      action,
      targetType,
      targetId: targetId || null,
      reason: reason || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}
