import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import prisma from '../../../lib/db'
import { AdminPageHeader, EmptyState, Td, Th } from '../_components/AdminShell'
import { AdminPagination } from '../_components/AdminPagination'
import { dateRange, formatDate, inputCls, parseAdminPage, parseAdminPageSize, statusPill } from '../_components/adminUtils'

export const dynamic = 'force-dynamic'

export default async function AdminGenerationsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string
    status?: string
    failed?: string
    model?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
  }>
}) {
  const params = await searchParams
  const email = params?.email?.trim() || ''
  const status = params?.status?.trim() || ''
  const failedOnly = params?.failed === '1'
  const model = params?.model?.trim() || ''
  const from = params?.from?.trim() || ''
  const to = params?.to?.trim() || ''
  const page = parseAdminPage(params?.page)
  const pageSize = parseAdminPageSize(params?.pageSize)

  const where: Prisma.CampaignWhereInput = {
    ...(failedOnly ? { status: 'failed' } : status ? { status } : {}),
    ...(email ? { user: { email: { contains: email, mode: 'insensitive' } } } : {}),
    ...(model ? { imageModel: { contains: model, mode: 'insensitive' } } : {}),
    ...(dateRange(from, to) ? { createdAt: dateRange(from, to) } : {}),
  }

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true } },
        slides: { select: { id: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ])

  const campaignIds = campaigns.map(c => c.id)
  const generationLogs = campaignIds.length
    ? await prisma.aiGenerationLog.findMany({
        where: { campaignId: { in: campaignIds } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const generationLogByCampaignId = new Map<string, (typeof generationLogs)[number]>()
  for (const log of generationLogs) {
    if (log.campaignId && !generationLogByCampaignId.has(log.campaignId)) {
      generationLogByCampaignId.set(log.campaignId, log)
    }
  }

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
        <input name="model" defaultValue={model} placeholder="모델 검색" className={`${inputCls} w-44`} />
        <input type="date" name="from" defaultValue={from} aria-label="생성 시작일" className={`${inputCls} w-auto`} />
        <input type="date" name="to" defaultValue={to} aria-label="생성 종료일" className={`${inputCls} w-auto`} />
        <select name="pageSize" defaultValue={String(pageSize)} className={`${inputCls} w-28`}>
          {[25, 50, 100].map(value => <option key={value} value={value}>{value}개</option>)}
        </select>
        <label className={`flex items-center gap-2 ${inputCls} w-auto cursor-pointer`}>
          <input type="checkbox" name="failed" value="1" defaultChecked={failedOnly} />
          <span>실패만</span>
        </label>
        <button className="rounded-lg bg-[#111] px-4 text-sm font-bold text-white hover:bg-[#333]">필터</button>
        <Link href="/admin/generations" className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-bold hover:bg-[#f5f5f5]">초기화</Link>
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
                  const log = generationLogByCampaignId.get(campaign.id)
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
      <AdminPagination
        basePath="/admin/generations"
        page={page}
        pageSize={pageSize}
        total={total}
        query={{ email, status, failed: failedOnly ? '1' : '', model, from, to }}
      />
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
