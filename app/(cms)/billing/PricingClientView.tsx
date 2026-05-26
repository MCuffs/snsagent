'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      payment: (options: { customerKey: string }) => {
        requestBillingAuth: (options: {
          method: 'CARD'
          successUrl: string
          failUrl: string
          customerName?: string
          customerEmail?: string
        }) => Promise<void>
      }
    }
  }
}

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
  paymentProvider: 'toss' | 'paypal' | null
  userId: string
  tossClientKey: string
  tossCustomerKey: string
  paypalClientId: string
  paypalPlanIds: Record<string, string>
  customerName?: string | null
  customerEmail: string
}

function formatLimit(limit: number) {
  return `${limit}회`
}

export default function PricingClientView(props: PricingClientViewProps) {
  if (!props.paypalClientId) return <PricingGrid {...props} />

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

function PricingGrid({
  currentPlan,
  plansList,
  hasSubscription,
  paymentProvider,
  userId,
  tossClientKey,
  tossCustomerKey,
  paypalPlanIds,
  customerName,
  customerEmail,
}: PricingClientViewProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    if (!tossClientKey || window.TossPayments) return

    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v2/standard'
    script.async = true
    script.onerror = () => setError('토스페이먼츠 결제 모듈을 불러오지 못했습니다.')
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [tossClientKey])

  const cancelSubscription = async () => {
    if (!confirm('구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 계속하시겠습니까?')) return
    setCanceling(true)
    try {
      const endpoint = paymentProvider === 'toss' ? '/api/payments/toss/cancel' : '/api/paypal/cancel'
      const res = await fetch(endpoint, { method: 'POST' })
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

  const handleTossPayment = async (planKey: string) => {
    if (!tossClientKey) {
      setError('토스페이먼츠 클라이언트 키가 설정되지 않았습니다.')
      return
    }
    if (!window.TossPayments) {
      setError('토스페이먼츠 결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const payment = window.TossPayments(tossClientKey).payment({ customerKey: tossCustomerKey })
    try {
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${appUrl}/api/payments/toss/billing/callback?plan=${encodeURIComponent(planKey)}`,
        failUrl: `${appUrl}/billing?canceled=true`,
        customerName: customerName || undefined,
        customerEmail,
      })
    } catch {
      setError('카드 등록을 시작하지 못했습니다. 다시 시도해주세요.')
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
          <p className="text-sm font-bold text-[#5d584f]">구독 중입니다. 취소하면 즉시 이용권 없는 상태로 전환됩니다.</p>
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

      {currentPlan === 'FREE' && (
        <div className="rounded-lg border border-[#ece9e0] bg-white px-5 py-4 text-sm font-bold text-[#5d584f]">
          현재 이용권이 없습니다. 카드뉴스를 생성하려면 아래 플랜을 선택하세요.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const paypalPlanId = paypalPlanIds[planKey]

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
                <Feature>월 카드뉴스 {formatLimit(plan.monthlyCardLimit)} 생성</Feature>
                <Feature>캠페인별 AI 배경 재생성 1회분</Feature>
                <Feature>참고 이미지 입력 및 결과 편집</Feature>
              </div>

              <div className="mt-6">
                {isCurrentPlan ? (
                  <button
                    type="button"
                    disabled
                    className="btn-secondary w-full opacity-60"
                  >
                    사용 중
                  </button>
                ) : hasSubscription ? (
                  <button type="button" disabled className="btn-secondary w-full opacity-60">
                    현재 구독 취소 후 선택
                  </button>
                ) : (
                  <div className="space-y-3">
                    {tossClientKey && (
                      <button
                        type="button"
                        onClick={() => void handleTossPayment(planKey)}
                        className="w-full rounded-lg bg-[#0064ff] py-2.5 text-sm font-black text-white transition-all hover:bg-[#0054d6] active:scale-[0.98]"
                      >
                        국내 카드 결제 (토스페이먼츠)
                      </button>
                    )}
                    {tossClientKey && paypalPlanId && (
                      <div className="flex items-center gap-3 py-1 text-[11px] font-bold text-[#6f6a61]">
                        <span className="h-px flex-1 bg-[#ece9e0]" />
                        해외 고객
                        <span className="h-px flex-1 bg-[#ece9e0]" />
                      </div>
                    )}
                    {paypalPlanId && (
                      <PayPalSubscribeButton
                        planId={paypalPlanId}
                        userId={userId}
                        onSuccess={() => router.refresh()}
                        onError={setError}
                      />
                    )}
                    {!tossClientKey && !paypalPlanId && (
                      <p className="text-center text-xs font-bold text-[#6f6a61]">결제 설정 준비 중</p>
                    )}
                  </div>
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
  userId,
  onSuccess,
  onError,
}: {
  planId: string
  userId: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const [{ isPending }] = usePayPalScriptReducer()

  const createSubscription = useCallback(
    (_data: Record<string, unknown>, actions: { subscription: { create: (options: object) => Promise<string> } }) =>
      actions.subscription.create({ plan_id: planId, custom_id: userId }),
    [planId, userId],
  )

  const onApprove = useCallback(async (data: { subscriptionID?: string | null }) => {
    try {
      const response = await fetch('/api/paypal/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: data.subscriptionID }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) {
        onError(body.error || 'PayPal 구독 활성화에 실패했습니다.')
        return
      }
      onSuccess()
    } catch {
      onError('네트워크 오류가 발생했습니다.')
    }
  }, [onError, onSuccess])

  if (isPending) {
    return (
      <div className="flex h-10 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[#0064ff]" />
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-center text-xs font-bold text-[#6f6a61]">PayPal 해외 결제</p>
      <PayPalButtons
        style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 40, label: 'subscribe' }}
        createSubscription={createSubscription as Parameters<typeof PayPalButtons>[0]['createSubscription']}
        onApprove={onApprove as Parameters<typeof PayPalButtons>[0]['onApprove']}
        onError={() => onError('PayPal 결제 중 오류가 발생했습니다.')}
      />
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
