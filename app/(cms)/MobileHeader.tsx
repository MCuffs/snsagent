'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ChevronDown, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface MobileHeaderProps {
  children?: React.ReactNode
  locale?: string
}

const CloseMobileMenuContext = createContext<() => void>(() => undefined)
const MOBILE_FEATURE_MENU_SEEN_KEY = 'shuffla-mobile-feature-menu-seen'

export function useCloseMobileMenu() {
  return useContext(CloseMobileMenuContext)
}

export default function MobileHeader({ children, locale }: MobileHeaderProps) {
  const pathname = usePathname()
  const billingPath = locale ? `/${locale}/billing` : '/billing'
  const [isOpen, setIsOpen] = useState(false)

  const prefix = locale ? `/${locale}` : ''

  const closeMenu = useCallback(() => {
    window.localStorage.setItem(MOBILE_FEATURE_MENU_SEEN_KEY, 'true')
    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (pathname === billingPath) return
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    if (window.localStorage.getItem(MOBILE_FEATURE_MENU_SEEN_KEY) === 'true') return

    const frame = window.requestAnimationFrame(() => setIsOpen(true))
    return () => window.cancelAnimationFrame(frame)
  }, [billingPath, pathname])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, isOpen])

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#e4e4e7] bg-[#fafafa] px-5 lg:hidden">
        <Link href={`${prefix}/concept`} className="tap-sm flex items-center gap-2.5">
          <Image src="/shuffla-logo-mark.png" width={27} height={27} alt="Shuffla logo" />
          <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#dfe3ea] bg-white px-3 text-[#3f4652] shadow-sm transition-colors hover:border-[#cbd2dc] hover:bg-[#f4f6f8] hover:text-[#111111]"
          aria-label={locale === 'en' ? 'Explore features' : '기능 둘러보기'}
          aria-expanded={isOpen}
        >
          <Menu className="h-4 w-4" />
          <span className="text-xs font-bold">{locale === 'en' ? 'Features' : '기능 둘러보기'}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* Drawer Overlay & Content */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="fixed inset-0 z-40 bg-black lg:hidden"
            />
            {/* Drawer — full height including safe area */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#fafafa] shadow-xl lg:hidden"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Close Button */}
              <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#e4e4e7] px-5">
                <div>
                  <p className="text-[14px] font-bold text-[#111111]">{locale === 'en' ? 'Explore features' : '기능 둘러보기'}</p>
                  <p className="mt-0.5 text-[11px] text-[#7c8491]">
                    {locale === 'en' ? 'Choose what you want to create.' : '원하는 제작 기능을 선택해 보세요.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors"
                  aria-label={locale === 'en' ? 'Close menu' : '메뉴 닫기'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div
                className="min-h-0 flex-1 overflow-y-auto"
                onClick={(e) => {
                  if (e.defaultPrevented) return
                  // Only close drawer when clicking an actual navigation link, not upgrade modals
                  if ((e.target as HTMLElement).closest('a[href]')) {
                    closeMenu()
                  }
                }}
              >
                <CloseMobileMenuContext.Provider value={closeMenu}>
                  {children}
                </CloseMobileMenuContext.Provider>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
