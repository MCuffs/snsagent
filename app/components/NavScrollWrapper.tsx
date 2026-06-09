'use client'

import { useEffect, useState } from 'react'

export function NavScrollWrapper({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-[#ede9e2] bg-[#fbfaf7]/92 text-[#171714] backdrop-blur-xl [&_.nav-cta]:bg-[#171714] [&_.nav-cta]:text-white'
          : 'border-b border-white/8 bg-[#0a0a0a]/70 text-white backdrop-blur-md [&_.nav-cta]:bg-white/10 [&_.nav-cta]:text-white [&_.nav-cta]:ring-1 [&_.nav-cta]:ring-white/20'
      }`}
    >
      {children}
    </header>
  )
}
