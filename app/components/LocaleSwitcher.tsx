'use client'

import { Globe } from 'lucide-react'
import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export default function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const toggle = () => {
    const next = locale === 'ko' ? 'en' : 'ko'
    const newPath = pathname.replace(new RegExp(`^/${locale}`), `/${next}`)
    router.push(newPath || `/${next}`)
  }

  return (
    <button
      onClick={toggle}
      title={locale === 'ko' ? 'Switch to English' : '한국어로 변경'}
      className={`flex items-center gap-1 rounded-full border border-[#e4e4e7] px-2 py-1 text-[10px] font-medium text-[#71717a] transition hover:bg-[#f0f0f0] ${className ?? ''}`}
    >
      <Globe className="h-3 w-3" />
      {locale === 'ko' ? 'EN' : '한'}
    </button>
  )
}
