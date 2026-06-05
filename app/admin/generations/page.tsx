import Link from 'next/link'
import prisma from '../../../lib/db'
import { AdminPageHeader, formatDate, statusPill } from '../_components/AdminShell'

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
      ...(status ? { status } : {}),
      ...(failedOnly ? { status: 'failed' } : {}),
      ...(email ? { user: { email: { contains: email, mode: 'insensitive' } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: {
      user: { select: { id: true, email: true } },
      slides: { select: { id: true } },
    },
  })
  const campaignIds = campaigns.map(campaign => campaign.id)
  const generationLogs = campaignIds.length
    ? await prisma.aiGenerationLog.findMany({
        where: { campaignId: { in: campaignIds } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  return (
    <>
      <AdminPageHeader
        eyebrow="Generations"
        title="Generation history"
        description="Inspect carousel generation status, slide counts, model use, and failure signals."
      />

      <form className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_160px_auto]">
        <input name="email" defaultValue={email} placeholder="User email" className={inputClassName} />
        <select name="status" defaultValue={status} className={inputClassName}>
          <option value="">All statuses</option>
          {['generated', 'pending_approval', 'needs_review', 'scheduled', 'posted', 'failed', 'draft'].map(item => <option key={item}>{item}</option>)}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#d9d0c5] bg-white px-3 text-sm font-bold">
          <input type="checkbox" name="failed" value="1" defaultChecked={failedOnly} />
          Failed only
        </label>
        <button className="rounded-md bg-[#171412] px-4 text-sm font-black text-white">Filter</button>
      </form>

      <div className="overflow-hidden rounded-md border border-[#e6dfd5] bg-white shadow-sm">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-[#f4f1eb] text-xs font-black uppercase tracking-[0.08em] text-[#74675d]">
            <tr>
              <th className="px-4 py-3">User email</th>
              <th className="px-4 py-3">Product URL</th>
              <th className="px-4 py-3">Generation time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Slides</th>
              <th className="px-4 py-3">Model used</th>
              <th className="px-4 py-3">Estimated cost</th>
              <th className="px-4 py-3">Download status</th>
              <th className="px-4 py-3">Failure reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eee8df]">
            {campaigns.map(campaign => {
              const log = generationLogs.find(item => item.campaignId === campaign.id)
              return (
                <tr key={campaign.id} className="align-top">
                  <td className="px-4 py-3 font-bold">
                    <Link href={`/admin/users/${campaign.user.id}`} className="text-[#1f4f8a] hover:underline">{campaign.user.email}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#635951]">{extractProductUrl(campaign.keyBenefits) || '-'}</td>
                  <td className="px-4 py-3">{formatDate(campaign.createdAt)}</td>
                  <td className="px-4 py-3"><span className={statusPill(campaign.status)}>{campaign.status}</span></td>
                  <td className="px-4 py-3">{campaign.slides.length || campaign.slideCount}</td>
                  <td className="px-4 py-3">{campaign.imageModel || log?.model || '-'}</td>
                  <td className="px-4 py-3">TODO</td>
                  <td className="px-4 py-3">TODO</td>
                  <td className="px-4 py-3 text-red-700">{campaign.status === 'failed' ? failureReason(campaign.agentReport, log?.errorMessage) : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

const inputClassName = 'min-h-11 rounded-md border border-[#d9d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#a47d65]'

function extractProductUrl(value: string) {
  return value.match(/https?:\/\/\S+/)?.[0] || null
}

function failureReason(agentReport?: string | null, errorMessage?: string | null) {
  if (errorMessage) return errorMessage.slice(0, 160)
  if (!agentReport) return 'No failure reason recorded'
  try {
    const parsed = JSON.parse(agentReport) as { logs?: Array<{ status?: string; message?: string }> }
    return parsed.logs?.find(log => log.status === 'error')?.message?.slice(0, 160) || 'No failure reason recorded'
  } catch {
    return agentReport.slice(0, 160)
  }
}
