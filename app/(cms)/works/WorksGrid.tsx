'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Clock, ImageOff, Loader2, Trash2 } from 'lucide-react'
import { useTab } from '../TabContext'
import { motion } from 'framer-motion'
import { deleteWorkAction } from './actions'
import { analytics } from '../../../lib/analytics/thinkingdata'

interface WorkItem {
  id: string
  title: string
  status: string
  createdAt: string
  thumbnail: string | null
  expiresAt: string
  daysUntilDeletion: number
  expiresSoon: boolean
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.015,
      delayChildren: 0
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.24,
      ease: [0.16, 1, 0.3, 1] as const
    }
  }
}

interface WorksGridProps {
  campaigns: WorkItem[]
  planName: string
  retentionDays: number
  canUpgradeRetention: boolean
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

function expiryLabel(item: WorkItem) {
  if (item.daysUntilDeletion === 0) return '오늘 자동 삭제'
  return `${item.daysUntilDeletion}일 후 자동 삭제`
}

export default function WorksGrid({
  campaigns,
  planName,
  retentionDays,
  canUpgradeRetention,
}: WorksGridProps) {
  const { setActiveTab } = useTab()
  const router = useRouter()
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const displayedCampaigns = campaigns.filter(campaign => !deletedIds.includes(campaign.id))

  const deleteCampaign = async (item: WorkItem) => {
    if (!window.confirm(`"${item.title}" 작업물을 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return

    analytics.campaignDelete(item.id)
    setError(null)
    setDeletingId(item.id)
    const result = await deleteWorkAction(item.id)
    setDeletingId(null)
    if (!result.success) {
      setError(result.error)
      return
    }

    setDeletedIds(current => [...current, item.id])
    router.refresh()
  }

  if (displayedCampaigns.length === 0) {
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
            onClick={(e) => {
              e.preventDefault()
              setActiveTab('generate')
            }}
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
          onClick={(e) => {
            e.preventDefault()
            setActiveTab('generate')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#333333]"
        >
          새로 만들기
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e4dc] bg-[#fcfaf6] px-4 py-3">
        <p className="text-xs font-medium text-[#625b53]">
          <span className="font-bold text-[#111111]">{planName}</span> 플랜은 작업물을 {retentionDays}일 동안 보관합니다.
          삭제 10일 전부터 카드에 안내됩니다.
        </p>
        {canUpgradeRetention && (
          <Link href="/billing" className="text-xs font-bold text-[#0066ff] transition hover:text-[#004ec4]">
            보관 기간 늘리기 →
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {displayedCampaigns.map((item) => {
          const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, color: 'bg-[#f4f4f5] text-[#52525b]' }
          return (
            <motion.div
              key={item.id}
              variants={itemVariants}
              className="relative"
            >
              <Link
                href={`/campaign/${item.id}`}
                onMouseEnter={() => router.prefetch(`/campaign/${item.id}`)}
                onFocus={() => router.prefetch(`/campaign/${item.id}`)}
                onClick={() => setOpeningId(item.id)}
                className="group block overflow-hidden rounded-xl border border-[#e4e4e7] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a1a1aa] hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#f4f4f5]">
                  {item.expiresSoon && (
                    <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 shadow-sm ring-1 ring-amber-200">
                      <AlertTriangle className="h-3 w-3" />
                      {expiryLabel(item)}
                    </span>
                  )}
                  {item.thumbnail ? (
                    // Thumbnails can be runtime Blob or data URLs that are not valid Next Image sources.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
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
                  {item.expiresSoon && (
                    <p className="mt-2 text-[11px] font-semibold text-amber-700">
                      {formatDate(item.expiresAt)} 삭제 예정
                    </p>
                  )}
                </div>
                {openingId === item.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#111111]" />
                  </div>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void deleteCampaign(item)}
                disabled={deletingId === item.id}
                aria-label={`${item.title} 삭제`}
                className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#71717a] shadow-sm ring-1 ring-[#e4e4e7] transition hover:bg-red-50 hover:text-red-600 hover:ring-red-200 disabled:opacity-60"
              >
                {deletingId === item.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
