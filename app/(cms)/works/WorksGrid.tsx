'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, ImageOff } from 'lucide-react'

interface WorkItem {
  id: string
  title: string
  status: string
  createdAt: string
  thumbnail: string | null
}

interface WorksGridProps {
  campaigns: WorkItem[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  generated: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  draft: { label: '임시저장', color: 'bg-[#f4f4f5] text-[#52525b]' },
  pending_approval: { label: '검토 중', color: 'bg-amber-100 text-amber-700' },
  scheduled: { label: '보관됨', color: 'bg-blue-100 text-blue-700' },
  posted: { label: '완료', color: 'bg-purple-100 text-purple-700' },
  failed: { label: '실패', color: 'bg-red-100 text-red-700' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function WorksGrid({ campaigns }: WorksGridProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-24">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f4f5]">
            <ImageOff className="h-7 w-7 text-[#a1a1aa]" />
          </div>
          <h2 className="text-lg font-bold text-[#111111]">아직 생성된 카드뉴스가 없습니다</h2>
          <p className="mt-2 text-sm text-[#71717a]">첫 번째 카드뉴스를 생성해보세요.</p>
          <Link
            href="/concept?tab=generate"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#333333]"
          >
            카드뉴스 생성하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Works</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111111]">작업 히스토리</h1>
        </div>
        <Link
          href="/concept?tab=generate"
          className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#333333]"
        >
          새로 만들기
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((item) => {
          const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: 'bg-[#f4f4f5] text-[#52525b]' }
          return (
            <Link
              key={item.id}
              href={`/campaign/${item.id}`}
              className="group overflow-hidden rounded-xl border border-[#e4e4e7] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a1a1aa] hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#f4f4f5]">
                {item.thumbnail ? (
                  <Image
                    src={item.thumbnail}
                    alt={item.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageOff className="h-8 w-8 text-[#d4d4d8]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-[#111111] leading-snug">{item.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                  <Clock className="h-3 w-3" />
                  {formatDate(item.createdAt)}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
