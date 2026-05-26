'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'

declare global {
  interface Window {
    Naver?: {
      Pay: {
        create: (config: {
          mode: 'development' | 'production'
          payType: 'recurrent'
          clientId: string
          chainId: string
        }) => {
          open: (options: {
            productCode: string
            productName: string
            totalPayAmount: number
            returnUrl: string
          }) => void
        }
      }
    }
  }
}

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
  paypalClientId: string
  paypalPlanIds: Record<string, string>
  naverpayClientId: string
  naverpayChainId: string
  naverpaySubscriptionStatus?: string | null
  naverpayRecurrentId?: string | null
}

function formatLimit(limit: number) {
  return `${limit}회`
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

function PricingGrid({
  currentPlan,
  plansList,
  hasSubscription,
  paypalPlanIds,
  naverpayClientId,
  naverpayChainId,
  naverpaySubscriptionStatus,
  naverpayRecurrentId,
}: PricingClientViewProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)

  // Load Naver Pay SDK Script dynamically
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const cancelSubscription = async () => {
    if (!confirm('구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 계속하시겠습니까?')) return
    setCanceling(true)
    try {
      const endpoint = naverpayRecurrentId ? '/api/payments/naverpay/cancel' : '/api/paypal/cancel'
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

  const handleNaverPay = (planKey: string) => {
    if (!window.Naver?.Pay) {
      setError('네이버페이 결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    const isSandbox = process.env.NEXT_PUBLIC_NAVERPAY_SANDBOX !== 'false'
    const mode = isSandbox ? 'development' : 'production'

    const oPay = window.Naver.Pay.create({
      payType: 'recurrent',
      mode,
      clientId: naverpayClientId,
      chainId: naverpayChainId,
    })

    const prices: Record<string, number> = {
      LITE: 3000,
      PRO: 19000,
      UNLIMITED: 45000,
    }

    const names: Record<string, string> = {
      LITE: 'Single (LITE)',
      PRO: 'Creator (PRO)',
      UNLIMITED: 'Studio (UNLIMITED)',
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const returnUrl = `${appUrl}/api/payments/naverpay/callback?plan=${planKey}`

    oPay.open({
      productCode: planKey,
      productName: `Shuffla ${names[planKey]} 정기구독`,
      totalPayAmount: prices[planKey],
      returnUrl,
    })
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
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleNaverPay(planKey)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#03C75A] hover:bg-[#02b14f] text-white py-2 text-sm font-black transition-all shadow-sm hover:shadow active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M16.2 3H7.8C5.2 3 3 5.2 3 7.8v8.4C3 18.8 5.2 21 7.8 21h8.4c2.6 0 4.8-2.2 4.8-4.8V7.8C21 5.2 18.8 3 16.2 3zm-2.4 12.3l-3.2-4.9v4.9H8.4V8.7h2.2l3.2 4.9V8.7h2.2v6.6h-2.2z" />
                      </svg>
                      네이버페이 정기결제
                    </button>
                    
                    {planId && (
                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-[#ece9e0]"></div>
                        <span className="flex-shrink mx-3 text-[10px] font-bold text-[#6f6a61] uppercase">또는 해외 카드</span>
                        <div className="flex-grow border-t border-[#ece9e0]"></div>
                      </div>
                    )}

                    {planId && (
                      <PayPalSubscribeButton
                        planId={planId}
                        onSuccess={() => router.refresh()}
                        onError={setError}
                      />
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
  onSuccess,
  onError,
}: {
  planId: string
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
          body: JSON.stringify({ subscriptionId: data.subscriptionID }),
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
    [onSuccess, onError],
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
