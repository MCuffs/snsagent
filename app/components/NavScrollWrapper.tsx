'use client'

export function NavScrollWrapper({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/92 text-[#171714] backdrop-blur-xl [&_.nav-cta]:bg-[#171714] [&_.nav-cta]:text-white">
      {children}
    </header>
  )
}
