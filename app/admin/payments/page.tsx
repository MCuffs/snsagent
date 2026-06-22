import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import prisma from '../../../lib/db'
import { createManualPaymentRecordAction, updatePaymentStatusAction } from '../actions'
import { AdminFlash, AdminPageHeader, EmptyState, Section, Td, Th } from '../_components/AdminShell'
import { AdminPagination } from '../_components/AdminPagination'
import { AdminSubmitButton } from '../_components/AdminSubmitButton'
import { btnCls, dateRange, formatCurrency, formatDate, formatPlan, inputCls, parseAdminPage, parseAdminPageSize, statusPill } from '../_components/adminUtils'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string
    status?: string
    provider?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
    message?: string
    error?: string
  }>
}) {
  const params = await searchParams
  const email = params?.email?.trim() || ''
  const status = params?.status?.trim() || ''
  const provider = params?.provider?.trim() || ''
  const from = params?.from?.trim() || ''
  const to = params?.to?.trim() || ''
  const page = parseAdminPage(params?.page)
  const pageSize = parseAdminPageSize(params?.pageSize)
  const returnParams = new URLSearchParams()
  for (const [key, value] of Object.entries({ email, status, provider, from, to })) {
    if (value) returnParams.set(key, value)
  }
  returnParams.set('page', String(page))
  returnParams.set('pageSize', String(pageSize))
  const paymentReturnTo = `/admin/payments?${returnParams.toString()}`
  const where: Prisma.PaymentRecordWhereInput = {
    ...(status ? { status } : {}),
    ...(provider ? { provider } : {}),
    ...(email ? { user: { email: { contains: email, mode: 'insensitive' } } } : {}),
    ...(dateRange(from, to) ? { createdAt: dateRange(from, to) } : {}),
  }

  const [payments, total, users] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.paymentRecord.count({ where }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, email: true, plan: true },
    }),
  ])

  const statusOptions = ['paid', 'cancelled', 'partial_refund', 'failed']

  return (
    <>
      <AdminPageHeader title="결제 운영 기록" description="Polar 결제·환불 웹훅 기록과 내부 수동 기록을 함께 조회합니다." />
      <AdminFlash message={params?.message} error={params?.error} />

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Polar 기록은 웹훅이 자동 관리하므로 읽기 전용입니다. 아래 상태 수정 기능은 수동 기록에만 적용됩니다.
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <Section title="필터">
          <form className="flex flex-wrap gap-2">
            <input name="email" defaultValue={email} placeholder="이메일 검색" className={`${inputCls} w-56`} />
            <select name="status" defaultValue={status} className={`${inputCls} w-44`}>
              <option value="">전체 상태</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="provider" defaultValue={provider} className={`${inputCls} w-40`}>
              <option value="">전체 공급자</option>
              <option value="polar">Polar</option>
              <option value="manual">수동 기록</option>
            </select>
            <input type="date" name="from" defaultValue={from} aria-label="기록 시작일" className={`${inputCls} w-auto`} />
            <input type="date" name="to" defaultValue={to} aria-label="기록 종료일" className={`${inputCls} w-auto`} />
            <select name="pageSize" defaultValue={String(pageSize)} className={`${inputCls} w-28`}>
              {[25, 50, 100].map(value => <option key={value} value={value}>{value}개</option>)}
            </select>
            <button className={btnCls}>필터</button>
            <Link href="/admin/payments" className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-bold hover:bg-[#f5f5f5]">초기화</Link>
          </form>
        </Section>

        <Section title="내부 결제 기록 생성">
          <form action={createManualPaymentRecordAction} className="space-y-2">
            <input type="hidden" name="returnTo" value={paymentReturnTo} />
            <select name="userId" className={inputCls} required>
              <option value="">사용자 선택</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.email} ({formatPlan(u.plan)})</option>)}
            </select>
            <input name="orderId" placeholder="주문 ID" className={inputCls} required />
            <input name="amount" placeholder="금액 (KRW)" className={inputCls} />
            <input name="pgTransactionId" placeholder="PG 거래 ID" className={inputCls} />
            <select name="status" defaultValue="paid" className={inputCls}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input name="internalNote" placeholder="내부 메모" className={inputCls} />
            <AdminSubmitButton className={`${btnCls} w-full`} pendingLabel="생성 중…">내부 기록 생성</AdminSubmitButton>
          </form>
        </Section>
      </div>

      <Section title={`결제 기록 ${total.toLocaleString()}건`}>
        {payments.length === 0 ? (
          <EmptyState>결제 기록이 없습니다.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead className="border-b border-[#f0f0f0]">
                <tr>
                  <Th>주문 ID</Th>
                  <Th>사용자</Th>
                  <Th>공급자</Th>
                  <Th>금액</Th>
                  <Th>환불액</Th>
                  <Th>PG 거래 ID</Th>
                  <Th>상태</Th>
                  <Th>결제일</Th>
                  <Th>환불일</Th>
                  <Th>내부 기록 수정</Th>
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
                    <Td><span className={statusPill(payment.provider)}>{payment.provider}</span></Td>
                    <Td className="font-semibold">{formatCurrency(payment.amount, payment.currency)}</Td>
                    <Td className="font-semibold text-red-600">{payment.refundedAmount > 0 ? formatCurrency(payment.refundedAmount, payment.currency) : '-'}</Td>
                    <Td className="text-[#888]">{payment.pgTransactionId || '-'}</Td>
                    <Td><span className={statusPill(payment.status)}>{payment.status}</span></Td>
                    <Td className="text-[#888]">{formatDate(payment.paidAt)}</Td>
                    <Td className="text-[#888]">{formatDate(payment.refundedAt)}</Td>
                    <Td>
                      {payment.provider === 'manual' ? (
                        <form action={updatePaymentStatusAction} className="flex flex-col gap-1.5 min-w-[220px]">
                        <input type="hidden" name="returnTo" value={paymentReturnTo} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <select name="status" defaultValue={payment.status} className={inputCls}>
                          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input name="refundReason" defaultValue={payment.refundReason || ''} placeholder="환불/조정 사유" className={inputCls} />
                        <input name="internalNote" defaultValue={payment.internalNote || ''} placeholder="내부 메모" className={inputCls} />
                        <AdminSubmitButton
                          className="rounded-lg border border-[#ddd] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#f5f5f5]"
                          pendingLabel="저장 중…"
                        >
                          내부 상태 저장
                        </AdminSubmitButton>
                        </form>
                      ) : (
                        <span className="text-xs text-[#aaa]">웹훅 자동 동기화</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <AdminPagination
        basePath="/admin/payments"
        page={page}
        pageSize={pageSize}
        total={total}
        query={{ email, status, provider, from, to }}
      />
    </>
  )
}
