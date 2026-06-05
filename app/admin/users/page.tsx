import Link from 'next/link'
import prisma from '../../../lib/db'
import { AdminPageHeader, formatDate, statusPill } from '../_components/AdminShell'

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
      creditLedger: { select: { amount: true } },
    },
  })

  return (
    <>
      <AdminPageHeader
        eyebrow="Users"
        title="User management"
        description="Search users, inspect generation activity, review credit balance, and open operational detail pages."
      />
      <form className="mb-4 flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email"
          className="min-h-11 flex-1 rounded-md border border-[#d9d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#a47d65]"
        />
        <button className="rounded-md bg-[#171412] px-4 text-sm font-black text-white">Search</button>
      </form>

      <div className="overflow-hidden rounded-md border border-[#e6dfd5] bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-[#f4f1eb] text-xs font-black uppercase tracking-[0.08em] text-[#74675d]">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Signup date</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Remaining credits</th>
              <th className="px-4 py-3">Total generations</th>
              <th className="px-4 py-3">Last active date</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee8df]">
            {users.map(user => {
              const creditBalance = user.creditLedger.reduce((sum, item) => sum + item.amount, 0)
              const lastActive = maxDate(user.campaigns[0]?.updatedAt, user.editLogs[0]?.createdAt, user.updatedAt)
              const accountStatus = user.accountStatus || 'active'
              return (
                <tr key={user.id} className="align-top">
                  <td className="px-4 py-3 font-bold">
                    <Link href={`/admin/users/${user.id}`} className="text-[#1f4f8a] hover:underline">{user.email}</Link>
                    {user.name && <div className="mt-0.5 text-xs font-semibold text-[#81756d]">{user.name}</div>}
                  </td>
                  <td className="px-4 py-3 text-[#635951]">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3 font-black">{user.plan}</td>
                  <td className="px-4 py-3 font-black">{creditBalance}</td>
                  <td className="px-4 py-3">{user._count.campaigns}</td>
                  <td className="px-4 py-3 text-[#635951]">{formatDate(lastActive)}</td>
                  <td className="px-4 py-3"><span className={statusPill(accountStatus)}>{accountStatus}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function maxDate(...values: Array<Date | null | undefined>) {
  const sorted = values.filter(Boolean).sort((a, b) => Number(b) - Number(a)) as Date[]
  return sorted[0] || null
}
