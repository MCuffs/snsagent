import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import prisma from '../../../lib/db'
import { AdminPageHeader, EmptyState, Td, Th } from '../_components/AdminShell'
import { AdminPagination } from '../_components/AdminPagination'
import { dateRange, formatDate, formatPlan, inputCls, parseAdminPage, parseAdminPageSize, statusPill } from '../_components/adminUtils'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string
    plan?: string
    status?: string
    polarStatus?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
  }>
}) {
  const params = await searchParams
  const q = params?.q?.trim() || ''
  const plan = params?.plan?.trim() || ''
  const status = params?.status?.trim() || ''
  const polarStatus = params?.polarStatus?.trim() || ''
  const from = params?.from?.trim() || ''
  const to = params?.to?.trim() || ''
  const page = parseAdminPage(params?.page)
  const pageSize = parseAdminPageSize(params?.pageSize)

  const where: Prisma.UserWhereInput = {
    ...(q ? {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
    ...(plan ? { plan } : {}),
    ...(status ? { accountStatus: status } : {}),
    ...(polarStatus ? { polarSubscriptionStatus: polarStatus } : {}),
    ...(dateRange(from, to) ? { createdAt: dateRange(from, to) } : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: { select: { campaigns: true } },
        campaigns: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
        editLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const creditBalances = users.length
    ? await prisma.creditLedger.groupBy({
        by: ['userId'],
        where: { userId: { in: users.map(user => user.id) } },
        _sum: { amount: true },
      })
    : []
  const creditBalanceByUserId = new Map(
    creditBalances.map(entry => [entry.userId, entry._sum.amount || 0]),
  )

  return (
    <>
      <AdminPageHeader title="사용자 관리" description="플랜 변경, 크레딧 조정, 계정 상태 관리" />

      <form className="mb-4 flex flex-wrap gap-2 rounded-xl border border-[#e8e8e8] bg-white p-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="이메일, 이름, 사용자 ID"
          className={`${inputCls} min-w-56 flex-1`}
        />
        <select name="plan" defaultValue={plan} className={`${inputCls} w-40`}>
          <option value="">전체 플랜</option>
          {['FREE', 'PRO', 'UNLIMITED'].map(value => <option key={value} value={value}>{formatPlan(value)}</option>)}
        </select>
        <select name="status" defaultValue={status} className={`${inputCls} w-36`}>
          <option value="">전체 계정</option>
          <option value="active">active</option>
          <option value="blocked">blocked</option>
        </select>
        <select name="polarStatus" defaultValue={polarStatus} className={`${inputCls} w-40`}>
          <option value="">전체 Polar 상태</option>
          {['active', 'canceled', 'revoked', 'past_due'].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <input type="date" name="from" defaultValue={from} aria-label="가입 시작일" className={`${inputCls} w-auto`} />
        <input type="date" name="to" defaultValue={to} aria-label="가입 종료일" className={`${inputCls} w-auto`} />
        <select name="pageSize" defaultValue={String(pageSize)} className={`${inputCls} w-28`}>
          {[25, 50, 100].map(value => <option key={value} value={value}>{value}개</option>)}
        </select>
        <button className="rounded-lg bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#333]">검색</button>
        <Link href="/admin/users" className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-bold hover:bg-[#f5f5f5]">초기화</Link>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
        {users.length === 0 ? (
          <div className="p-6"><EmptyState>검색 결과가 없습니다.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-[#f0f0f0]">
                <tr>
                  <Th>이메일</Th>
                  <Th>가입일</Th>
                  <Th>플랜</Th>
                  <Th>크레딧</Th>
                  <Th>생성 횟수</Th>
                  <Th>마지막 활동</Th>
                  <Th>상태</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f5]">
                {users.map(user => {
                  const creditBalance = creditBalanceByUserId.get(user.id) || 0
                  const lastActive = maxDate(user.campaigns[0]?.updatedAt, user.editLogs[0]?.createdAt, user.updatedAt)
                  return (
                    <tr key={user.id} className="hover:bg-[#fafafa]">
                      <Td>
                        <Link href={`/admin/users/${user.id}`} prefetch className="font-semibold text-blue-600 hover:underline">
                          {user.email}
                        </Link>
                        {user.name && <div className="text-xs text-[#aaa]">{user.name}</div>}
                      </Td>
                      <Td className="text-[#888]">{formatDate(user.createdAt)}</Td>
                      <Td><span className="font-bold">{formatPlan(user.plan)}</span></Td>
                      <Td className="font-semibold">{creditBalance}</Td>
                      <Td>{user._count.campaigns}건</Td>
                      <Td className="text-[#888]">{formatDate(lastActive)}</Td>
                      <Td><span className={statusPill(user.accountStatus || 'active')}>{user.accountStatus || 'active'}</span></Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AdminPagination
        basePath="/admin/users"
        page={page}
        pageSize={pageSize}
        total={total}
        query={{ q, plan, status, polarStatus, from, to }}
      />
    </>
  )
}

function maxDate(...values: Array<Date | null | undefined>) {
  const sorted = values.filter(Boolean).sort((a, b) => Number(b) - Number(a)) as Date[]
  return sorted[0] || null
}
