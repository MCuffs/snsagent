'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

interface MobileHeaderProps {
  children?: React.ReactNode
  locale?: string
}

export default function MobileHeader({ children, locale }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const prefix = locale ? `/${locale}` : ''

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex h-[60px] items-center justify-between border-b border-[#e4e4e7] bg-[#fafafa] px-5 lg:hidden shrink-0">
        <Link href={`${prefix}/concept`} className="flex items-center gap-2.5">
          <Image src="/shuffla-logo-mark.png" width={27} height={27} alt="Shuffla logo" />
          <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
        </Link>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-lg p-2 text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors"
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
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[260px] flex-col border-l border-[#e4e4e7] bg-[#fafafa] shadow-xl lg:hidden"
            >
              {/* Close Button */}
              <div className="flex h-[60px] items-center justify-between border-b border-[#e4e4e7] px-5">
                <span className="text-[14px] font-bold text-[#111111]">{locale === 'en' ? 'Menu' : '메뉴'}</span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-[#52525b] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors"
                  aria-label={locale === 'en' ? 'Close menu' : '메뉴 닫기'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto" onClick={() => setIsOpen(false)}>
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
