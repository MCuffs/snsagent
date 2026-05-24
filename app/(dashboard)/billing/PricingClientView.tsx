'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { changeUserPlanAction } from '../../actions'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
}

function formatLimit(limit: number) {
  return limit >= 9999 ? '무제한' : `${limit}개`
}

export default function PricingClientView({ currentPlan, plansList }: PricingClientViewProps) {
  const router = useRouter()
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null)
  const [error, setError] = useState('')

  const changePlan = async (plan: SubscriptionPlan) => {
    setProcessingPlan(plan)
    setError('')
    const result = await changeUserPlanAction(plan)

    if (!result.success) {
      setError(result.error || '플랜 변경에 실패했습니다.')
      setProcessingPlan(null)
      return
    }

    router.refresh()
    setProcessingPlan(null)
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const isProcessing = processingPlan === planKey

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
                disabled={isCurrentPlan || Boolean(processingPlan)}
                onClick={() => changePlan(planKey)}
                className={isCurrentPlan ? 'btn-secondary mt-6 w-full opacity-60' : 'btn-primary mt-6 w-full'}
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCurrentPlan ? '사용 중' : '플랜 적용'}
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
