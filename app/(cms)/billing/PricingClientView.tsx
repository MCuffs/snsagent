'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Loader2, X } from 'lucide-react'
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'
import { analytics } from '../../../lib/analytics/thinkingdata'

const NICEPAY_SCRIPT_ID = 'nicepay-sdk-script'
const NICEPAY_SCRIPT_SRC = 'https://pay.nicepay.co.kr/v1/js/'

declare global {
  interface Window {
    gtag?: (command: string, action: string, params: Record<string, unknown>) => void
    AUTHNICE?: {
      requestPay: (options: {
        clientId: string
        method: string
        orderId: string
        amount: number
        goodsName: string
        returnUrl: string
        mallReserved?: string
        buyerName?: string
        buyerEmail?: string
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
  paymentProvider: 'paypal' | 'nicepay' | null
  userId: string
  paypalClientId: string
  paypalPlanIds: Record<string, string>
  nicepayClientKey: string
  nicepayReturnTokens: Record<string, string>
  customerName?: string | null
  customerEmail: string
  showRegenerationOffer: boolean
  paymentSuccess?: boolean
  locale?: string
}

export default function PricingClientView(props: PricingClientViewProps) {
  if (!props.paypalClientId) {
    // PayPal SDK won't load without clientId — hide PayPal buttons to avoid broken UI
    return <PricingGrid {...props} paypalPlanIds={{}} />
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
  paymentProvider,
  userId,
  paypalPlanIds,
  nicepayClientKey,
  nicepayReturnTokens,
  customerName,
  customerEmail,
  showRegenerationOffer,
  paymentSuccess,
  locale = 'ko',
}: PricingClientViewProps) {
  const router = useRouter()
  const t = useTranslations('billing')
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const [nicepayReady, setNicepayReady] = useState(false)

  // Locale-based payment method determination
  const showNicePay = locale === 'ko' && !!nicepayClientKey
  const showPayPal = locale !== 'ko' && Object.keys(paypalPlanIds).length > 0

  // Google Ads conversion tracking
  useEffect(() => {
    if (paymentSuccess && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: 'AW-18221005488/KcMGCKnB4rocELD1ufBD',
        transaction_id: userId,
      })
      console.log('[Google Ads] Conversion tracked for user:', userId)
    }
  }, [paymentSuccess, userId])

  useEffect(() => {
    analytics.billingPageView(currentPlan, {
      payment_provider: paymentProvider ?? undefined,
      has_subscription: hasSubscription,
      show_regeneration_offer: showRegenerationOffer,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showNicePay) {
      return
    }

    let active = true
    let script = document.getElementById(NICEPAY_SCRIPT_ID) as HTMLScriptElement | null

    const handleLoad = () => {
      if (!active) return
      const isReady = typeof window.AUTHNICE?.requestPay === 'function'
      setNicepayReady(isReady)
      if (!isReady) {
        setError(t('nicepay_load_error'))
      }
    }

    const handleError = () => {
      if (!active) return
      setNicepayReady(false)
      setError(t('nicepay_load_error'))
    }

    if (!script) {
      script = document.createElement('script')
      script.id = NICEPAY_SCRIPT_ID
      script.src = NICEPAY_SCRIPT_SRC
      script.async = true
      document.body.appendChild(script)
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)

    if (window.AUTHNICE?.requestPay) {
      window.setTimeout(handleLoad, 0)
    }

    return () => {
      active = false
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }
  }, [showNicePay, t])

  const cancelSubscription = async () => {
    if (!confirm(t('cancel_confirm'))) return
    setCanceling(true)
    analytics.subscriptionCancel(currentPlan, paymentProvider ?? 'unknown')
    try {
      const endpoint = paymentProvider === 'nicepay'
        ? '/api/payments/nicepay/cancel'
        : '/api/paypal/cancel'
      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error || t('cancel_error'))
      } else {
        analytics.subscriptionCancel(currentPlan, paymentProvider ?? 'unknown', {
          success: true,
        })
        router.refresh()
      }
    } catch {
      setError(t('network_error'))
    } finally {
      setCanceling(false)
    }
  }

  const handleNicepayPayment = (planKey: string) => {
    if (!nicepayClientKey) {
      setError(t('nicepay_key_missing'))
      return
    }
    const returnToken = nicepayReturnTokens[planKey]
    if (!returnToken) {
      setError(t('nicepay_start_failed'))
      return
    }
    if (!nicepayReady || !window.AUTHNICE?.requestPay) {
      setError(t('nicepay_loading'))
      return
    }
    
    setError('')
    setProcessingPayment(planKey)
    
    const PLAN_AMOUNTS: Record<string, number> = { LITE: 3000, PRO: 25000, UNLIMITED: 39000 }
    const amount = PLAN_AMOUNTS[planKey] ?? 0
    const orderId = `shuffla_regist_${Date.now()}_${planKey}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const returnUrl = new URL('/api/nicepay/return', appUrl)
    returnUrl.searchParams.set('token', returnToken)
    returnUrl.searchParams.set('locale', locale)
    
    analytics.planSelectClick(planKey, currentPlan, {
      payment_provider: 'nicepay',
      amount,
      currency: 'KRW',
    })
    analytics.paymentStart(planKey, 'nicepay', {
      amount,
      currency: 'KRW',
      order_id: orderId,
    })

    const timeoutId = window.setTimeout(() => {
      setError(t('nicepay_start_failed'))
      setProcessingPayment(null)
    }, 120000)

    try {
      window.AUTHNICE.requestPay({
        clientId: nicepayClientKey,
        method: 'card',
        orderId,
        amount,
        goodsName: `Shuffla ${planKey} 월 구독`,
        returnUrl: returnUrl.toString(),
        mallReserved: returnToken,
        buyerName: customerName || undefined,
        buyerEmail: customerEmail || undefined,
        fnError: (result) => {
          window.clearTimeout(timeoutId)
          analytics.paymentFailed(planKey, 'nicepay', result.errorMsg || 'sdk_error', {
            order_id: orderId,
          })
          setError(result.errorMsg || t('nicepay_start_failed'))
          setProcessingPayment(null)
        },
        fnClose: async (result) => {
          window.clearTimeout(timeoutId)
          if (!result.tid || !result.authToken || result.resultCode !== '0000') {
            if (result.resultCode && result.resultCode !== '0000') {
              setError(result.resultMsg || t('payment_canceled_msg'))
            }
            setProcessingPayment(null)
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
              analytics.paymentFailed(planKey, 'nicepay', data.error || 'api_error', {
                amount,
                currency: 'KRW',
                order_id: result.orderId ?? orderId,
              })
              setError(data.error || t('nicepay_approve_failed'))
              setProcessingPayment(null)
            } else if (data.offer === 'regeneration') {
              analytics.paymentSuccess(planKey, 'nicepay', {
                amount,
                currency: 'KRW',
                order_id: result.orderId ?? orderId,
                offer_type: 'regeneration',
              })
              router.push('/billing?success=true&offer=regeneration')
            } else {
              analytics.paymentSuccess(planKey, 'nicepay', {
                amount,
                currency: 'KRW',
                order_id: result.orderId ?? orderId,
              })
              router.push('/billing?success=true')
            }
          } catch (err) {
            console.error('Payment approval error:', err)
            setError(t('network_error'))
            setProcessingPayment(null)
          }
        },
      })
    } catch (err) {
      window.clearTimeout(timeoutId)
      console.error('NicePay requestPay error:', err)
      analytics.paymentFailed(planKey, 'nicepay', 'request_pay_exception', { order_id: orderId })
      setError(t('nicepay_start_failed'))
      setProcessingPayment(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 px-5 py-4 text-sm font-medium text-red-700 backdrop-blur-sm">
          {error}
        </div>
      )}

      {hasSubscription && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            <p className="text-sm font-semibold text-slate-700">{t('active_subscription')}</p>
          </div>
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
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4 shadow-sm">
          <p className="text-sm font-medium text-slate-600">{t('free_plan_notice')}</p>
        </div>
      )}

      {(showRegenerationOffer || currentPlan === 'LITE') && (
        <article className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-white p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">{t('one_time_eyebrow')}</p>
          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t('one_time_title')}</h2>
              <p className="mt-2 text-sm font-medium text-slate-600">{t('one_time_desc')}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{t('one_time_detail')}</p>
            </div>
            <div className="w-full shrink-0 md:w-64">
              {currentPlan === 'LITE' ? (
                <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-600">
                  {t('one_time_used')}
                </div>
              ) : showNicePay ? (
                <button
                  type="button"
                  onClick={() => handleNicepayPayment('LITE')}
                  disabled={processingPayment !== null}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="relative flex items-center justify-center gap-2">
                    {processingPayment === 'LITE' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('processing')}
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {t('one_time_cta_nicepay')}
                      </>
                    )}
                  </span>
                </button>
              ) : (
                <p className="text-center text-xs font-medium text-slate-500">{t('payment_setup')}</p>
              )}
            </div>
          </div>
        </article>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const paypalPlanId = paypalPlanIds[planKey]

          return (
            <article
              key={planKey}
              className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
                isCurrentPlan
                  ? 'border-slate-900 shadow-xl ring-2 ring-slate-900/10'
                  : 'border-slate-200 hover:border-slate-400 hover:shadow-lg'
              }`}
            >
              <div className="p-8">
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{plan.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                    </div>
                    {isCurrentPlan && (
                      <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        {t('current_plan')}
                      </span>
                    )}
                  </div>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-slate-900">{plan.price}</span>
                    <span className="text-sm text-slate-500">{t('per_month')}</span>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 py-6">
                  {(locale === 'en' ? plan.features_en : plan.features).map((feature, idx) => (
                    <Feature key={idx}>{feature}</Feature>
                  ))}
                </div>

                <div className="mt-6">
                {isCurrentPlan ? (
                  <button type="button" disabled className="btn-secondary w-full opacity-60">
                    {t('in_use')}
                  </button>
                ) : hasSubscription ? (
                  <button type="button" disabled className="btn-secondary w-full opacity-60">
                    {t('cancel_after_sub')}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {showNicePay && (
                      <button
                        type="button"
                        onClick={() => handleNicepayPayment(planKey)}
                        disabled={processingPayment !== null}
                        className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-3.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative flex items-center justify-center gap-2">
                          {processingPayment === planKey ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('processing')}
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              {t('domestic_nicepay')}
                            </>
                          )}
                        </span>
                      </button>
                    )}
                    {showPayPal && paypalPlanId && (
                      <PayPalSubscribeButton
                        planKey={planKey}
                        planId={paypalPlanId}
                        userId={userId}
                        currentPlan={currentPlan}
                        onSuccess={() => router.refresh()}
                        onError={setError}
                      />
                    )}
                    {showPayPal && !paypalPlanId && (
                      <p className="text-center text-xs font-medium text-slate-500">{t('payment_setup')}</p>
                    )}
                    {!showNicePay && !showPayPal && (
                      <p className="text-center text-xs font-medium text-slate-500">{t('payment_setup')}</p>
                    )}
                  </div>
                )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function PayPalSubscribeButton({
  planKey,
  planId,
  userId,
  currentPlan,
  onSuccess,
  onError,
}: {
  planKey: string
  planId: string
  userId: string
  currentPlan: string
  onSuccess: () => void
  onError: (message: string) => void
}) {
  const [{ isPending }] = usePayPalScriptReducer()
  const t = useTranslations('billing')

  const createSubscription = useCallback(
    (_data: Record<string, unknown>, actions: { subscription: { create: (options: object) => Promise<string> } }) => {
      analytics.planSelectClick(planKey, currentPlan, { payment_provider: 'paypal' })
      analytics.paymentStart(planKey, 'paypal', { subscription_id: planId })
      return actions.subscription.create({ plan_id: planId, custom_id: userId })
    },
    [currentPlan, planId, planKey, userId],
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
        analytics.paymentFailed(planKey, 'paypal', body.error || 'activate_failed', {
          subscription_id: data.subscriptionID,
        })
        onError(body.error || t('paypal_activate_failed'))
        return
      }
      analytics.paymentSuccess(planKey, 'paypal', {
        subscription_id: data.subscriptionID,
      })
      onSuccess()
    } catch {
      analytics.paymentFailed(planKey, 'paypal', 'network_error', {
        subscription_id: data.subscriptionID,
      })
      onError(t('network_error'))
    }
  }, [onError, onSuccess, planKey, t])

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
        onError={() => {
          analytics.paymentFailed(planKey, 'paypal', 'paypal_sdk_error', { subscription_id: planId })
          onError(t('paypal_error'))
        }}
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
