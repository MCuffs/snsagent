'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

interface MobileHeaderProps {
  children?: React.ReactNode
  locale?: string
}

const CloseMobileMenuContext = createContext<() => void>(() => undefined)

export function useCloseMobileMenu() {
  return useContext(CloseMobileMenuContext)
}

export default function MobileHeader({ children, locale }: MobileHeaderProps) {
  const pathname = usePathname()
  const billingPath = locale ? `/${locale}/billing` : '/billing'
  const shouldOpenByDefault = pathname !== billingPath
  const [isOpen, setIsOpen] = useState(shouldOpenByDefault)

  const prefix = locale ? `/${locale}` : ''

  useEffect(() => {
    setIsOpen(shouldOpenByDefault)
  }, [shouldOpenByDefault])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

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
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors"
          aria-label={locale === 'en' ? 'Open menu' : '메뉴 열기'}
        >
          <Menu className="h-5 w-5" />
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
              onClick={() => setIsOpen(false)}
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
                <span className="text-[14px] font-bold text-[#111111]">{locale === 'en' ? 'Menu' : '메뉴'}</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
                    setIsOpen(false)
                  }
                }}
              >
                <CloseMobileMenuContext.Provider value={() => setIsOpen(false)}>
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
