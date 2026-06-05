'use server'

import { revalidatePath } from 'next/cache'
import prisma from '../../lib/db'
import { requireAdminUser } from '../../lib/admin'

const VALID_PLANS = new Set(['FREE', 'LITE', 'PRO', 'UNLIMITED'])
const VALID_PAYMENT_STATUSES = new Set(['paid', 'cancelled', 'partial_refund', 'failed'])
const VALID_ACCOUNT_STATUSES = new Set(['active', 'blocked'])

export async function addAdminNoteAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const content = stringValue(formData, 'content')
  if (!userId || !content) return

  await prisma.adminNote.create({
    data: {
      userId,
      adminEmail: admin.email,
      content: content.slice(0, 3000),
    },
  })
  await logAdminAction(admin.email, 'admin_note.create', 'user', userId, content)
  revalidatePath(`/admin/users/${userId}`)
}

export async function addCreditsAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const amount = Number(stringValue(formData, 'amount'))
  const reason = stringValue(formData, 'reason') || 'Manual admin adjustment'
  if (!userId || !Number.isInteger(amount) || amount === 0) return

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
}

export async function changeUserPlanAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const plan = stringValue(formData, 'plan').toUpperCase()
  const reason = stringValue(formData, 'reason') || 'Manual plan update'
  if (!userId || !VALID_PLANS.has(plan)) return

  await prisma.user.update({
    where: { id: userId },
    data: { plan },
  })
  await logAdminAction(admin.email, 'user.plan.update', 'user', userId, reason, { plan })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
}

export async function updateAccountStatusAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const status = stringValue(formData, 'status').toLowerCase()
  const reason = stringValue(formData, 'reason') || 'Manual account status update'
  if (!userId || !VALID_ACCOUNT_STATUSES.has(status)) return

  await prisma.user.update({
    where: { id: userId },
    data: { accountStatus: status },
  })
  await logAdminAction(admin.email, `user.status.${status}`, 'user', userId, reason, { status })
  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
}

export async function updatePaymentStatusAction(formData: FormData) {
  const admin = await requireAdminUser()
  const paymentId = stringValue(formData, 'paymentId')
  const status = stringValue(formData, 'status').toLowerCase()
  const refundReason = stringValue(formData, 'refundReason')
  const internalNote = stringValue(formData, 'internalNote')
  if (!paymentId || !VALID_PAYMENT_STATUSES.has(status)) return

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
}

export async function createManualPaymentRecordAction(formData: FormData) {
  const admin = await requireAdminUser()
  const userId = stringValue(formData, 'userId')
  const orderId = stringValue(formData, 'orderId')
  const amount = Number(stringValue(formData, 'amount') || 0)
  const pgTransactionId = stringValue(formData, 'pgTransactionId')
  const status = stringValue(formData, 'status') || 'paid'
  const internalNote = stringValue(formData, 'internalNote')
  if (!userId || !orderId || !VALID_PAYMENT_STATUSES.has(status)) return

  const payment = await prisma.paymentRecord.create({
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
  await logAdminAction(admin.email, 'payment.manual.create', 'payment', payment.id, internalNote, { orderId, amount, status })
  revalidatePath('/admin/payments')
  revalidatePath(`/admin/users/${userId}`)
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
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
