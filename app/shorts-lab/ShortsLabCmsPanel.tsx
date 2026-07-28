'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import ShortsLab from './ShortsLab'
import type { TrendingResult } from './trending'
import type { ShortsLabAccess } from './types'
import './shorts-lab.css'

const LOCKED_FALLBACK: ShortsLabAccess = {
  mode: 'locked',
  monthUsed: 0,
  dayUsed: 0,
  monthLimit: 60,
  dayLimit: 10,
  unlimited: false,
}

export default function ShortsLabCmsPanel({
  isActive,
  userId,
  access,
}: {
  isActive: boolean
  userId: string
  access?: ShortsLabAccess | null
}) {
  const [initial, setInitial] = useState<TrendingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActive || initial || error) return

    const controller = new AbortController()

    void fetch('/api/shorts-lab/trending', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`인기 영상 목록을 불러오지 못했습니다. (${response.status})`)
        }
        return response.json() as Promise<TrendingResult>
      })
      .then(setInitial)
      .catch(fetchError => {
        if ((fetchError as Error)?.name !== 'AbortError') {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : '인기 영상 목록을 불러오지 못했습니다.',
          )
        }
      })

    return () => controller.abort()
  }, [error, initial, isActive])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-red-100 bg-white/80 p-5 text-center shadow-sm backdrop-blur-xl">
          <AlertCircle className="mx-auto h-6 w-6 text-red-500" />
          <h2 className="mt-3 text-sm font-bold text-[#111827]">Shorts Lab을 열 수 없습니다</h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-4 rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm font-semibold text-[#64748b]">
        <Loader2 className="h-4 w-4 animate-spin text-[#4252ff]" />
        인기 영상과 재사용 가능 소스를 찾는 중…
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <ShortsLab
        initial={initial}
        userId={userId}
        embedded
        access={access ?? LOCKED_FALLBACK}
      />
    </div>
  )
}
