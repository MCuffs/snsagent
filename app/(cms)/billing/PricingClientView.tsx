'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, CreditCard, Loader2, X } from 'lucide-react'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'
import { analytics } from '../../../lib/analytics/thinkingdata'

declare global {
  interface Window {
    gtag?: (command: string, action: string, params: Record<string, unknown>) => void
  }
}

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
  hasSubscription: boolean
  paymentProvider: 'polar' | null
  userId: string
  locale?: string
  showRegenerationOffer: boolean
  paymentSuccess?: boolean
}

export default function PricingClientView(props: PricingClientViewProps) {
  return <PricingGrid {...props} />
}

function PricingGrid({
  currentPlan,
  plansList,
  hasSubscription,
  paymentProvider,
  userId,
  locale = 'ko',
  showRegenerationOffer,
  paymentSuccess,
}: PricingClientViewProps) {
  const router = useRouter()
  const t = useTranslations('billing')
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const isEn = locale === 'en'

  useEffect(() => {
    if (paymentSuccess && typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: 'AW-18221005488/KcMGCKnB4rocELD1ufBD',
        transaction_id: userId,
      })
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

  const cancelSubscription = async () => {
    if (!confirm(t('cancel_confirm'))) return
    setCanceling(true)
    analytics.subscriptionCancel(currentPlan, paymentProvider ?? 'unknown')
    try {
      const res = await fetch('/api/polar/cancel', { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setError(data.error || t('cancel_error'))
      } else {
        analytics.subscriptionCancel(currentPlan, paymentProvider ?? 'unknown', { success: true })
        router.refresh()
      }
    } catch {
      setError(t('network_error'))
    } finally {
      setCanceling(false)
    }
  }

  const handlePolarCheckout = async (planKey: string) => {
    setError('')
    setProcessingPayment(planKey)
    analytics.planSelectClick(planKey, currentPlan, { payment_provider: 'polar' })
    try {
      const res = await fetch('/api/polar/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const body = await res.json() as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        setError(body.error || (isEn ? 'Checkout failed. Please try again.' : '결제창을 열 수 없습니다. 다시 시도해 주세요.'))
        setProcessingPayment(null)
        return
      }
      window.location.href = body.url
    } catch {
      setError(isEn ? 'Network error. Please try again.' : '네트워크 오류가 발생했습니다.')
      setProcessingPayment(null)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {hasSubscription && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey
          const planDescription = isEn ? plan.description_en : plan.description
          const planPrice = isEn ? plan.price_en : plan.price
          const planFeatures = isEn ? plan.features_en : plan.features

          return (
            <article
              key={planKey}
              className={`group relative overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                isCurrentPlan
                  ? 'border-[#111827] shadow-md ring-1 ring-[#111827]/10'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db] hover:shadow-sm'
              }`}
            >
              <div className="p-8">
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{plan.name}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{planDescription}</p>
                    </div>
                    {isCurrentPlan && (
                      <span className="shrink-0 rounded-md bg-[#111827] px-2.5 py-1 text-xs font-semibold text-white">
                        {t('current_plan')}
                      </span>
                    )}
                  </div>
                  <div className="mt-6">
                    <span className="text-4xl font-bold tracking-tight text-slate-900">{planPrice}</span>
                    <p className="mt-1 text-xs text-slate-500">
                      {isEn ? 'VAT included' : '부가세 포함'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-slate-100 py-6">
                  {planFeatures.map((feature, idx) => (
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
                    <PolarButton
                      planKey={planKey}
                      locale={locale}
                      processing={processingPayment === planKey}
                      disabled={processingPayment !== null}
                      onClick={() => handlePolarCheckout(planKey)}
                    />
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* 약관 동의 안내 */}
      {!hasSubscription && (
        <p className="text-center text-xs text-slate-400">
          {isEn ? (
            <>
              By subscribing, you agree to the{' '}
              <Link href={`/${locale}/terms`} target="_blank" className="underline hover:text-slate-600">Terms</Link>
              ,{' '}
              <Link href={`/${locale}/privacy`} target="_blank" className="underline hover:text-slate-600">Privacy Policy</Link>
              , and{' '}
              <Link href={`/${locale}/refund`} target="_blank" className="underline hover:text-slate-600">Refund Policy</Link>.
            </>
          ) : (
            <>
              결제 진행 시{' '}
              <Link href={`/${locale}/terms`} target="_blank" className="underline hover:text-slate-600">이용약관</Link>
              ,{' '}
              <Link href={`/${locale}/privacy`} target="_blank" className="underline hover:text-slate-600">개인정보처리방침</Link>
              ,{' '}
              <Link href={`/${locale}/refund`} target="_blank" className="underline hover:text-slate-600">환불 정책</Link>에 동의하는 것으로 간주됩니다.
            </>
          )}
        </p>
      )}
    </div>
  )
}

function PolarButton({
  planKey,
  locale,
  processing,
  disabled,
  onClick,
}: {
  planKey: string
  locale: string
  processing: boolean
  disabled: boolean
  onClick: () => void
}) {
  const isEn = locale === 'en'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-lg bg-[#111827] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative flex items-center justify-center gap-2">
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? 'Processing...' : '처리 중...'}
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            {isEn ? 'Subscribe' : '결제하기'}
          </>
        )}
      </span>
    </button>
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
