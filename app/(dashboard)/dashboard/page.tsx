import Link from 'next/link'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'
import { 
  Sparkles, 
  Calendar, 
  Layers, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Plus
} from 'lucide-react'
import InstagramIcon from '../../components/InstagramIcon'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) return null

  // Fetch data
  const campaigns = await dbService.getCampaigns(user.id)
  const posts = await dbService.getPosts(user.id)
  const brands = await dbService.getBrands(user.id)
  const instagramAccount = brands.length > 0 ? await dbService.getInstagramAccount(user.id, brands[0].id) : null

  // Calculate statistics
  const generatedCount = campaigns.length
  
  // Weekly scheduled posts
  const oneWeekLater = new Date()
  oneWeekLater.setDate(oneWeekLater.getDate() + 7)
  const now = new Date()
  
  const thisWeekPosts = posts.filter(
    p => p.status === 'scheduled' && 
         new Date(p.scheduledAt).getTime() >= now.getTime() && 
         new Date(p.scheduledAt).getTime() <= oneWeekLater.getTime()
  )
  const scheduledCount = thisWeekPosts.length

  // Pending approval campaigns
  const pendingCount = campaigns.filter(c => c.status === 'generated' || c.status === 'pending_approval').length

  // Get active campaign that needs review (most recent draft/generated)
  const activeCampaign = campaigns.find(c => c.status === 'generated')
  const activePost = activeCampaign ? posts.find(p => p.campaignId === activeCampaign.id) : null

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="p-8 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-[30%] h-full bg-[#ff4f00]/5 blur-[60px] pointer-events-none"></div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#ff4f00]/20 bg-[#ff4f00]/5 text-[11px] font-extrabold text-[#ff4f00]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 마케팅 직원 가동 중</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {user.name || user.email.split('@')[0]} 대표님, 오늘 올릴 콘텐츠가 준비됐어요.
          </h1>
          <p className="text-sm text-slate-500 max-w-xl font-medium">
            브랜드 톤앤매너에 맞춰 기획된 카드뉴스를 검토하고 승인해 주세요. 승인 즉시 인스타그램 예약 큐에 등록됩니다.
          </p>
        </div>
        
        <Link 
          href="/campaign/new"
          className="flex-shrink-0 px-5 py-3.5 rounded-lg font-extrabold bg-[#ff4f00] hover:bg-[#e04500] active:scale-[0.98] text-white flex items-center gap-2 cursor-pointer shadow-sm transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>새 카드뉴스 생성하기</span>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">이번 주 예약된 포스트</span>
            <div className="p-2.5 rounded-lg bg-[#ff4f00]/5 text-[#ff4f00] border border-[#ff4f00]/10">
              <Calendar className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{scheduledCount}개</p>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">향후 7일간 발행 예정</p>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">생성된 카드뉴스 총합</span>
            <div className="p-2.5 rounded-lg bg-indigo-550/5 text-indigo-650 border border-indigo-550/10">
              <Layers className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{generatedCount}회</p>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">이번 달 누적 발행 기획 수</p>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">승인 대기 중 피드</span>
            <div className="p-2.5 rounded-lg bg-amber-500/5 text-amber-600 border border-amber-500/10">
              <Clock className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">{pendingCount}개</p>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">검토 및 최종 발행 대기</p>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">인스타그램 연동 상태</span>
            <div className={`p-2.5 rounded-lg border ${
              instagramAccount?.status === 'CONNECTED' 
                ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10' 
                : 'bg-red-500/5 text-red-650 border-red-500/10'
            }`}>
              <InstagramIcon className="w-4.5 h-4.5" />
            </div>
          </div>
          <div>
            <p className="text-lg font-black text-slate-900 leading-8">
              {instagramAccount?.status === 'CONNECTED' ? '연동 완료' : '미연동'}
            </p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {instagramAccount?.status === 'CONNECTED' 
                ? `@${instagramAccount.instagramAccountId.slice(0, 12)}...` 
                : 'Instagram 설정 탭에서 연결하세요.'}
            </p>
          </div>
        </div>
      </div>

      {/* Human-in-the-loop Immediate Action Alert */}
      {activeCampaign && activePost && (
        <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
          <div className="flex gap-3">
            <AlertCircle className="w-5.5 h-5.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">승인 대기 중인 새 카드뉴스가 있습니다!</h3>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                주제: &ldquo;{activeCampaign.title}&rdquo; · {activeCampaign.slideCount}장 카드뉴스
              </p>
            </div>
          </div>
          <Link
            href={`/campaign/${activeCampaign.id}`}
            className="w-full md:w-auto px-4 py-2.5 rounded-lg text-xs font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>시안 확인 및 승인하기</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Setup Guide Callout (If brand or instagram not connected) */}
      {(brands.length === 0 || !instagramAccount) && (
        <div className="p-6 rounded-xl border border-blue-200 bg-blue-50/40 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span>AI 직원의 정상 가동을 위한 준비 단계</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${brands.length > 0 ? 'border-emerald-250 bg-emerald-50/30' : 'border-slate-200 bg-white'} flex justify-between items-center shadow-sm`}>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-900">1. 브랜드 프로필 입력</p>
                <p className="text-xs text-slate-500 font-semibold">말투, 브랜드 컬러 등을 AI에게 알려주세요.</p>
              </div>
              {brands.length > 0 ? (
                <span className="text-xs font-extrabold text-emerald-600">완료</span>
              ) : (
                <Link href="/brand" className="text-xs font-extrabold text-blue-600 hover:underline">입력하기</Link>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${instagramAccount ? 'border-emerald-250 bg-emerald-50/30' : 'border-slate-200 bg-white'} flex justify-between items-center shadow-sm`}>
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-900">2. 인스타그램 연동 설정</p>
                <p className="text-xs text-slate-500 font-semibold">자동 예약을 위한 Access Token 입력 단계입니다.</p>
              </div>
              {instagramAccount ? (
                <span className="text-xs font-extrabold text-emerald-600">완료</span>
              ) : (
                <Link href="/instagram" className="text-xs font-extrabold text-blue-600 hover:underline">설정하기</Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Campaign List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-slate-900">최근 생성한 카드뉴스 캠페인</h2>
          {campaigns.length > 5 && (
            <span className="text-xs text-slate-400 font-bold">전체보기 ({campaigns.length})</span>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="border border-slate-200 rounded-xl p-16 text-center bg-white shadow-sm">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-slate-500 font-bold">생성된 카드뉴스 기획이 아직 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1.5 mb-6 font-medium">첫 번째 제품 홍보 카드뉴스를 기획해 보세요.</p>
            <Link
              href="/campaign/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>첫 카드뉴스 생성</span>
            </Link>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">캠페인 타이틀</th>
                    <th className="p-4">대상 상품</th>
                    <th className="p-4">카드 장수</th>
                    <th className="p-4">생성 일자</th>
                    <th className="p-4">상태</th>
                    <th className="p-4 pr-6 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {campaigns.slice(0, 5).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 pl-6 font-bold text-slate-900 truncate max-w-xs">
                        {c.title}
                      </td>
                      <td className="p-4 text-slate-500">{c.productName}</td>
                      <td className="p-4 text-slate-500">{c.slideCount}장</td>
                      <td className="p-4 text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                          c.status === 'posted' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'scheduled'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : c.status === 'failed'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {c.status === 'posted' 
                            ? '업로드 완료' 
                            : c.status === 'scheduled' 
                            ? '예약 완료' 
                            : c.status === 'failed' 
                            ? '발행 실패' 
                            : '승인 대기'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Link 
                          href={`/campaign/${c.id}`}
                          className="inline-flex items-center gap-0.5 text-xs font-extrabold text-[#ff4f00] hover:text-[#e04500]"
                        >
                          <span>시안 검토</span>
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
