'use client'

import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Zap, Grid3X3, LucideIcon, Clapperboard, Lock, Sparkles, X, TvMinimalPlay } from 'lucide-react'
import { useTab } from './TabContext'
import { analytics } from '../../lib/analytics/thinkingdata'
import { useTranslations } from 'next-intl'
import { useCloseMobileMenu } from './MobileHeader'

interface NavItem {
  key: string
  label: string
  labelKey: string
  icon: LucideIcon
  descKey: string
  href: string
  badge?: string
}

const navItems: NavItem[] = [
  { key: 'concept', label: 'Concept', labelKey: 'nav_concept', icon: BookOpen, descKey: 'nav_concept_desc', href: '/concept' },
  { key: 'generate', label: 'Generate', labelKey: 'nav_generate', icon: Zap, descKey: 'nav_generate_desc', href: '/concept?tab=generate' },
  { key: 'video-cardnews', label: '영상 카드뉴스', labelKey: 'nav_video', icon: Clapperboard, descKey: 'nav_video_cardnews_desc', href: '/concept?tab=video-cardnews', badge: 'Beta' },
  { key: 'youtube-automation', label: 'YouTube', labelKey: 'nav_youtube_automation', icon: TvMinimalPlay, descKey: 'nav_youtube_automation_desc', href: '/concept?tab=youtube-automation', badge: 'New' },
  { key: 'shorts-lab', label: 'Shorts Lab', labelKey: 'nav_shorts_lab', icon: Sparkles, descKey: 'nav_shorts_lab_desc', href: '/concept?tab=shorts-lab', badge: 'Beta' },
  { key: 'works', label: 'Works', labelKey: 'nav_works', icon: Grid3X3, descKey: 'nav_works_desc', href: '/concept?tab=works' },
]

interface SidebarNavProps {
  hasCompleteBrand: boolean
  locale?: string
  userPlan?: string | null
  canAccessShortsLab?: boolean
}

export default function SidebarNav({
  hasCompleteBrand,
  locale,
  userPlan,
  canAccessShortsLab = false,
}: SidebarNavProps) {
  const pathname = usePathname()
  const { activeTab, setActiveTab } = useTab()
  const closeMobileMenu = useCloseMobileMenu()
  const t = useTranslations('cms')
  const [showVideoUpgradePrompt, setShowVideoUpgradePrompt] = useState(false)
  const [upgradeFeatureName, setUpgradeFeatureName] = useState('영상 카드뉴스')
  const portalReady = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const prefix = locale ? `/${locale}` : ''
  const conceptPath = `${prefix}/concept`
  const pricingPath = `${prefix}/pricing`
  const isFreePlan = !userPlan || userPlan === 'FREE'
  const isYouTubePromoPlan = userPlan === 'YOUTUBE_PROMO'
  const canUseVideoFeatures = !isFreePlan && !isYouTubePromoPlan
  const isYouTubeUpgradePrompt = upgradeFeatureName === '유튜브 자동화'

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    const blockedVideoFeature = item.key === 'video-cardnews' && !canUseVideoFeatures
    if (blockedVideoFeature) {
      e.preventDefault()
      setUpgradeFeatureName('영상 카드뉴스')
      setShowVideoUpgradePrompt(true)
      window.setTimeout(() => {
        analytics.sidebarClick(item.key, {
          from_tab: activeTab,
          to_tab: item.key,
          has_complete_brand: hasCompleteBrand,
        })
      }, 0)
      return
    }

    if (pathname === conceptPath) {
      e.preventDefault()
      setActiveTab(item.key)
    }
    closeMobileMenu()

    window.setTimeout(() => {
      analytics.sidebarClick(item.key, {
        from_tab: activeTab,
        to_tab: item.key,
        has_complete_brand: hasCompleteBrand,
      })
    }, 0)
  }

  return (
    <>
      <nav className="flex-1 space-y-1 px-2.5 py-3">
        {navItems.filter(item => item.key !== 'shorts-lab' || canAccessShortsLab).map((item) => {
        const Icon = item.icon
        const disabled = false
        const href = item.key === 'concept' ? `${conceptPath}?tab=concept` : `${conceptPath}${item.href.replace('/concept', '')}`
        const isActive = pathname === conceptPath && activeTab === item.key

        if (disabled) {
          return (
            <span
              key={item.key}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm opacity-30"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium leading-none">{t(item.labelKey as Parameters<typeof t>[0])}</p>
                <p className="mt-0.5 text-[11px] text-[#9ca3af]">{t(item.descKey as Parameters<typeof t>[0])}</p>
              </div>
            </span>
          )
        }

        return (
          <Link
            key={item.key}
            href={href}
            onClick={(e) => handleNavClick(e, item)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-100 ${
              isActive
                ? 'bg-[#111827]/95 text-white font-semibold shadow-[0_14px_32px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.34)_inset]'
                : 'text-[#475569] hover:bg-white/58 hover:text-[#111827] hover:shadow-[0_10px_26px_rgba(87,119,185,0.08)]'
            }`}
          >
            {isActive && (
              <span className="absolute -left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-[#9eb8ff]" />
            )}
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white/86' : 'text-[#64748b] group-hover:text-[#4252ff]'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium leading-none">{t(item.labelKey as Parameters<typeof t>[0])}</p>
                {item.key === 'video-cardnews' && !canUseVideoFeatures && (
                  <Lock className={`h-3 w-3 ${isActive ? 'text-white/70' : 'text-[#9ca3af]'}`} />
                )}
                {item.badge && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">{item.badge}</span>
                )}
              </div>
              <p className={`mt-0.5 text-[11px] ${isActive ? 'text-white/58' : 'text-[#94a3b8]'}`}>
                {t(item.descKey as Parameters<typeof t>[0])}
              </p>
            </div>
          </Link>
        )
        })}
      </nav>

      {portalReady && showVideoUpgradePrompt && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-2xl border border-white/70 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4252ff]">
                <Sparkles className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowVideoUpgradePrompt(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#111827]"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <h2 className="text-base font-black text-[#111827]">
                {isYouTubeUpgradePrompt
                  ? '유튜브 자동화는 YouTube Promo 플랜부터 사용할 수 있습니다.'
                  : `${upgradeFeatureName}는 Creator 플랜부터 사용할 수 있습니다.`}
              </h2>
              <p className="text-sm font-medium leading-6 text-[#6b7280]">
                {isYouTubeUpgradePrompt
                  ? '월 9,900원 YouTube Promo 플랜에서 30일 쇼츠 플래너와 유튜브 자동화를 사용할 수 있습니다.'
                  : '월 25,000원 Creator 이상 플랜에서 사용할 수 있습니다. Free 플랜에서는 기본 카드뉴스 체험만 제공됩니다.'}
              </p>
              {isYouTubeUpgradePrompt && (
                <p className="rounded-xl bg-[#f5f7ff] px-3 py-2 text-xs font-bold leading-5 text-[#4252ff]">
                  Day 1 영상 제작은 무료로 체험할 수 있습니다. Day 2부터 플랜 업그레이드가 필요합니다.
                </p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Link
                href={pricingPath}
                className="flex flex-1 items-center justify-center rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1f2937]"
              >
                요금제 보기
              </Link>
              <button
                type="button"
                onClick={() => setShowVideoUpgradePrompt(false)}
                className="rounded-xl border border-[#e5e7eb] px-4 py-2.5 text-sm font-bold text-[#6b7280] transition-colors hover:bg-[#f9fafb]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
