'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Calendar, Clock, Loader2, Play, Move } from 'lucide-react'
import { triggerSchedulerAction, updatePostScheduledTimeAction } from '../../actions'

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

const filters = [
  { key: 'ALL', label: '전체' },
  { key: 'pending_approval', label: '검토 대기' },
  { key: 'scheduled', label: '예약됨' },
  { key: 'posted', label: '게시 완료' },
  { key: 'failed', label: '실패' },
]

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending_approval: '검토 대기',
    scheduled: '예약됨',
    posted: '게시 완료',
    failed: '실패',
    draft: '초안',
  }
  return map[status] || status
}

export default function CalendarView({ posts }: CalendarViewProps) {
  const router = useRouter()
  const [filter, setFilter] = useState('ALL')
  const [triggering, setTriggering] = useState(false)
  const [activeDropDate, setActiveDropDate] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const filteredPosts = posts.filter((post) => filter === 'ALL' || post.status === filter)
  const scheduledCount = posts.filter((post) => post.status === 'scheduled').length

  const grouped = filteredPosts.reduce<Record<string, Post[]>>((acc, post) => {
    const key = new Date(post.scheduledAt).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
    acc[key] = [...(acc[key] || []), post]
    return acc
  }, {})

  const dates = Object.keys(grouped).sort(
    (a, b) => new Date(grouped[a][0].scheduledAt).getTime() - new Date(grouped[b][0].scheduledAt).getTime()
  )

  const runScheduler = async () => {
    setTriggering(true)
    setMessage(null)

    try {
      const result = await triggerSchedulerAction()
      if (result.success) {
        setMessage({ type: 'success', text: result.message || '스케줄러 실행이 완료되었습니다.' })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error || '스케줄러 실행에 실패했습니다.' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, '스케줄러와 통신하지 못했습니다.') })
    } finally {
      setTriggering(false)
    }
  }

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, postId: string) => {
    e.dataTransfer.setData('text/plain', postId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    if (activeDropDate !== dateKey) {
      setActiveDropDate(dateKey)
    }
  }

  const handleDragLeave = () => {
    setActiveDropDate(null)
  }

  const handleDrop = async (e: React.DragEvent, targetDateKey: string, datePosts: Post[]) => {
    e.preventDefault()
    setActiveDropDate(null)
    const postId = e.dataTransfer.getData('text/plain')
    if (!postId) return

    const post = posts.find(p => p.id === postId)
    if (!post) return

    // If status is posted or failed, prevent drag-rescheduling to ensure publishing consistency
    if (post.status === 'posted') {
      setMessage({ type: 'error', text: '이미 발행 완료된 포스트는 예약 날짜를 변경할 수 없습니다.' })
      return
    }

    const currentGroupKey = new Date(post.scheduledAt).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
    if (currentGroupKey === targetDateKey) return

    const baseDate = datePosts[0] ? new Date(datePosts[0].scheduledAt) : null
    if (!baseDate) return

    const oldDate = new Date(post.scheduledAt)
    const newScheduledAt = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      oldDate.getHours(),
      oldDate.getMinutes(),
      oldDate.getSeconds()
    )

    setMessage(null)
    try {
      const result = await updatePostScheduledTimeAction(postId, newScheduledAt.toISOString())
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `"${post.campaign.title}" 포스트의 예약 시간이 ${targetDateKey} ${oldDate.getHours()}시 ${oldDate.getMinutes()}분으로 변경되었습니다.` 
        })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error || '예약 시간 수정에 실패했습니다.' })
      }
    } catch {
      setMessage({ type: 'error', text: '서버와 통신하는 도중 오류가 발생했습니다.' })
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow text-orange-600">Content Calendar</p>
        <div className="mt-3 flex items-start gap-3">
          <Calendar className="mt-1 h-6 w-6 text-orange-600" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">콘텐츠 캘린더</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
              생성된 카드뉴스의 예약 날짜를 드래그앤드롭하여 직관적으로 재스케줄링하고, 게시 결과를 날짜별로 확인합니다.
            </p>
          </div>
        </div>
      </div>

      <section className="panel mb-6 rounded-xl border border-neutral-200 bg-white/70 backdrop-blur-md p-5 md:flex md:items-center md:justify-between shadow-sm">
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 text-orange-600" />
          <div>
            <p className="text-sm font-bold text-neutral-950">스케줄러 시뮬레이터</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              현재 예약된 포스트를 수동으로 발행하거나, 백그라운드 크론 스케줄링 API(`/api/cron/publish`)를 통해 자동 발행할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={triggering || scheduledCount === 0}
          onClick={runScheduler}
          className="btn-primary mt-4 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white disabled:cursor-not-allowed disabled:opacity-50 transition-all font-bold shadow-md shadow-orange-600/20 md:mt-0 flex items-center gap-2"
        >
          {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          예약 {scheduledCount}건 즉시 발행
        </button>
      </section>

      {message && (
        <div className={`mb-6 rounded-lg border px-4 py-3.5 text-sm font-bold transition-all ${
          message.type === 'success' 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm' 
            : 'border-red-200 bg-red-50 text-red-800 shadow-sm'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
              filter === item.key
                ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {dates.length === 0 ? (
        <div className="panel rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-16 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-neutral-400" />
          <p className="mt-4 text-sm font-bold text-neutral-950">표시할 포스트가 없습니다.</p>
          <p className="mt-2 text-xs text-neutral-500">카드뉴스를 생성하고 승인하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {dates.map((date) => {
            const isDraggingOver = activeDropDate === date
            return (
              <section 
                key={date}
                onDragOver={(e) => handleDragOver(e, date)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, date, grouped[date])}
                className={`rounded-xl p-4 transition-all duration-200 border-2 ${
                  isDraggingOver 
                    ? 'border-dashed border-orange-500 bg-orange-50/40 shadow-inner scale-[1.01]' 
                    : 'border-transparent bg-transparent'
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-black text-neutral-800 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-600"></span>
                    {date}
                  </h2>
                  {isDraggingOver && (
                    <span className="text-xs font-bold text-orange-600 animate-pulse flex items-center gap-1">
                      <Move className="h-3 w-3" /> 여기에 드롭하여 예약 변경
                    </span>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {grouped[date].map((post) => {
                    const imageUrl = post.campaign.slides[0]?.imageUrl
                    const time = new Date(post.scheduledAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const isPosted = post.status === 'posted'

                    return (
                      <article 
                        key={post.id} 
                        draggable={!isPosted}
                        onDragStart={(e) => handleDragStart(e, post.id)}
                        className={`panel flex overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 ${
                          isPosted 
                            ? 'opacity-85 select-none' 
                            : 'cursor-grab active:cursor-grabbing hover:border-orange-200'
                        }`}
                      >
                        <div
                          className="h-28 w-28 shrink-0 bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 font-bold"
                          style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                        >
                          {!imageUrl && 'No Image'}
                        </div>
                        <div className="min-w-0 flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <span className="truncate text-[10px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                                {post.brand.name}
                              </span>
                              <span className="text-xs font-bold text-neutral-400 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {time}
                              </span>
                            </div>
                            <h3 className="truncate text-sm font-black text-neutral-900">{post.campaign.title}</h3>
                            <p className="mt-1 truncate text-xs text-neutral-500 leading-relaxed">{post.caption}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              post.status === 'posted' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : post.status === 'failed'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : post.status === 'scheduled'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-neutral-50 text-neutral-700 border border-neutral-200'
                            }`}>
                              {statusLabel(post.status)}
                            </span>
                            <div className="flex items-center gap-2">
                              {!isPosted && (
                                <span className="text-[10px] font-bold text-neutral-400 flex items-center gap-0.5 cursor-grab">
                                  <Move className="h-3 w-3" /> 드래그 가능
                                </span>
                              )}
                              <Link href={`/campaign/${post.campaignId}`} className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 hover:text-orange-700 hover:underline">
                                열기
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
