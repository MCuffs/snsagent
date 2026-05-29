'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const messages = {
  ko: { title: '페이지를 찾을 수 없습니다', desc: '주소가 잘못됐거나 삭제된 페이지입니다.', back: '홈으로 돌아가기' },
  en: { title: 'Page not found', desc: 'The address is invalid or the page has been deleted.', back: 'Back to home' },
}

export default function NotFound() {
  const lang = typeof navigator !== 'undefined' && navigator.language.startsWith('ko') ? 'ko' : 'en'
  const t = messages[lang]

  return (
    <main className="app-shell flex min-h-screen items-center justify-center text-[#1f1512]">
      <div className="text-center px-6">
        <p className="text-7xl font-black tracking-tighter text-[#ff4f0a]">404</p>
        <h1 className="mt-4 text-2xl font-black tracking-tight">{t.title}</h1>
        <p className="mt-3 text-sm text-[#746a62]">{t.desc}</p>
        <Link
          href="/concept"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1f1512] px-5 py-2.5 text-sm font-black text-white hover:bg-[#352521] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Link>
      </div>
    </main>
  )
}
