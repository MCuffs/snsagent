'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
  paypalClientId: string
  paypalPlanIds: Record<string, string>
}

function formatLimit(limit: number) {
  return limit >= 9999 ? '무제한' : `${limit}개`
}

export default function PricingClientView(props: PricingClientViewProps) {
  if (!props.paypalClientId) {
    return <PricingGrid {...props} />
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId: props.paypalClientId,
        vault: true,
        intent: 'subscription',
        components: 'buttons',
      }}
    >
      <PricingGrid {...props} />
    </PayPalScriptProvider>
  )
}

function PricingGrid({ currentPlan, plansList, hasSubscription, paypalPlanIds }: PricingClientViewProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)

  const cancelSubscription = async () => {
    if (!confirm('구독을 취소하면 현재 결제 기간이 끝난 뒤 FREE 플랜으로 전환됩니다. 계속하시겠습니까?')) return
    setCanceling(true)
    try {
      const res = await fetch('/api/paypal/cancel', { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error || '구독 취소에 실패했습니다.')
      } else {
        router.refresh()
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setCanceling(false)
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
          <p className="text-sm font-bold text-[#5d584f]">구독 중입니다. 취소하면 현재 기간 만료 후 FREE로 전환됩니다.</p>
          <button
            type="button"
            disabled={canceling}
            onClick={cancelSubscription}
            className="btn-secondary flex-shrink-0 ml-4"
          >
            {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            구독 취소
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const isFree = planKey === 'FREE'
          const planId = paypalPlanIds[planKey]

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

              <div className="mt-6">
                {isFree || isCurrentPlan ? (
                  <button
                    type="button"
                    disabled
                    className="btn-secondary w-full opacity-60"
                  >
                    {isCurrentPlan ? '사용 중' : '기본 플랜'}
                  </button>
                ) : planId ? (
                  <PayPalSubscribeButton
                    planId={planId}
                    planKey={planKey}
                    onSuccess={() => router.refresh()}
                    onError={setError}
                  />
                ) : (
                  <button type="button" disabled className="btn-primary w-full opacity-40">
                    준비 중
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function PayPalSubscribeButton({
  planId,
  planKey,
  onSuccess,
  onError,
}: {
  planId: string
  planKey: string
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [{ isPending }] = usePayPalScriptReducer()

  const createSubscription = useCallback(
    (_data: Record<string, unknown>, actions: { subscription: { create: (o: object) => Promise<string> } }) =>
      actions.subscription.create({ plan_id: planId }),
    [planId],
  )

  const onApprove = useCallback(
    async (data: { subscriptionID?: string | null }) => {
      try {
        const res = await fetch('/api/paypal/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId: data.subscriptionID, plan: planKey }),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) {
          onError(json.error || '구독 활성화에 실패했습니다.')
        } else {
          onSuccess()
        }
      } catch {
        onError('네트워크 오류가 발생했습니다.')
      }
    },
    [planKey, onSuccess, onError],
  )

  if (isPending) {
    return (
      <div className="flex h-10 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[#b94718]" />
      </div>
    )
  }

  return (
    <PayPalButtons
      style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 40, label: 'subscribe' }}
      createSubscription={createSubscription as Parameters<typeof PayPalButtons>[0]['createSubscription']}
      onApprove={onApprove as Parameters<typeof PayPalButtons>[0]['onApprove']}
      onError={() => onError('PayPal 결제 중 오류가 발생했습니다.')}
    />
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
