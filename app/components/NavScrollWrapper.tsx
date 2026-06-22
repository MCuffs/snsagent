'use client'

export function NavScrollWrapper({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/95 text-[#111111] backdrop-blur-xl [&_.nav-cta]:bg-[#111827] [&_.nav-cta]:text-white">
      {children}
    </header>
  )
}
