'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center text-[#1f1512]">
      <div className="rounded-full bg-red-50 p-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="mt-4 text-xl font-black tracking-tight">오류가 발생했습니다</h2>
      <p className="mt-2 max-w-sm text-sm text-[#746a62]">
        일시적인 오류입니다. 다시 시도하거나 홈으로 이동해 주세요.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full border border-[#e8dfd4] bg-white px-4 py-2 text-sm font-black text-[#1f1512] hover:bg-[#f5efe6] transition"
        >
          <RefreshCw className="h-4 w-4" />
          다시 시도
        </button>
        <Link
          href="/concept"
          className="inline-flex items-center gap-2 rounded-full bg-[#1f1512] px-4 py-2 text-sm font-black text-white hover:bg-[#352521] transition"
        >
          홈으로
        </Link>
      </div>
    </div>
  )
}
