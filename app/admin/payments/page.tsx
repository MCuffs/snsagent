import Link from 'next/link'
import prisma from '../../../lib/db'
import { createManualPaymentRecordAction, updatePaymentStatusAction } from '../actions'
import { AdminPageHeader, EmptyState, Section, Td, Th, btnCls, formatCurrency, formatDate, inputCls, statusPill } from '../_components/AdminShell'

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
      take: 200,
      select: { id: true, email: true, plan: true },
    }),
  ])

  const statusOptions = ['paid', 'cancelled', 'partial_refund', 'failed']

  return (
    <>
      <AdminPageHeader title="결제 관리" description="수동 결제 기록 생성 및 환불 처리" />

      <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <Section title="필터">
          <form className="flex flex-wrap gap-2">
            <input name="email" defaultValue={email} placeholder="이메일 검색" className={`${inputCls} w-56`} />
            <select name="status" defaultValue={status} className={`${inputCls} w-44`}>
              <option value="">전체 상태</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className={btnCls}>필터</button>
          </form>
        </Section>

        <Section title="수동 결제 기록 생성">
          <form action={createManualPaymentRecordAction} className="space-y-2">
            <select name="userId" className={inputCls} required>
              <option value="">사용자 선택</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email} ({u.plan})</option>)}
            </select>
            <input name="orderId" placeholder="주문 ID" className={inputCls} required />
            <input name="amount" placeholder="금액 (KRW)" className={inputCls} />
            <input name="pgTransactionId" placeholder="PG 거래 ID" className={inputCls} />
            <select name="status" defaultValue="paid" className={inputCls}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input name="internalNote" placeholder="내부 메모" className={inputCls} />
            <button className={`${btnCls} w-full`}>기록 생성</button>
          </form>
        </Section>
      </div>

      <Section title={`결제 기록 ${payments.length}건`}>
        {payments.length === 0 ? (
          <EmptyState>결제 기록이 없습니다.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-[#f0f0f0]">
                <tr>
                  <Th>주문 ID</Th>
                  <Th>사용자</Th>
                  <Th>금액</Th>
                  <Th>PG 거래 ID</Th>
                  <Th>상태</Th>
                  <Th>결제일</Th>
                  <Th>환불일</Th>
                  <Th>수정</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f5]">
                {payments.map(payment => (
                  <tr key={payment.id} className="align-top hover:bg-[#fafafa]">
                    <Td className="font-mono text-xs">{payment.orderId}</Td>
                    <Td>
                      <Link href={`/admin/users/${payment.userId}`} prefetch className="font-semibold text-blue-600 hover:underline">
                        {payment.user.email}
                      </Link>
                    </Td>
                    <Td className="font-semibold">{formatCurrency(payment.amount)}</Td>
                    <Td className="text-[#888]">{payment.pgTransactionId || '-'}</Td>
                    <Td><span className={statusPill(payment.status)}>{payment.status}</span></Td>
                    <Td className="text-[#888]">{formatDate(payment.paidAt)}</Td>
                    <Td className="text-[#888]">{formatDate(payment.refundedAt)}</Td>
                    <Td>
                      <form action={updatePaymentStatusAction} className="flex flex-col gap-1.5 min-w-[220px]">
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <select name="status" defaultValue={payment.status} className={inputCls}>
                          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input name="refundReason" defaultValue={payment.refundReason || ''} placeholder="환불 사유" className={inputCls} />
                        <input name="internalNote" defaultValue={payment.internalNote || ''} placeholder="내부 메모" className={inputCls} />
                        <button className="rounded-lg border border-[#ddd] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f5f5f5]">저장</button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
