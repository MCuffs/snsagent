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
  if (status === 'posted') return 'border-emerald-100 bg-emerald-50/50 text-emerald-700'
  if (status === 'scheduled') return 'border-blue-100 bg-blue-50/50 text-blue-700'
  if (status === 'failed') return 'border-red-100 bg-red-50/50 text-red-700'
  return 'border-neutral-100 bg-neutral-50 text-neutral-600'
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
    <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">대시보드</h1>
          <p className="text-sm text-neutral-500">인스타에이전트의 전체 현황과 주요 작업을 한눈에 확인합니다.</p>
        </div>
      </div>

      {/* Campaign Review Notice Banner */}
      {activeCampaign && (
        <section className="mb-8 rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-2xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100/60 p-1.5 text-amber-700 shrink-0">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">검토 및 최종 승인이 필요한 캠페인이 있습니다.</p>
              <p className="mt-0.5 text-xs text-amber-700/80">
                {activeCampaign.title} (총 {activeCampaign.slideCount}장)
              </p>
            </div>
          </div>
          <Link href={`/campaign/${activeCampaign.id}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-2xs w-fit">
            검토 및 승인하기
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* Hero & Readiness Section */}
      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Welcome Card */}
        <div className="panel relative overflow-hidden rounded-2xl p-8 md:p-10">
          <div className="relative z-10 mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-brand-orange">
              <Sparkles className="h-3.5 w-3.5" />
              캠페인 작업대
            </span>
          </div>
          <h2 className="relative z-10 max-w-2xl text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:leading-tight">
            콘텐츠를 만들고 검토하고 예약하는 하나의 작업대
          </h2>
          <p className="relative z-10 mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
            브랜드 프로필을 기반으로 인스타그램 카드뉴스 초안을 신속히 제작하고 발행 전 최종 검증 단계까지 유기적으로 이어갑니다.
          </p>
          <div className="relative z-10 mt-6 flex flex-wrap gap-3">
            <Link href="/campaign/new" className="btn-primary px-5 py-2.5 text-sm shadow-xs">
              <Plus className="h-4 w-4" />
              새 카드뉴스 만들기
            </Link>
            <Link href="/brand" className="btn-secondary px-5 py-2.5 text-sm">
              브랜드 설정
            </Link>
          </div>
        </div>

        {/* Readiness Card */}
        <div className="panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Readiness</p>
            <h3 className="mt-1 text-base font-bold text-neutral-800">캠페인 시작 전 준비도</h3>
            
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-0.5 ${brands.length ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-300'}`}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-400">브랜드 프로필</p>
                  <p className="text-sm font-bold text-neutral-800 mt-0.5">
                    {brands.length ? brands[0].name : '설정 필요'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-full p-0.5 ${instagramAccount ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-300'}`}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-400">인스타그램 연동</p>
                  <p className="text-sm font-bold text-neutral-800 mt-0.5">
                    {instagramAccount ? '연결 완료' : '연결 필요'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100/50">
            <Link href={instagramAccount ? "/campaign/new" : "/instagram"} className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:text-brand-orange-hover transition-colors">
              {instagramAccount ? '카드뉴스 만들러 가기' : '인스타그램 연동 설정하기'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="생성한 캠페인" value={`${campaigns.length}`} note="누적 카드뉴스 제작 수" icon={Layers} />
        <Metric title="이번 주 예약" value={`${scheduledCount}`} note="7일 이내 자동 발행 예정" icon={Calendar} />
        <Metric title="검토 대기" value={`${pendingCount}`} note="승인 및 수정 대기 건" icon={AlertCircle} />
        <div className="panel rounded-xl p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Instagram</p>
            <div className="rounded-lg bg-neutral-50 p-2 text-neutral-400">
              <InstagramIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-neutral-900 tracking-tight">
              {instagramAccount?.status === 'CONNECTED' ? '연결 완료' : '미연결'}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {instagramAccount?.status === 'CONNECTED' ? '실시간 연동 준비 완료' : '설정에서 계정을 연결하세요.'}
            </p>
          </div>
        </div>
      </section>

      {/* Recent Campaigns Section */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recent Campaigns</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900">최근 카드뉴스 캠페인</h2>
          </div>
          <Link href="/campaign/new" className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:underline transition-colors">
            전체 보기
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="panel rounded-2xl p-16 text-center shadow-3xs">
            <Layers className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-4 text-sm font-bold text-neutral-800">아직 생성된 카드뉴스가 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-500">브랜드 정보를 설정한 후 첫 번째 캠페인을 시작해 보세요.</p>
          </div>
        ) : (
          <div className="panel overflow-hidden rounded-2xl shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/40 text-xs font-semibold text-neutral-400">
                    <th className="px-6 py-4">캠페인 타이틀</th>
                    <th className="px-6 py-4">상품명</th>
                    <th className="px-6 py-4">슬라이드 수</th>
                    <th className="px-6 py-4">제작일</th>
                    <th className="px-6 py-4">현재 상태</th>
                    <th className="px-6 py-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-sm text-neutral-600">
                  {campaigns.slice(0, 6).map((campaign) => (
                    <tr key={campaign.id} className="bg-white/10 hover:bg-neutral-50/20 transition-colors">
                      <td className="max-w-xs truncate px-6 py-4 font-semibold text-neutral-900">{campaign.title}</td>
                      <td className="px-6 py-4 text-neutral-500">{campaign.productName}</td>
                      <td className="px-6 py-4 text-neutral-500">{campaign.slideCount}장</td>
                      <td className="px-6 py-4 text-neutral-500">
                        {new Date(campaign.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(campaign.status)}`}>
                          {statusLabel(campaign.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/campaign/${campaign.id}`} className="inline-flex items-center gap-0.5 text-xs font-bold text-brand-orange hover:text-brand-orange-hover transition-colors">
                          열기
                          <ArrowRight className="h-3 w-3" />
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
    <div className="panel rounded-xl p-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{title}</p>
        <div className="rounded-lg bg-neutral-50 p-2 text-neutral-400">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-neutral-900 tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-neutral-500">{note}</p>
      </div>
    </div>
  )
}

