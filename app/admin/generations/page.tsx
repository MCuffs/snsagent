import Link from 'next/link'
import prisma from '../../../lib/db'
import { AdminPageHeader, EmptyState, Td, Th } from '../_components/AdminShell'
import { formatDate, statusPill } from '../_components/adminUtils'

export const dynamic = 'force-dynamic'

export default async function AdminGenerationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; status?: string; failed?: string }>
}) {
  const params = await searchParams
  const email = params?.email?.trim() || ''
  const status = params?.status?.trim() || ''
  const failedOnly = params?.failed === '1'

  const campaigns = await prisma.campaign.findMany({
    where: {
      ...(failedOnly ? { status: 'failed' } : status ? { status } : {}),
      ...(email ? { user: { email: { contains: email, mode: 'insensitive' } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: {
      user: { select: { id: true, email: true } },
      slides: { select: { id: true } },
    },
  })

  const campaignIds = campaigns.map(c => c.id)
  const generationLogs = campaignIds.length
    ? await prisma.aiGenerationLog.findMany({
        where: { campaignId: { in: campaignIds } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const inputCls = 'min-h-10 rounded-lg border border-[#ddd] bg-white px-3 text-sm outline-none focus:border-[#111] focus:ring-2 focus:ring-black/5'

  return (
    <>
      <AdminPageHeader title="생성 내역" description="카드뉴스 생성 현황 및 실패 원인 분석" />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="email" defaultValue={email} placeholder="이메일 검색" className={`${inputCls} w-56`} />
        <select name="status" defaultValue={status} className={`${inputCls} w-40`}>
          <option value="">전체 상태</option>
          {['generated', 'pending_approval', 'needs_review', 'scheduled', 'posted', 'failed', 'draft'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className={`flex items-center gap-2 ${inputCls} w-auto cursor-pointer`}>
          <input type="checkbox" name="failed" value="1" defaultChecked={failedOnly} />
          <span>실패만</span>
        </label>
        <button className="rounded-lg bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#333]">필터</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white">
        {campaigns.length === 0 ? (
          <div className="p-6"><EmptyState>조건에 맞는 생성 내역이 없습니다.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="border-b border-[#f0f0f0]">
                <tr>
                  <Th>사용자</Th>
                  <Th>주제</Th>
                  <Th>생성 시각</Th>
                  <Th>상태</Th>
                  <Th>슬라이드</Th>
                  <Th>모델</Th>
                  <Th>실패 사유</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f5]">
                {campaigns.map(campaign => {
                  const log = generationLogs.find(l => l.campaignId === campaign.id)
                  return (
                    <tr key={campaign.id} className="hover:bg-[#fafafa]">
                      <Td>
                        <Link href={`/admin/users/${campaign.user.id}`} prefetch className="font-semibold text-blue-600 hover:underline">
                          {campaign.user.email}
                        </Link>
                      </Td>
                      <Td className="max-w-[200px] truncate font-semibold">{campaign.title || '-'}</Td>
                      <Td className="text-[#888]">{formatDate(campaign.createdAt)}</Td>
                      <Td><span className={statusPill(campaign.status)}>{campaign.status}</span></Td>
                      <Td>{campaign.slides.length || campaign.slideCount}장</Td>
                      <Td className="text-[#888]">{campaign.imageModel || log?.model || '-'}</Td>
                      <Td className="max-w-[260px] text-xs text-red-600">
                        {campaign.status === 'failed' ? failureReason(campaign.agentReport, log?.errorMessage) : '-'}
                      </Td>
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

function failureReason(agentReport?: string | null, errorMessage?: string | null) {
  if (errorMessage) return errorMessage.slice(0, 140)
  if (!agentReport) return '기록 없음'
  try {
    const parsed = JSON.parse(agentReport) as { logs?: Array<{ status?: string; message?: string }> }
    return parsed.logs?.find(l => l.status === 'error')?.message?.slice(0, 140) || '기록 없음'
  } catch {
    return agentReport.slice(0, 140)
  }
}
