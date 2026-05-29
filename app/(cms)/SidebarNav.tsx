'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Zap, Grid3X3, LucideIcon } from 'lucide-react'
import { useTab } from './TabContext'
import { analytics } from '../../lib/analytics/thinkingdata'

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  desc: string
  href: string
}

const navItems: NavItem[] = [
  { key: 'concept', label: 'Concept', icon: BookOpen, desc: '브랜드 프로필', href: '/concept' },
  { key: 'generate', label: 'Generate', icon: Zap, desc: '카드뉴스 생성', href: '/concept?tab=generate' },
  { key: 'works', label: 'Works', icon: Grid3X3, desc: '작업 히스토리', href: '/concept?tab=works' },
]

interface SidebarNavProps {
  hasCompleteBrand: boolean
}

export default function SidebarNav({ hasCompleteBrand }: SidebarNavProps) {
  const pathname = usePathname()
  const { activeTab, setActiveTab } = useTab()

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    analytics.sidebarClick(item.key)
    if (pathname === '/concept') {
      e.preventDefault()
      setActiveTab(item.key)
    }
  }

  return (
    <nav className="flex-1 space-y-0.5 px-2 py-3">
      {navItems.map((item) => {
        const Icon = item.icon
        const disabled = !hasCompleteBrand && item.key !== 'concept'
        const isActive = pathname === '/concept' && activeTab === item.key

        if (disabled) {
          return (
            <span
              key={item.key}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm opacity-30"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium leading-none">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-[#71717a]">{item.desc}</p>
              </div>
            </span>
          )
        }

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={(e) => handleNavClick(e, item)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
              isActive
                ? 'bg-[#111111] text-white font-medium'
                : 'text-[#52525b] hover:bg-[#f0f0f0] hover:text-[#111111]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium leading-none">{item.label}</p>
              <p className={`mt-0.5 text-[11px] ${isActive ? 'text-[#a1a1aa]' : 'text-[#71717a]'}`}>
                {item.desc}
              </p>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
