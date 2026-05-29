'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

const messages = {
  ko: { title: '서비스 오류가 발생했습니다', desc: '잠시 후 다시 시도해 주세요.', retry: '다시 시도' },
  en: { title: 'Something went wrong', desc: 'Please try again in a moment.', retry: 'Try again' },
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const lang = typeof navigator !== 'undefined' && navigator.language.startsWith('ko') ? 'ko' : 'en'
  const t = messages[lang]

  return (
    <html lang={lang}>
      <body className="min-h-screen flex items-center justify-center bg-[#fffdf8]">
        <div className="text-center px-6 text-[#1f1512]">
          <div className="mx-auto w-fit rounded-full bg-red-50 p-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="mt-4 text-xl font-black tracking-tight">{t.title}</h2>
          <p className="mt-2 text-sm text-[#746a62]">{t.desc}</p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1f1512] px-5 py-2.5 text-sm font-black text-white hover:bg-[#352521] transition"
          >
            <RefreshCw className="h-4 w-4" />
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  )
}
