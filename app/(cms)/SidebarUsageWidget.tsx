'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ImageIcon, Video, Clock } from 'lucide-react'
import type { UsageSummary } from '../../lib/usage-summary'

type UsageData = UsageSummary

const PLAN_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  FREE: 'Free',
  PRO: 'Creator',
  UNLIMITED: 'Studio',
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit >= 999999 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const isHigh = pct >= 80
  const isFull = pct >= 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
      <div
        className={`h-full rounded-full transition-all ${isFull ? 'bg-red-400' : isHigh ? 'bg-amber-400' : 'bg-[#111111]'}`}
        style={{ width: limit >= 999999 ? '0%' : `${pct}%` }}
      />
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

export function SidebarUsageWidget({ initialData = null }: { initialData?: UsageData | null }) {
  const [data, setData] = useState<UsageData | null>(initialData)
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as UsageData) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!data) return null

  const periodLabel = data.period === 'lifetime' ? '누적' : '이번 달'

  return (
    <>
      {/* 트리거 */}
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-[#f3f4f6]"
      >
        <p className="mb-1.5 text-[11px] font-semibold text-[#374151]">
          {periodLabel} 생성 횟수
        </p>
        <div className="space-y-1.5">
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] text-[#6b7280]">
              <span className="flex items-center gap-1">
                <ImageIcon className="h-2.5 w-2.5" />
                이미지 카드뉴스
              </span>
              <span>
                {data.image.limit >= 999999 ? '∞' : `${data.image.used} / ${data.image.limit}`}
              </span>
            </div>
            <UsageBar used={data.image.used} limit={data.image.limit} />
          </div>
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] text-[#6b7280]">
              <span className="flex items-center gap-1">
                <Video className="h-2.5 w-2.5" />
                영상 카드뉴스
              </span>
              <span>
                {data.video.limit >= 999999 ? '∞' : `${data.video.used} / ${data.video.limit}`}
              </span>
            </div>
            <UsageBar used={data.video.used} limit={data.video.limit} />
          </div>
        </div>
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" />}

      {/* 팝업 */}
      <div
        ref={popupRef}
        className={`fixed bottom-[52px] left-3 z-50 w-[280px] overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-2xl transition-all duration-200 ${
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
          <span className="text-sm font-bold text-[#111111]">생성 이력</span>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-[#71717a] hover:bg-[#f0f0f0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 현재 사용량 요약 */}
        <div className="border-b border-[#e4e4e7] px-4 py-3 space-y-2">
          <p className="text-[11px] font-semibold text-[#374151]">
            {PLAN_LABELS[data.plan] ?? data.plan} 플랜 · {periodLabel}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f9fafb] px-3 py-2">
              <p className="text-[10px] text-[#6b7280]">이미지</p>
              <p className="text-sm font-bold text-[#111111]">
                {data.image.used}
                <span className="text-[11px] font-normal text-[#9ca3af]">
                  {data.image.limit < 999999 ? ` / ${data.image.limit}` : ''}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-[#f9fafb] px-3 py-2">
              <p className="text-[10px] text-[#6b7280]">영상</p>
              <p className="text-sm font-bold text-[#111111]">
                {data.video.used}
                <span className="text-[11px] font-normal text-[#9ca3af]">
                  {data.video.limit < 999999 ? ` / ${data.video.limit}` : ''}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* 이력 */}
        <div className="max-h-[280px] overflow-y-auto">
          {data.history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <Clock className="h-6 w-6 text-[#d1d5db]" />
              <p className="text-[12px] text-[#9ca3af]">아직 생성한 콘텐츠가 없습니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#f3f4f6]">
              {data.history.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    item.mediaType === 'video'
                      ? 'bg-purple-50 text-purple-500'
                      : 'bg-blue-50 text-blue-500'
                  }`}>
                    {item.mediaType === 'video'
                      ? <Video className="h-3.5 w-3.5" />
                      : <ImageIcon className="h-3.5 w-3.5" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[#111111]">{item.title}</p>
                    <p className="text-[10px] text-[#9ca3af]">
                      {formatDate(item.createdAt)} · {item.mediaType === 'video' ? '영상' : '이미지'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
