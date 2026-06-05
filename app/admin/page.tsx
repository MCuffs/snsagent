import prisma from '../../lib/db'
import Link from 'next/link'
import { AdminPageHeader, StatCard, formatCurrency } from './_components/AdminShell'

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
    activeSubscriptions,
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
      where: { refundedAt: { gte: start }, status: { in: ['cancelled', 'partial_refund'] } },
    }),
    prisma.user.count({
      where: {
        OR: [
          { nicepaySubscriptionStatus: 'ACTIVE' },
          { paypalSubscriptionStatus: 'ACTIVE' },
        ],
      },
    }),
  ])

  return (
    <>
      <AdminPageHeader title="대시보드" description="오늘의 운영 현황 요약" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="전체 가입자" value={totalUsers.toLocaleString()} />
        <StatCard label="오늘 신규 가입" value={newUsersToday} />
        <StatCard label="활성 구독자" value={activeSubscriptions} />
        <StatCard label="오늘 생성 건수" value={totalGenerationsToday} hint={failedGenerationsToday > 0 ? `실패 ${failedGenerationsToday}건` : undefined} />
        <StatCard label="오늘 결제액" value={formatCurrency(paymentsToday._sum.amount || 0)} />
        <StatCard label="오늘 환불 건수" value={refundCount} />
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {[
          { href: '/admin/users', title: '사용자 관리', desc: '플랜 변경, 크레딧 조정, 계정 상태 관리' },
          { href: '/admin/generations', title: '생성 내역', desc: '실패 원인 분석 및 상세 로그 확인' },
          { href: '/admin/payments', title: '결제 관리', desc: '수동 결제 기록 생성 및 환불 처리' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition hover:border-[#ccc] hover:shadow-sm"
          >
            <p className="font-bold">{item.title}</p>
            <p className="mt-1 text-sm text-[#888]">{item.desc}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
