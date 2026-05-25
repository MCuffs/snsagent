'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ExternalLink } from 'lucide-react'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
}

function formatLimit(limit: number) {
  return limit >= 9999 ? '무제한' : `${limit}개`
}

export default function PricingClientView({ currentPlan, plansList, hasSubscription }: PricingClientViewProps) {
  const router = useRouter()
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [error, setError] = useState('')

  const startCheckout = async (plan: SubscriptionPlan) => {
    if (plan === 'FREE') return
    setProcessingPlan(plan)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error || '결제 페이지를 열 수 없습니다.')
        setProcessingPlan(null)
        return
      }

      window.location.href = data.url
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setProcessingPlan(null)
    }
  }

  const openPortal = async () => {
    setOpeningPortal(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error || '구독 관리 페이지를 열 수 없습니다.')
        setOpeningPortal(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setOpeningPortal(false)
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      {hasSubscription && (
        <div className="flex items-center justify-between rounded-lg border border-[#ece9e0] bg-[#faf8f4] px-5 py-4">
          <p className="text-sm font-bold text-[#5d584f]">구독 중인 플랜을 변경하거나 취소하려면 구독 관리 포털을 이용하세요.</p>
          <button
            type="button"
            disabled={openingPortal}
            onClick={openPortal}
            className="btn-secondary flex-shrink-0 ml-4"
          >
            {openingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            구독 관리
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const isProcessing = processingPlan === planKey
          const isFree = planKey === 'FREE'

          return (
            <article
              key={planKey}
              className={`panel rounded-lg p-6 ${isCurrentPlan ? 'outline outline-2 outline-[#b94718]/20' : ''}`}
            >
              <div className="mb-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black tracking-tight text-neutral-950">{plan.name}</h2>
                  {isCurrentPlan && (
                    <span className="rounded-full bg-[#f1f0eb] px-2 py-1 text-[10px] font-bold text-[#6f6a61]">
                      현재 플랜
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-10 text-sm leading-5 text-[#6f6a61]">{plan.description}</p>
                <p className="mt-5 text-2xl font-black tracking-tight text-neutral-950">{plan.price}</p>
              </div>

              <div className="space-y-3 border-y border-[#ece9e0] py-5 text-sm">
                <Feature>월 캠페인 {formatLimit(plan.monthlyCampaignLimit)}</Feature>
                <Feature>브랜드 {formatLimit(plan.brandLimit)}</Feature>
                <Feature>{plan.canSchedule ? '예약 발행 가능' : '수동 발행'}</Feature>
                <Feature>{plan.hasWatermark ? '워터마크 포함' : '워터마크 없음'}</Feature>
              </div>

              <button
                type="button"
                disabled={isCurrentPlan || Boolean(processingPlan) || openingPortal || isFree}
                onClick={() => startCheckout(planKey)}
                className={isCurrentPlan || isFree ? 'btn-secondary mt-6 w-full opacity-60' : 'btn-primary mt-6 w-full'}
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCurrentPlan ? '사용 중' : isFree ? '기본 플랜' : '업그레이드'}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[#5d584f]">
      <Check className="h-4 w-4 text-[#b94718]" />
      <span>{children}</span>
    </div>
  )
}
