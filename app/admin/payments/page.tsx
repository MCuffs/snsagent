import Link from 'next/link'
import prisma from '../../../lib/db'
import { createManualPaymentRecordAction, updatePaymentStatusAction } from '../actions'
import { AdminPageHeader, EmptyState, formatCurrency, formatDate, Section, statusPill } from '../_components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; status?: string }>
}) {
  const params = await searchParams
  const email = params?.email?.trim() || ''
  const status = params?.status?.trim() || ''
  const [payments, users] = await Promise.all([
    prisma.paymentRecord.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(email ? { user: { email: { contains: email, mode: 'insensitive' } } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, email: true, plan: true, nicepayLastOrderId: true, nicepaySubscriptionStatus: true, paypalSubscriptionStatus: true },
    }),
  ])

  return (
    <>
      <AdminPageHeader
        eyebrow="Payments"
        title="Payment and refund management"
        description="Record manual payment/refund operations. PG refund execution remains manual in the PG admin page."
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section title="Filters">
          <form className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <input name="email" defaultValue={email} placeholder="User email" className={inputClassName} />
            <select name="status" defaultValue={status} className={inputClassName}>
              <option value="">All statuses</option>
              {['paid', 'cancelled', 'partial_refund', 'failed'].map(item => <option key={item}>{item}</option>)}
            </select>
            <button className="rounded-md bg-[#171412] px-4 text-sm font-black text-white">Filter</button>
          </form>
        </Section>

        <Section title="Create manual payment record">
          <form action={createManualPaymentRecordAction} className="space-y-2">
            <select name="userId" className={inputClassName} required>
              <option value="">Select user</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}
            </select>
            <input name="orderId" placeholder="Order ID" className={inputClassName} required />
            <input name="amount" placeholder="Amount KRW" className={inputClassName} />
            <input name="pgTransactionId" placeholder="PG transaction ID" className={inputClassName} />
            <select name="status" defaultValue="paid" className={inputClassName}>
              {['paid', 'cancelled', 'partial_refund', 'failed'].map(item => <option key={item}>{item}</option>)}
            </select>
            <input name="internalNote" placeholder="Internal note" className={inputClassName} />
            <button className="min-h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-black text-white">Create record</button>
          </form>
        </Section>
      </div>

      <Section title="Manual payment records">
        {payments.length === 0 ? <EmptyState>No manual payment records. Use the form above, or open a user detail page to create one.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[#74675d]">
                <tr>
                  <th className="py-2 pr-3">Order ID</th>
                  <th className="py-2 pr-3">User email</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">PG transaction ID</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Payment date</th>
                  <th className="py-2 pr-3">Refund date</th>
                  <th className="py-2 pr-3">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee8df]">
                {payments.map(payment => (
                  <tr key={payment.id} className="align-top">
                    <td className="py-3 pr-3 font-bold">{payment.orderId}</td>
                    <td className="py-3 pr-3">
                      <Link href={`/admin/users/${payment.userId}`} className="font-bold text-[#1f4f8a] hover:underline">{payment.user.email}</Link>
                    </td>
                    <td className="py-3 pr-3">{formatCurrency(payment.amount)}</td>
                    <td className="py-3 pr-3">{payment.pgTransactionId || '-'}</td>
                    <td className="py-3 pr-3"><span className={statusPill(payment.status)}>{payment.status}</span></td>
                    <td className="py-3 pr-3">{formatDate(payment.paidAt)}</td>
                    <td className="py-3 pr-3">{formatDate(payment.refundedAt)}</td>
                    <td className="py-3 pr-3">
                      <form action={updatePaymentStatusAction} className="grid min-w-[280px] gap-2">
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <select name="status" defaultValue={payment.status} className={inputClassName}>
                          {['paid', 'cancelled', 'partial_refund', 'failed'].map(item => <option key={item}>{item}</option>)}
                        </select>
                        <input name="refundReason" defaultValue={payment.refundReason || ''} placeholder="Refund reason" className={inputClassName} />
                        <input name="internalNote" defaultValue={payment.internalNote || ''} placeholder="Internal note" className={inputClassName} />
                        <button className="min-h-10 rounded-md border border-[#d0c5b8] bg-[#fbfaf7] px-3 text-xs font-black">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="mt-5 rounded-md border border-dashed border-[#d8cec1] bg-[#fbfaf7] p-4 text-sm font-semibold text-[#81756d]">
        TODO: migrate provider webhook/approval events into PaymentRecord automatically. Current workflow is manual PG admin refund followed by status update here.
      </div>
    </>
  )
}

const inputClassName = 'min-h-10 rounded-md border border-[#d9d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#a47d65]'
