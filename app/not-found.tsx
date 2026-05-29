'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function NotFound() {
  const t = useTranslations('not_found')

  return (
    <main className="app-shell flex min-h-screen items-center justify-center text-[#1f1512]">
      <div className="text-center px-6">
        <p className="text-7xl font-black tracking-tighter text-[#ff4f0a]">404</p>
        <h1 className="mt-4 text-2xl font-black tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-sm text-[#746a62]">{t('desc')}</p>
        <Link
          href="/concept"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1f1512] px-5 py-2.5 text-sm font-black text-white hover:bg-[#352521] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back_home')}
        </Link>
      </div>
    </main>
  )
}
