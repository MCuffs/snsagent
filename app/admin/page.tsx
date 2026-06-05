import Link from 'next/link'
import prisma from '../../lib/db'
import { AdminPageHeader, formatCurrency, StatCard } from './_components/AdminShell'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const start = startOfToday()
  const [
    totalUsers,
    newUsersToday,
    totalGenerationsToday,
    failedGenerationsToday,
    paymentsToday,
    refundCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: start } } }),
    prisma.campaign.count({ where: { createdAt: { gte: start } } }),
    prisma.campaign.count({ where: { createdAt: { gte: start }, status: 'failed' } }),
    prisma.paymentRecord.aggregate({
      where: { paidAt: { gte: start }, status: 'paid' },
      _sum: { amount: true },
    }),
    prisma.paymentRecord.count({
      where: {
        refundedAt: { gte: start },
        status: { in: ['cancelled', 'partial_refund'] },
      },
    }),
  ])

  return (
    <>
      <AdminPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Daily operational health for users, card news generation, payments, refunds, and manual admin workflows."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={totalUsers} />
        <StatCard label="New users today" value={newUsersToday} />
        <StatCard label="Total generations today" value={totalGenerationsToday} />
        <StatCard label="Failed generations today" value={failedGenerationsToday} />
        <StatCard label="Downloads today" value="N/A" hint="TODO: add download event table" />
        <StatCard label="Today's payment amount" value={formatCurrency(paymentsToday._sum.amount || 0)} />
        <StatCard label="Refund count" value={refundCount} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Link href="/admin/users" className="rounded-md border border-[#e6dfd5] bg-white p-5 text-sm font-bold shadow-sm transition hover:border-[#bda38e]">
          Review users and adjust credits
        </Link>
        <Link href="/admin/generations" className="rounded-md border border-[#e6dfd5] bg-white p-5 text-sm font-bold shadow-sm transition hover:border-[#bda38e]">
          Inspect failed generations
        </Link>
        <Link href="/admin/payments" className="rounded-md border border-[#e6dfd5] bg-white p-5 text-sm font-bold shadow-sm transition hover:border-[#bda38e]">
          Update manual refund states
        </Link>
      </div>
    </>
  )
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
