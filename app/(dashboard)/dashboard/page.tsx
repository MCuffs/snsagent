import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  Download,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

function statusLabel(status: string) {
  const map: Record<string, string> = {
    posted: '완료',
    scheduled: '완료',
    failed: '오류',
    pending_approval: '편집 가능',
    generated: '생성 완료',
    needs_review: '확인 필요',
  }
  return map[status] || status
}

function statusClass(status: string) {
  if (status === 'failed') return 'border-red-100 bg-red-50/50 text-red-700'
  if (status === 'needs_review') return 'border-amber-100 bg-amber-50/60 text-amber-700'
  return 'border-emerald-100 bg-emerald-50/50 text-emerald-700'
}

export default async function DashboardPage() {
  redirect('/brand')

  const editableCount = campaigns.filter((campaign) =>
    ['generated', 'pending_approval', 'needs_review'].includes(campaign.status)
  ).length
  const completedCount = campaigns.filter((campaign) =>
    ['posted', 'scheduled', 'pending_approval', 'generated'].includes(campaign.status)
  ).length
  const activeCampaign = campaigns.find((campaign) =>
    ['generated', 'pending_approval', 'needs_review'].includes(campaign.status)
  )

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-8 md:px-8">
      <div className="mb-8 flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">대시보드</h1>
          <p className="text-sm text-neutral-500">카드뉴스를 만들고, 편집하고, 다운로드하는 작업 공간입니다.</p>
        </div>
        <Link href="/campaign/new" className="btn-primary px-5">
          <Plus className="h-4 w-4" />
          카드 만들기
        </Link>
      </div>

      {activeCampaign && (
        <section className="mb-8 rounded-xl border border-amber-100 bg-amber-50/40 p-4 shadow-2xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100/60 p-1.5 text-amber-700 shrink-0">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">편집하거나 다운로드할 카드뉴스가 있습니다.</p>
              <p className="mt-0.5 text-xs text-amber-700/80">
                {activeCampaign.title} ({activeCampaign.slideCount}장)
              </p>
            </div>
          </div>
          <Link href={`/campaign/${activeCampaign.id}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-2xs w-fit">
            열기
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      <section className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="panel relative overflow-hidden rounded-2xl p-8 md:p-10">
          <div className="relative z-10 mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-brand-orange">
              <Sparkles className="h-3.5 w-3.5" />
              Card News Studio
            </span>
          </div>
          <h2 className="relative z-10 max-w-2xl text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl md:leading-tight">
            지금 바로 새 카드뉴스를 만들어보세요.
          </h2>
          <p className="relative z-10 mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
            주제만 입력하면 카드뉴스 생성, 슬라이드별 편집, 이미지 다운로드까지 한 번에 이어집니다.
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

        <div className="panel rounded-2xl p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Readiness</p>
          <h3 className="mt-1 text-base font-bold text-neutral-800">작업 준비 상태</h3>
          <div className="mt-6 space-y-4">
            <ReadyItem ok={brands.length > 0} label="브랜드 프로필" value={brands[0]?.name || '설정 필요'} />
            <ReadyItem ok={campaigns.length > 0} label="생성된 카드뉴스" value={`${campaigns.length}개`} />
            <ReadyItem ok label="다운로드 모드" value="활성화" />
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-5 sm:grid-cols-3">
        <Metric title="전체 카드뉴스" value={`${campaigns.length}`} note="생성된 카드뉴스 수" icon={Layers} />
        <Metric title="편집 가능" value={`${editableCount}`} note="검토와 수정 가능" icon={Sparkles} />
        <Metric title="다운로드 가능" value={`${completedCount}`} note="결과 화면에서 저장" icon={Download} />
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recent Cards</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900">최근 카드뉴스</h2>
          </div>
          <Link href="/campaign/new" className="inline-flex items-center gap-1 text-xs font-bold text-brand-orange hover:underline transition-colors">
            새로 만들기
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="panel rounded-2xl p-16 text-center shadow-3xs">
            <Layers className="mx-auto h-10 w-10 text-neutral-300" />
            <p className="mt-4 text-sm font-bold text-neutral-800">아직 생성된 카드뉴스가 없습니다.</p>
            <p className="mt-2 text-xs text-neutral-500">브랜드 정보를 설정하고 첫 번째 카드뉴스를 만들어 보세요.</p>
          </div>
        ) : (
          <div className="panel overflow-hidden rounded-2xl shadow-3xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/40 text-xs font-semibold text-neutral-400">
                    <th className="px-6 py-4">제목</th>
                    <th className="px-6 py-4">주제</th>
                    <th className="px-6 py-4">장수</th>
                    <th className="px-6 py-4">생성일</th>
                    <th className="px-6 py-4">상태</th>
                    <th className="px-6 py-4 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-sm text-neutral-600">
                  {campaigns.slice(0, 8).map((campaign) => (
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
                          편집/다운로드
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

function ReadyItem({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 rounded-full p-0.5 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-50 text-neutral-300'}`}>
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-neutral-400">{label}</p>
        <p className="text-sm font-bold text-neutral-800 mt-0.5">{value}</p>
      </div>
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
