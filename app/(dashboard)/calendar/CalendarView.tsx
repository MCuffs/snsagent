'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Calendar, Clock, Loader2, Play } from 'lucide-react'
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

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Content Calendar</p>
        <div className="mt-3 flex items-start gap-3">
          <Calendar className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">콘텐츠 캘린더</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
              생성된 포스트의 예약 상태와 게시 결과를 날짜별로 확인합니다.
            </p>
          </div>
        </div>
      </div>

      <section className="panel mb-6 rounded-lg p-5 md:flex md:items-center md:justify-between">
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 text-[#b94718]" />
          <div>
            <p className="text-sm font-bold text-neutral-950">스케줄러 시뮬레이터</p>
            <p className="mt-1 text-xs leading-5 text-[#6f6a61]">
              현재는 실제 cron 대신 버튼으로 예약 상태의 포스트를 게시 완료로 전환합니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={triggering || scheduledCount === 0}
          onClick={runScheduler}
          className="btn-primary mt-4 px-4 disabled:cursor-not-allowed disabled:opacity-50 md:mt-0"
        >
          {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          예약 {scheduledCount}건 처리
        </button>
      </section>

      {message && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm font-bold ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
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
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              filter === item.key
                ? 'border-[#b94718] bg-[#b94718] text-white'
                : 'border-[#dedbd2] bg-white text-[#6f6a61] hover:border-[#c7c2b8]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {dates.length === 0 ? (
        <div className="panel rounded-lg p-12 text-center">
          <AlertCircle className="mx-auto h-9 w-9 text-[#aaa49a]" />
          <p className="mt-4 text-sm font-bold text-neutral-950">표시할 포스트가 없습니다.</p>
          <p className="mt-2 text-xs text-[#6f6a61]">카드뉴스를 생성하고 승인하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-black text-neutral-950">{date}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {grouped[date].map((post) => {
                  const imageUrl = post.campaign.slides[0]?.imageUrl
                  const time = new Date(post.scheduledAt).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })

                  return (
                    <article key={post.id} className="panel flex overflow-hidden rounded-lg">
                      <div
                        className="h-28 w-28 shrink-0 bg-[#f1f0eb]"
                        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-[#b94718]">
                            {post.brand.name}
                          </span>
                          <span className="text-xs font-bold text-[#6f6a61]">{time}</span>
                        </div>
                        <h3 className="truncate text-sm font-black text-neutral-950">{post.campaign.title}</h3>
                        <p className="mt-1 truncate text-xs text-[#6f6a61]">{post.caption}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="rounded-full border border-[#dedbd2] bg-[#f1f0eb] px-2 py-1 text-[11px] font-bold text-[#6f6a61]">
                            {statusLabel(post.status)}
                          </span>
                          <Link href={`/campaign/${post.campaignId}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#b94718]">
                            열기
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
