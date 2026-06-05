import { notFound } from 'next/navigation'
import prisma from '../../../../lib/db'
import {
  addAdminNoteAction,
  addCreditsAction,
  changeUserPlanAction,
  createManualPaymentRecordAction,
  updateAccountStatusAction,
} from '../../actions'
import { AdminPageHeader, EmptyState, formatCurrency, formatDate, Section, statusPill } from '../../_components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      campaigns: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { slides: { select: { id: true } } },
      },
      paymentRecords: { orderBy: { createdAt: 'desc' }, take: 20 },
      creditLedger: { orderBy: { createdAt: 'desc' }, take: 50 },
      adminNotes: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!user) notFound()

  const creditBalance = user.creditLedger.reduce((sum, item) => sum + item.amount, 0)
  const accountStatus = user.accountStatus || 'active'

  return (
    <>
      <AdminPageHeader
        eyebrow="User detail"
        title={user.email}
        description="Operational timeline, payment records, credit adjustments, and internal notes for this account."
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Section title="Basic information">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Name" value={user.name || '-'} />
              <Info label="Plan" value={user.plan} />
              <Info label="Status" value={accountStatus} />
              <Info label="Credit balance" value={String(creditBalance)} />
              <Info label="Signup date" value={formatDate(user.createdAt)} />
              <Info label="Updated at" value={formatDate(user.updatedAt)} />
              <Info label="NicePay status" value={user.nicepaySubscriptionStatus || '-'} />
              <Info label="PayPal status" value={user.paypalSubscriptionStatus || '-'} />
            </dl>
          </Section>

          <Section title="Generation history">
            {user.campaigns.length === 0 ? <EmptyState>No generations yet.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs font-black uppercase tracking-[0.08em] text-[#74675d]">
                    <tr>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Slides</th>
                      <th className="py-2 pr-3">Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8df]">
                    {user.campaigns.map(campaign => (
                      <tr key={campaign.id}>
                        <td className="py-2 pr-3 font-bold">{campaign.title}</td>
                        <td className="py-2 pr-3 text-[#635951]">{formatDate(campaign.createdAt)}</td>
                        <td className="py-2 pr-3"><span className={statusPill(campaign.status)}>{campaign.status}</span></td>
                        <td className="py-2 pr-3">{campaign.slides.length || campaign.slideCount}</td>
                        <td className="py-2 pr-3">{campaign.imageModel || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Payment history">
            {user.paymentRecords.length === 0 ? <EmptyState>No manual payment records yet. Existing provider subscription fields are shown in Basic information.</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="text-xs font-black uppercase tracking-[0.08em] text-[#74675d]">
                    <tr>
                      <th className="py-2 pr-3">Order ID</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Paid at</th>
                      <th className="py-2 pr-3">Refunded at</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eee8df]">
                    {user.paymentRecords.map(payment => (
                      <tr key={payment.id}>
                        <td className="py-2 pr-3 font-bold">{payment.orderId}</td>
                        <td className="py-2 pr-3">{formatCurrency(payment.amount)}</td>
                        <td className="py-2 pr-3"><span className={statusPill(payment.status)}>{payment.status}</span></td>
                        <td className="py-2 pr-3">{formatDate(payment.paidAt)}</td>
                        <td className="py-2 pr-3">{formatDate(payment.refundedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Credit ledger">
            {user.creditLedger.length === 0 ? <EmptyState>No credit ledger entries yet.</EmptyState> : (
              <div className="space-y-2">
                {user.creditLedger.map(entry => (
                  <div key={entry.id} className="rounded-md border border-[#eee8df] p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black">{entry.amount > 0 ? '+' : ''}{entry.amount} credits</span>
                      <span className="text-xs font-semibold text-[#81756d]">{formatDate(entry.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-[#6f655d]">{entry.type} · {entry.reason || 'No reason'}</p>
                    {entry.adminEmail && <p className="mt-1 text-xs text-[#94877d]">by {entry.adminEmail}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Admin notes">
            {user.adminNotes.length === 0 ? <EmptyState>No internal notes yet.</EmptyState> : (
              <div className="space-y-3">
                {user.adminNotes.map(note => (
                  <div key={note.id} className="rounded-md bg-[#fbfaf7] p-3 text-sm">
                    <p className="whitespace-pre-line leading-6">{note.content}</p>
                    <p className="mt-2 text-xs font-bold text-[#81756d]">{note.adminEmail} · {formatDate(note.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Add credits manually">
            <form action={addCreditsAction} className="space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <AdminInput name="amount" placeholder="Amount, e.g. 10 or -3" />
              <AdminInput name="reason" placeholder="Reason" />
              <AdminButton>Add credit entry</AdminButton>
            </form>
          </Section>

          <Section title="Change plan manually">
            <form action={changeUserPlanAction} className="space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <select name="plan" defaultValue={user.plan} className={inputClassName}>
                {['FREE', 'LITE', 'PRO', 'UNLIMITED'].map(plan => <option key={plan}>{plan}</option>)}
              </select>
              <AdminInput name="reason" placeholder="Reason" />
              <AdminButton>Update plan</AdminButton>
            </form>
          </Section>

          <Section title="Update account status">
            <form action={updateAccountStatusAction} className="space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <select name="status" defaultValue={accountStatus} className={inputClassName}>
                <option value="active">active</option>
                <option value="blocked">blocked</option>
              </select>
              <AdminInput name="reason" placeholder="Reason" />
              <AdminButton>Save status log</AdminButton>
            </form>
          </Section>

          <Section title="Create manual payment record">
            <form action={createManualPaymentRecordAction} className="space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <AdminInput name="orderId" placeholder="Order ID" />
              <AdminInput name="amount" placeholder="Amount KRW" />
              <AdminInput name="pgTransactionId" placeholder="PG transaction ID" />
              <select name="status" defaultValue="paid" className={inputClassName}>
                {['paid', 'cancelled', 'partial_refund', 'failed'].map(status => <option key={status}>{status}</option>)}
              </select>
              <AdminInput name="internalNote" placeholder="Internal note" />
              <AdminButton>Create payment record</AdminButton>
            </form>
          </Section>

          <Section title="Add internal admin note">
            <form action={addAdminNoteAction} className="space-y-3">
              <input type="hidden" name="userId" value={user.id} />
              <textarea name="content" rows={5} placeholder="Write an internal operational note." className={inputClassName} />
              <AdminButton>Add note</AdminButton>
            </form>
          </Section>
        </div>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.1em] text-[#97897d]">{label}</dt>
      <dd className="mt-1 font-bold text-[#25211e]">{value}</dd>
    </div>
  )
}

const inputClassName = 'min-h-11 w-full rounded-md border border-[#d9d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#a47d65]'

function AdminInput({ name, placeholder }: { name: string; placeholder: string }) {
  return <input name={name} placeholder={placeholder} className={inputClassName} />
}

function AdminButton({ children }: { children: React.ReactNode }) {
  return <button className="min-h-11 w-full rounded-md bg-[#171412] px-4 text-sm font-black text-white">{children}</button>
}
