import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react'
import { getSessionUser } from '../../actions'
import InstagramIcon from '../../components/InstagramIcon'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

function statusLabel(status: string) {
  const map: Record<string, string> = {
    posted: '게시 완료',
    scheduled: '예약됨',
    failed: '실패',
    pending_approval: '검토 대기',
    generated: '생성 완료',
    needs_review: '확인 필요',
  }
  return map[status] || status
}

function statusClass(status: string) {
  if (status === 'posted') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'scheduled') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-[#dedbd2] bg-[#f1f0eb] text-[#6f6a61]'
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  const campaigns = await dbService.getCampaigns(user.id)
  const posts = await dbService.getPosts(user.id)
  const brands = await dbService.getBrands(user.id)
  const instagramAccount = brands[0]
    ? await dbService.getInstagramAccount(user.id, brands[0].id)
    : null

  const now = new Date()
  const oneWeekLater = new Date()
  oneWeekLater.setDate(oneWeekLater.getDate() + 7)

  const scheduledCount = posts.filter((post) => {
    const scheduledAt = new Date(post.scheduledAt).getTime()
    return post.status === 'scheduled' && scheduledAt >= now.getTime() && scheduledAt <= oneWeekLater.getTime()
  }).length

  const pendingCount = campaigns.filter((campaign) =>
    ['generated', 'pending_approval', 'needs_review'].includes(campaign.status)
  ).length

  const activeCampaign = campaigns.find((campaign) =>
    ['generated', 'pending_approval', 'needs_review'].includes(campaign.status)
  )

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8">
      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative overflow-hidden rounded-[10px] border border-[#e8dfd4] bg-white p-8 shadow-[0_24px_70px_rgba(31,21,18,0.07)] md:p-10">
          <div className="soft-grid absolute inset-y-0 right-0 w-1/2 opacity-60" />
          <div className="relative z-10 mb-8 flex items-center gap-2">
            <span className="status-pill">
              <Sparkles className="h-3.5 w-3.5 text-[#b94718]" />
              Campaign workspace
            </span>
          </div>
          <h1 className="relative z-10 max-w-4xl text-5xl font-black leading-[0.98] tracking-[-0.065em] text-[#1f1512] md:text-6xl">
            콘텐츠를 만들고 검토하고 예약하는 하나의 작업대
          </h1>
          <p className="relative z-10 mt-6 max-w-2xl text-lg leading-8 text-[#4a4039]">
            브랜드 프로필을 기준으로 카드뉴스 초안을 만들고 발행 전 검토까지 이어갑니다.
            현재는 로컬 데모 모드이며, 실제 운영 전 AI/예약 발행 연동을 추가할 수 있습니다.
          </p>
          <div className="relative z-10 mt-8 flex flex-wrap gap-3">
            <Link href="/campaign/new" className="btn-primary px-5">
              <Plus className="h-4 w-4" />
              새 카드뉴스 만들기
            </Link>
            <Link href="/brand" className="btn-secondary px-5">
              브랜드 설정
            </Link>
          </div>
        </div>

        <div className="rounded-[10px] border border-[#d8edf7] bg-[#f3fbff] p-6 shadow-[0_24px_70px_rgba(58,167,216,0.1)]">
          <p className="eyebrow">Readiness</p>
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`mt-0.5 h-5 w-5 ${brands.length ? 'text-emerald-600' : 'text-[#aaa49a]'}`} />
              <div>
                <p className="text-sm font-bold text-neutral-950">브랜드 프로필</p>
                <p className="text-xs leading-5 text-[#6f6a61]">
                  {brands.length ? brands[0].name : '먼저 브랜드 정보를 입력하세요.'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`mt-0.5 h-5 w-5 ${instagramAccount ? 'text-emerald-600' : 'text-[#aaa49a]'}`} />
              <div>
                <p className="text-sm font-bold text-neutral-950">인스타그램 연결</p>
                <p className="text-xs leading-5 text-[#6f6a61]">
                  {instagramAccount ? '연결 정보가 저장되어 있습니다.' : '예약 발행 전 연결이 필요합니다.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="생성한 캠페인" value={`${campaigns.length}`} note="누적 카드뉴스" icon={Layers} />
        <Metric title="이번 주 예약" value={`${scheduledCount}`} note="7일 이내 발행 예정" icon={Calendar} />
        <Metric title="검토 대기" value={`${pendingCount}`} note="승인 또는 수정 필요" icon={AlertCircle} />
        <div className="rounded-[8px] border border-[#e8dfd4] bg-white p-5 shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
          <div className="mb-5 flex items-center justify-between">
            <p className="eyebrow">Instagram</p>
            <InstagramIcon className="h-5 w-5 text-[#6f6a61]" />
          </div>
          <p className="text-2xl font-black text-neutral-950">
            {instagramAccount?.status === 'CONNECTED' ? '연결됨' : '미연결'}
          </p>
          <p className="mt-1 text-xs text-[#6f6a61]">
            {instagramAccount?.status === 'CONNECTED' ? '발행 준비 완료' : '설정에서 계정을 연결하세요.'}
          </p>
        </div>
      </section>

      {activeCampaign && (
        <section className="mb-8 rounded-[8px] border border-[#fed7aa] bg-[#fff7ed] p-5 shadow-[0_18px_50px_rgba(31,21,18,0.05)] md:flex md:items-center md:justify-between">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-[#b94718]" />
            <div>
              <p className="text-sm font-bold text-neutral-950">검토가 필요한 캠페인이 있습니다.</p>
              <p className="mt-1 text-xs text-[#6f6a61]">
                {activeCampaign.title} · {activeCampaign.slideCount}장
              </p>
            </div>
          </div>
          <Link href={`/campaign/${activeCampaign.id}`} className="btn-primary mt-4 px-4 md:mt-0">
            검토하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Recent Campaigns</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-neutral-950">최근 캠페인</h2>
          </div>
          <Link href="/campaign/new" className="btn-secondary min-h-10 px-4 text-xs">
            <Plus className="h-4 w-4" />
            새로 만들기
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-[8px] border border-[#e8dfd4] bg-white p-12 text-center shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
            <Layers className="mx-auto h-10 w-10 text-[#aaa49a]" />
            <p className="mt-4 text-sm font-bold text-neutral-950">아직 만든 카드뉴스가 없습니다.</p>
            <p className="mt-2 text-xs text-[#6f6a61]">브랜드 정보를 입력한 뒤 첫 캠페인을 생성해 보세요.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[8px] border border-[#e8dfd4] bg-white shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-[#e8dfd4] bg-[#fff8f0] text-[11px] font-black uppercase tracking-wide text-[#746a62]">
                    <th className="px-5 py-3">캠페인</th>
                    <th className="px-5 py-3">상품</th>
                    <th className="px-5 py-3">슬라이드</th>
                    <th className="px-5 py-3">생성일</th>
                    <th className="px-5 py-3">상태</th>
                    <th className="px-5 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece9e0] text-sm">
                  {campaigns.slice(0, 6).map((campaign) => (
                    <tr key={campaign.id} className="bg-white transition hover:bg-[#fffaf4]">
                      <td className="max-w-xs truncate px-5 py-4 font-bold text-neutral-950">{campaign.title}</td>
                      <td className="px-5 py-4 text-[#6f6a61]">{campaign.productName}</td>
                      <td className="px-5 py-4 text-[#6f6a61]">{campaign.slideCount}장</td>
                      <td className="px-5 py-4 text-[#6f6a61]">
                        {new Date(campaign.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(campaign.status)}`}>
                          {statusLabel(campaign.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/campaign/${campaign.id}`} className="text-xs font-bold text-[#b94718] hover:text-[#9f3d14]">
                          열기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function Metric({
  title,
  value,
  note,
  icon: Icon,
}: {
  title: string
  value: string
  note: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-[8px] border border-[#e8dfd4] bg-white p-5 shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
      <div className="mb-5 flex items-center justify-between">
        <p className="eyebrow">{title}</p>
        <Icon className="h-5 w-5 text-[#6f6a61]" />
      </div>
      <p className="text-3xl font-black text-neutral-950">{value}</p>
      <p className="mt-1 text-xs text-[#6f6a61]">{note}</p>
    </div>
  )
}
