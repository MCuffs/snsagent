'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, X } from 'lucide-react'
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'
import { analytics } from '../../../lib/analytics/thinkingdata'

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
    AUTHNICE?: {
      requestPay: (options: {
        clientId: string
        method: string
        orderId: string
        amount: number
        goodsName: string
        returnUrl: string
        fnError?: (result: { errorMsg?: string }) => void
        fnClose?: (result: {
          tid?: string
          authToken?: string
          orderId?: string
          resultCode?: string
          resultMsg?: string
        }) => void
      }) => void
    }
  }
}

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
  paymentProvider: 'toss' | 'paypal' | 'nicepay' | null
  userId: string
  tossClientKey: string
  tossCustomerKey: string
  paypalClientId: string
  paypalPlanIds: Record<string, string>
  nicepayClientKey: string
  customerName?: string | null
  customerEmail: string
  showRegenerationOffer: boolean
}

function formatLimit(limit: number) {
  return `${limit}`
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
  nicepayClientKey,
  customerName,
  customerEmail,
  showRegenerationOffer,
}: PricingClientViewProps) {
  const router = useRouter()
  const t = useTranslations('billing')
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)

  useEffect(() => {
    analytics.billingPageView(currentPlan)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!tossClientKey || window.TossPayments) return

    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v2/standard'
    script.async = true
    script.onerror = () => setError(t('toss_load_error'))
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [tossClientKey, t])

  useEffect(() => {
    if (!nicepayClientKey || window.AUTHNICE) return

    const script = document.createElement('script')
    script.src = 'https://pay.nicepay.co.kr/v1/js/'
    script.async = true
    script.onerror = () => setError(t('nicepay_load_error'))
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
  }, [nicepayClientKey, t])

  const cancelSubscription = async () => {
    if (!confirm(t('cancel_confirm'))) return
    setCanceling(true)
    analytics.subscriptionCancel(currentPlan, paymentProvider ?? 'unknown')
    try {
      const endpoint = paymentProvider === 'toss'
        ? '/api/payments/toss/cancel'
        : paymentProvider === 'nicepay'
          ? '/api/payments/nicepay/cancel'
          : '/api/paypal/cancel'
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error || t('cancel_error'))
      } else {
        router.refresh()
      }
    } catch {
      setError(t('network_error'))
    } finally {
      setCanceling(false)
    }
  }

  const handleTossPayment = async (planKey: string) => {
    if (!tossClientKey) {
      setError(t('toss_key_missing'))
      return
    }
    if (!window.TossPayments) {
      setError(t('toss_loading'))
      return
    }
    analytics.planSelectClick(planKey, currentPlan)
    analytics.paymentStart(planKey, 'toss')

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
      setError(t('card_register_failed'))
    }
  }

  const handleNicepayPayment = (planKey: string) => {
    if (!nicepayClientKey) {
      setError(t('nicepay_key_missing'))
      return
    }
    if (!window.AUTHNICE) {
      setError(t('nicepay_loading'))
      return
    }
    analytics.planSelectClick(planKey, currentPlan)
    analytics.paymentStart(planKey, 'nicepay')

    const PLAN_AMOUNTS: Record<string, number> = { LITE: 3000, PRO: 25000, UNLIMITED: 39000 }
    const amount = PLAN_AMOUNTS[planKey] ?? 0
    const orderId = `shuffla_regist_${Date.now()}_${planKey}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin

    window.AUTHNICE.requestPay({
      clientId: nicepayClientKey,
      method: 'card',
      orderId,
      amount,
      goodsName: `Shuffla ${planKey} 월 구독`,
      returnUrl: `${appUrl}/api/nicepay/server-auth-dummy`,
      fnError: (result) => {
        setError(result.errorMsg || t('nicepay_start_failed'))
      },
      fnClose: async (result) => {
        if (!result.tid || !result.authToken || result.resultCode !== '0000') {
          if (result.resultCode && result.resultCode !== '0000') {
            setError(result.resultMsg || t('payment_canceled'))
          }
          return
        }
        try {
          const res = await fetch('/api/nicepay/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tid: result.tid,
              authToken: result.authToken,
              orderId: result.orderId ?? orderId,
              plan: planKey,
            }),
          })
          const data = await res.json() as { error?: string; offer?: string }
          if (!res.ok) {
            analytics.paymentFailed(planKey, 'nicepay', data.error || 'api_error')
            setError(data.error || t('nicepay_approve_failed'))
          } else if (data.offer === 'regeneration') {
            analytics.paymentSuccess(planKey, 'nicepay')
            router.push('/billing?success=true&offer=regeneration')
          } else {
            analytics.paymentSuccess(planKey, 'nicepay')
            router.push('/billing?success=true')
          }
        } catch {
          setError(t('network_error'))
        }
      },
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
          <p className="text-sm font-bold text-[#5d584f]">{t('active_subscription')}</p>
          <button
            type="button"
            disabled={canceling}
            onClick={cancelSubscription}
            className="btn-secondary flex-shrink-0 ml-4"
          >
            {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            {t('cancel_btn')}
          </button>
        </div>
      )}

      {currentPlan === 'FREE' && (
        <div className="rounded-lg border border-[#ece9e0] bg-white px-5 py-4 text-sm font-bold text-[#5d584f]">
          {t('free_plan_notice')}
        </div>
      )}

      {(showRegenerationOffer || currentPlan === 'LITE') && (
        <article className="rounded-xl border border-[#f0cdb7] bg-[#fff8f2] p-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#b94718]">{t('one_time_eyebrow')}</p>
          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#171411]">{t('one_time_title')}</h2>
              <p className="mt-2 text-sm font-bold text-[#5d584f]">{t('one_time_desc')}</p>
              <p className="mt-2 text-xs leading-5 text-[#746a62]">{t('one_time_detail')}</p>
            </div>
            <div className="w-full shrink-0 md:w-64">
              {currentPlan === 'LITE' ? (
                <div className="rounded-lg bg-[#f1f0eb] px-4 py-3 text-center text-sm font-bold text-[#5d584f]">
                  {t('one_time_used')}
                </div>
              ) : tossClientKey ? (
                <button
                  type="button"
                  onClick={() => void handleTossPayment('LITE')}
                  className="w-full rounded-lg bg-[#111318] py-3 text-sm font-black text-white transition hover:bg-[#292c32]"
                >
                  {t('one_time_cta_toss')}
                </button>
              ) : nicepayClientKey ? (
                <button
                  type="button"
                  onClick={() => handleNicepayPayment('LITE')}
                  className="w-full rounded-lg bg-[#111318] py-3 text-sm font-black text-white transition hover:bg-[#292c32]"
                >
                  {t('one_time_cta_nicepay')}
                </button>
              ) : (
                <p className="text-center text-xs font-bold text-[#6f6a61]">{t('payment_setup')}</p>
              )}
            </div>
          </div>
        </article>
      )}

      <div className="grid gap-4 md:grid-cols-2">
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
                      {t('current_plan')}
                    </span>
                  )}
                </div>
                <p className="mt-2 min-h-10 text-sm leading-5 text-[#6f6a61]">{plan.description}</p>
                <p className="mt-5 text-2xl font-black tracking-tight text-neutral-950">{plan.price}</p>
              </div>

              <div className="space-y-3 border-y border-[#ece9e0] py-5 text-sm">
                <Feature>{t('feature_generation_count', { limit: formatLimit(plan.monthlyCardLimit) })}</Feature>
                <Feature>{t('feature_history_days', { days: plan.historyRetentionDays })}</Feature>
                <Feature>{t('feature_regen_campaign')}</Feature>
                <Feature>{t('feature_edit_ref')}</Feature>
              </div>

              <div className="mt-6">
                {isCurrentPlan ? (
                  <button
                    type="button"
                    disabled
                    className="btn-secondary w-full opacity-60"
                  >
                    {t('in_use')}
                  </button>
                ) : hasSubscription ? (
                  <button type="button" disabled className="btn-secondary w-full opacity-60">
                    {t('cancel_after_sub')}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {tossClientKey && (
                      <button
                        type="button"
                        onClick={() => void handleTossPayment(planKey)}
                        className="w-full rounded-lg bg-[#0064ff] py-2.5 text-sm font-black text-white transition-all hover:bg-[#0054d6] active:scale-[0.98]"
                      >
                        {t('domestic_toss')}
                      </button>
                    )}
                    {nicepayClientKey && !tossClientKey && (
                      <button
                        type="button"
                        onClick={() => handleNicepayPayment(planKey)}
                        className="w-full rounded-lg bg-[#e8173e] py-2.5 text-sm font-black text-white transition-all hover:bg-[#c90f32] active:scale-[0.98]"
                      >
                        {t('domestic_nicepay')}
                      </button>
                    )}
                    {nicepayClientKey && tossClientKey && (
                      <button
                        type="button"
                        onClick={() => handleNicepayPayment(planKey)}
                        className="w-full rounded-lg border border-[#e8173e] py-2.5 text-sm font-black text-[#e8173e] transition-all hover:bg-[#fff0f3] active:scale-[0.98]"
                      >
                        {t('nicepay_alt')}
                      </button>
                    )}
                    {(tossClientKey || nicepayClientKey) && paypalPlanId && (
                      <div className="flex items-center gap-3 py-1 text-[11px] font-bold text-[#6f6a61]">
                        <span className="h-px flex-1 bg-[#ece9e0]" />
                        {t('foreign_divider')}
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
                    {!tossClientKey && !nicepayClientKey && !paypalPlanId && (
                      <p className="text-center text-xs font-bold text-[#6f6a61]">{t('payment_setup')}</p>
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
  const t = useTranslations('billing')

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
        onError(body.error || t('paypal_activate_failed'))
        return
      }
      onSuccess()
    } catch {
      onError(t('network_error'))
    }
  }, [onError, onSuccess, t])

  if (isPending) {
    return (
      <div className="flex h-10 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[#0064ff]" />
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-center text-xs font-bold text-[#6f6a61]">{t('paypal_label')}</p>
      <PayPalButtons
        style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 40, label: 'subscribe' }}
        createSubscription={createSubscription as Parameters<typeof PayPalButtons>[0]['createSubscription']}
        onApprove={onApprove as Parameters<typeof PayPalButtons>[0]['onApprove']}
        onError={() => onError(t('paypal_error'))}
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
