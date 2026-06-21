import Link from 'next/link'
import prisma from '../../../lib/db'
import { AdminPageHeader, EmptyState, Td, Th } from '../_components/AdminShell'
import { formatDate, formatPlan, statusPill } from '../_components/adminUtils'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const q = params?.q?.trim() || ''

  const users = await prisma.user.findMany({
    where: q ? { email: { contains: q, mode: 'insensitive' } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      _count: { select: { campaigns: true } },
      campaigns: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
      editLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  })

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

      <form className="mb-4 flex max-w-lg gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="이메일로 검색"
          className="min-h-10 flex-1 rounded-lg border border-[#ddd] bg-white px-3 text-sm outline-none focus:border-[#111] focus:ring-2 focus:ring-black/5"
        />
        <button className="rounded-lg bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#333]">검색</button>
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
    </>
  )
}

function maxDate(...values: Array<Date | null | undefined>) {
  const sorted = values.filter(Boolean).sort((a, b) => Number(b) - Number(a)) as Date[]
  return sorted[0] || null
}
