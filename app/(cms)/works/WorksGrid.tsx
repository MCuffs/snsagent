'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Clock, ImageOff, Loader2, Trash2 } from 'lucide-react'
import { useTab } from '../TabContext'
import { motion } from 'framer-motion'
import { deleteWorkAction } from './actions'
import { analytics } from '../../../lib/analytics/thinkingdata'
import { useTranslations } from 'next-intl'

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

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function WorksGrid({
  campaigns,
  planName,
  retentionDays,
  canUpgradeRetention,
}: WorksGridProps) {
  const { setActiveTab } = useTab()
  const router = useRouter()
  const t = useTranslations('works')
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const displayedCampaigns = campaigns.filter(campaign => !deletedIds.includes(campaign.id))

  useEffect(() => {
    analytics.worksView(displayedCampaigns.length, {
      current_plan: planName,
      retention_days: retentionDays,
      can_upgrade_retention: canUpgradeRetention,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    generated: { label: t('status_complete'), color: 'bg-emerald-100 text-emerald-700' },
    draft: { label: t('status_draft'), color: 'bg-[#f4f4f5] text-[#52525b]' },
    pending_approval: { label: t('status_review'), color: 'bg-amber-100 text-amber-700' },
    scheduled: { label: t('status_archived'), color: 'bg-blue-100 text-blue-700' },
    posted: { label: t('status_complete'), color: 'bg-purple-100 text-purple-700' },
    failed: { label: t('status_failed'), color: 'bg-red-100 text-red-700' },
  }

  const expiryLabel = (item: WorkItem) => {
    if (item.daysUntilDeletion === 0) return t('today_delete')
    return t('days_delete', { days: item.daysUntilDeletion })
  }

  const deleteCampaign = async (item: WorkItem) => {
    if (!window.confirm(t('delete_confirm', { title: item.title }))) return

    analytics.campaignDelete(item.id, {
      campaign_status: item.status,
    })
    setError(null)
    setDeletingId(item.id)
    const result = await deleteWorkAction(item.id)
    setDeletingId(null)
    if (!result.success) {
      analytics.campaignDelete(item.id, {
        campaign_status: item.status,
        success: false,
        reason: result.error,
      })
      setError(result.error)
      return
    }

    analytics.campaignDelete(item.id, {
      campaign_status: item.status,
      success: true,
    })
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
          <h2 className="text-lg font-bold text-[#111111]">{t('empty_title')}</h2>
          <p className="mt-2 text-sm text-[#71717a]">{t('empty_desc')}</p>
          <Link
            href="/concept?tab=generate"
            onClick={(e) => {
              e.preventDefault()
              setActiveTab('generate')
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#333333]"
          >
            {t('create_btn')}
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#111111]">{t('title')}</h1>
        </div>
        <Link
          href="/concept?tab=generate"
          onClick={(e) => {
            e.preventDefault()
            setActiveTab('generate')
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#333333]"
        >
          {t('new_btn')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e8e4dc] bg-[#fcfaf6] px-4 py-3">
        <p className="text-xs font-medium text-[#625b53]">
          {t('retention_notice', { plan: planName, days: retentionDays })}
        </p>
        {canUpgradeRetention && (
          <Link href="/billing" className="text-xs font-bold text-[#0066ff] transition hover:text-[#004ec4]">
            {t('upgrade_retention')}
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
                onClick={() => {
                  analytics.workOpen(item.id, {
                    campaign_status: item.status,
                    days_until_deletion: item.daysUntilDeletion,
                    expires_soon: item.expiresSoon,
                  })
                  setOpeningId(item.id)
                }}
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
