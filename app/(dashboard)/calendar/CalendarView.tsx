'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, Filter, Clock, AlertCircle, ArrowRight, Play, Loader2 } from 'lucide-react'
import { triggerSchedulerAction } from '../../actions'

interface Post {
  id: string
  campaignId: string
  caption: string
  hashtags: string
  scheduledAt: string
  status: string
  campaign: {
    title: string
    slideCount: number
    slides: { imageUrl: string | null }[]
  }
  brand: {
    name: string
  }
}

interface CalendarViewProps {
  posts: Post[]
}

type StatusFilter = 'ALL' | 'DRAFT' | 'PENDING_APPROVAL' | 'SCHEDULED' | 'POSTED' | 'FAILED'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function CalendarView({ posts }: CalendarViewProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<StatusFilter>('ALL')
  const [triggering, setTriggering] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const filterMap: Record<StatusFilter, string> = {
    ALL: '전체',
    DRAFT: '임시 저장 (draft)',
    PENDING_APPROVAL: '승인 대기 (pending)',
    SCHEDULED: '예약 완료 (scheduled)',
    POSTED: '게시 완료 (posted)',
    FAILED: '실패 (failed)'
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (filter === 'ALL') return true
    return post.status.toUpperCase() === filter
  })

  // Group posts by date for tidy visualization
  const getGroupedPosts = () => {
    const groups: Record<string, Post[]> = {}
    filteredPosts.forEach(post => {
      const dateStr = new Date(post.scheduledAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      })
      if (!groups[dateStr]) {
        groups[dateStr] = []
      }
      groups[dateStr].push(post)
    })
    return groups
  }

  const grouped = getGroupedPosts()
  const dates = Object.keys(grouped).sort((a, b) => {
    return new Date(grouped[a][0].scheduledAt).getTime() - new Date(grouped[b][0].scheduledAt).getTime()
  })

  // Count scheduled posts pending trigger
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length

  const handleRunScheduler = async () => {
    setTriggering(true)
    setMessage(null)
    try {
      const res = await triggerSchedulerAction()
      if (res.success) {
        setMessage({ 
          type: 'success', 
          text: res.message || '스케줄러 작업 처리가 완료되었습니다.' 
        })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: res.error || '스케줄러 실행 중 오류가 발생했습니다.' })
      }
    } catch (e: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(e, '스케줄러 작동 통신 장애가 발생했습니다.') })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
          <Calendar className="w-8 h-8 text-[#ff4f00]" />
          <span>콘텐츠 캘린더</span>
        </h1>
        <p className="text-xs font-semibold text-slate-500">
          예약 완료되거나 업로드가 끝난 인스타그램 피드 포스트들을 날짜별로 한눈에 관리하고 실시간 진행 상태를 파악합니다.
        </p>
      </div>

      {/* Scheduler Info & Simulator Panel Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-8 flex gap-3.5 items-start">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">백그라운드 스케줄러 시뮬레이터</h4>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              예약 상태(`scheduled`) 피드는 정해진 시간 정각에 인스타그램 API를 호출하여 즉시 자동 발행 처리됩니다. 
              우측 [스케줄러 즉시 가동] 버튼을 누르면 대기 상태의 예약 건들을 강제로 인스타 업로드 완료(`posted`) 처리할 수 있습니다.
            </p>
          </div>
        </div>

        <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 pl-0 md:pl-6 flex flex-col sm:flex-row md:flex-col justify-between items-stretch gap-3">
          <div className="flex justify-between items-center text-xs font-semibold px-1">
            <span className="text-slate-500">발행 대기 중인 예약</span>
            <span className="text-[#ff4f00] font-black text-sm bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded">
              {scheduledCount}개
            </span>
          </div>

          <button
            type="button"
            disabled={triggering}
            onClick={handleRunScheduler}
            className="py-2.5 px-4 text-xs font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55 shadow-sm active:scale-[0.98] transition-all"
          >
            {triggering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>API 배포 시뮬레이션 중...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>스케줄러 즉시 가동 (시뮬레이션)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Message Notifications */}
      {message && (
        <div className={`p-4 rounded-lg border flex gap-2.5 text-xs font-semibold ${
          message.type === 'success' 
            ? 'border-emerald-250 bg-emerald-50 text-emerald-700' 
            : 'border-red-250 bg-red-50 text-red-700'
        }`}>
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <Filter className="w-4 h-4 text-slate-400 mr-2" />
        {(Object.keys(filterMap) as StatusFilter[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              filter === key
                ? 'border-[#ff4f00] bg-[#ff4f00]/5 text-[#ff4f00]'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-black'
            }`}
          >
            {filterMap[key]} ({
              key === 'ALL' 
                ? posts.length 
                : posts.filter(p => p.status.toUpperCase() === key).length
            })
          </button>
        ))}
      </div>

      {/* Calendar List */}
      {dates.length === 0 ? (
        <div className="border border-slate-200 rounded-xl p-16 text-center bg-white shadow-sm">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-700 font-bold">선택한 필터 조건에 해당하는 포스트가 없습니다.</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">새 카드뉴스 캠페인을 생성하고 인스타그램 예약 업로드를 활성화해보세요.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((dateStr) => (
            <div key={dateStr} className="space-y-4">
              {/* Date Header */}
              <h3 className="text-xs font-bold text-slate-750 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg inline-block shadow-sm">
                {dateStr}
              </h3>

              {/* Grouped Posts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {grouped[dateStr].map((post) => {
                  const slideImageUrl = post.campaign.slides[0]?.imageUrl || ''
                  const scheduledTime = new Date(post.scheduledAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })

                  return (
                    <div 
                      key={post.id} 
                      className="border border-slate-200 rounded-xl bg-white overflow-hidden hover:border-[#ff4f00] hover:shadow-md transition-all flex shadow-sm"
                    >
                      {/* Image Thumbnail Preview */}
                      <div className="w-28 h-28 bg-slate-100 relative flex-shrink-0"
                        style={{
                          backgroundImage: slideImageUrl ? `url(${slideImageUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        {!slideImageUrl && (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 text-center p-2">
                            이미지 없음
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[8px] font-black text-white tracking-wider">
                          {post.campaign.slideCount}장
                        </div>
                      </div>

                      {/* Post Brief Info */}
                      <div className="p-4 flex-1 flex flex-col justify-between overflow-hidden">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[10px] font-black text-[#ff4f00] uppercase tracking-wide">{post.brand.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-350" />
                              {scheduledTime}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-900 truncate">{post.campaign.title}</h4>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs font-medium leading-relaxed">{post.caption}</p>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-100 pt-2.5 mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            post.status === 'posted'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : post.status === 'scheduled'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : post.status === 'failed'
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : 'bg-amber-55 bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {post.status === 'posted'
                              ? '발행 완료'
                              : post.status === 'scheduled'
                              ? '예약됨'
                              : post.status === 'failed'
                              ? '실패'
                              : '임시 저장'}
                          </span>

                          <Link
                            href={`/campaign/${post.campaignId}`}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-[#ff4f00] hover:underline transition-colors"
                          >
                            <span>상세 편집</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
