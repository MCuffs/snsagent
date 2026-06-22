'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Zap, Grid3X3, LucideIcon, Clapperboard } from 'lucide-react'
import { useTab } from './TabContext'
import { analytics } from '../../lib/analytics/thinkingdata'
import { useTranslations } from 'next-intl'

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  descKey: string
  href: string
  badge?: string
}

const navItems: NavItem[] = [
  { key: 'concept', label: 'Concept', icon: BookOpen, descKey: 'nav_concept_desc', href: '/concept' },
  { key: 'generate', label: 'Generate', icon: Zap, descKey: 'nav_generate_desc', href: '/concept?tab=generate' },
  { key: 'video-cardnews', label: '영상 카드뉴스', icon: Clapperboard, descKey: 'nav_video_cardnews_desc', href: '/concept?tab=video-cardnews', badge: 'Beta' },
  { key: 'works', label: 'Works', icon: Grid3X3, descKey: 'nav_works_desc', href: '/concept?tab=works' },
]

interface SidebarNavProps {
  hasCompleteBrand: boolean
  locale?: string
}

export default function SidebarNav({ hasCompleteBrand, locale }: SidebarNavProps) {
  const pathname = usePathname()
  const { activeTab, setActiveTab } = useTab()
  const t = useTranslations('cms')
  const prefix = locale ? `/${locale}` : ''
  const conceptPath = `${prefix}/concept`

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    analytics.sidebarClick(item.key, {
      from_tab: activeTab,
      to_tab: item.key,
      has_complete_brand: hasCompleteBrand,
    })
    if (pathname === conceptPath) {
      e.preventDefault()
      if (activeTab !== item.key) {
        analytics.tabSwitch(activeTab, item.key, {
          has_complete_brand: hasCompleteBrand,
        })
      }
      setActiveTab(item.key)
    }
  }

  return (
    <nav className="flex-1 space-y-0.5 px-2 py-3">
      {navItems.map((item) => {
        const Icon = item.icon
        const disabled = !hasCompleteBrand && item.key !== 'concept'
        const href = item.key === 'concept' ? conceptPath : `${conceptPath}${item.href.replace('/concept', '')}`
        const isActive = pathname === conceptPath && activeTab === item.key

        if (disabled) {
          return (
            <span
              key={item.key}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm opacity-30"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium leading-none">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-[#71717a]">{t(item.descKey as Parameters<typeof t>[0])}</p>
              </div>
            </span>
          )
        }

        return (
          <Link
            key={item.key}
            href={href}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
              isActive
                ? 'bg-[#111111] text-white font-medium'
                : 'text-[#52525b] hover:bg-[#f0f0f0] hover:text-[#111111]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium leading-none">{item.label}</p>
                {item.badge && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">{item.badge}</span>
                )}
              </div>
              <p className={`mt-0.5 text-[11px] ${isActive ? 'text-[#a1a1aa]' : 'text-[#71717a]'}`}>
                {t(item.descKey as Parameters<typeof t>[0])}
              </p>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
