'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, CreditCard, Loader2, X } from 'lucide-react'
import { FUNDING, PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'
import { analytics } from '../../../lib/analytics/thinkingdata'


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
        currency: 'KRW',
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
  customerName: _customerName,
  customerEmail: _customerEmail,
  showRegenerationOffer,
  paymentSuccess,
  locale = 'ko',
}: PricingClientViewProps) {
  const router = useRouter()
  const t = useTranslations('billing')
  const [error, setError] = useState('')
  const [canceling, setCanceling] = useState(false)
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const [cardModalPlan, setCardModalPlan] = useState<string | null>(null)
  const [fscLoaded, setFscLoaded] = useState(false)

  // Locale-based payment method determination
  const showNicePay = locale === 'ko' && Boolean(nicepayClientKey)
  const showPayPal = locale !== 'ko' && Object.keys(paypalPlanIds).length > 0
  const isFastSpringTester = _customerEmail?.trim().toLowerCase() === 'alstnwjd0424@gmail.com'

  // Dynamic FastSpring SDK script loader
  useEffect(() => {
    if (!isFastSpringTester) return

    // If script already exists, check if global fastspring is loaded
    const existingScript = document.getElementById('fsc-api')
    if (existingScript) {
      if ((window as any).fastspring) {
        setFscLoaded(true)
      }
      return
    }

    const storefront = process.env.NEXT_PUBLIC_FASTSPRING_STOREFRONT || 'shuffla.test.onfastspring.com/popup-shuffla'
    const script = document.createElement('script')
    script.id = 'fsc-api'
    script.src = 'https://sbl.onfastspring.com/sbl/1.0.5/fastspring-builder.min.js'
    script.type = 'text/javascript'
    script.setAttribute('data-storefront', storefront)
    script.async = true
    script.onload = () => {
      setFscLoaded(true)
    }
    script.onerror = () => {
      console.error('Failed to load FastSpring SBL SDK')
    }
    document.body.appendChild(script)
  }, [isFastSpringTester])

  const handleFastSpringCheckout = (plan: string) => {
    const productPath = plan === 'PRO'
      ? (process.env.NEXT_PUBLIC_FASTSPRING_CREATOR_PRODUCT || 'shuffla-creator-plan')
      : (process.env.NEXT_PUBLIC_FASTSPRING_STUDIO_PRODUCT || 'shuffla-studio-plan')

    const fsc = (window as any).fastspring
    if (fsc && fsc.builder) {
      try {
        setError('')
        fsc.builder.clean()
        fsc.builder.add(productPath)
        if (_customerEmail) {
          fsc.builder.push({
            contact: {
              email: _customerEmail
            }
          })
        }
        fsc.builder.checkout()
      } catch (err) {
        console.error('FastSpring Popup checkout error:', err)
        setError('FastSpring 결제창을 여는 데 실패했습니다.')
      }
    } else {
      setError('FastSpring 결제 라이브러리가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.')
    }
  }

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

  const handleCardDirectPayment = async (data: {
    cardNo: string
    cardExpire: string
    idNo: string
    cardPw: string
  }) => {
    if (!cardModalPlan) return
    const planKey = cardModalPlan
    const returnToken = nicepayReturnTokens[planKey]
    if (!returnToken) {
      setError(t('nicepay_start_failed'))
      return
    }

    setError('')
    setProcessingPayment(planKey)

    const PLAN_AMOUNTS: Record<string, number> = { LITE: 3000, PRO: 25000, UNLIMITED: 39000 }
    const amount = PLAN_AMOUNTS[planKey] ?? 0
    const orderId = `shuffla_regist_${Date.now()}_${planKey}`

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

    try {
      const [encodedPayload] = returnToken.split('.')
      if (!encodedPayload) {
        throw new Error('Invalid payment token format')
      }

      const decodeBase64Url = (str: string) => {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) {
          base64 += '='
        }
        return atob(base64)
      }

      const payloadObj = JSON.parse(decodeBase64Url(encodedPayload))
      const encryptionKey = payloadObj.encryptionKey
      if (!encryptionKey) {
        throw new Error('Encryption key missing from payment token')
      }

      const plaintext = `cardNo=${data.cardNo}&cardExpire=${data.cardExpire}&idNo=${data.idNo}&cardPw=${data.cardPw}`
      const { ciphertext, iv } = await encryptCardDataClient(plaintext, encryptionKey)

      const res = await fetch('/api/nicepay/card-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: returnToken,
          ciphertext,
          iv,
          plan: planKey,
        }),
      })

      const responseData = await res.json() as { error?: string; offer?: string }

      if (!res.ok) {
        analytics.paymentFailed(planKey, 'nicepay', responseData.error || 'api_error', {
          amount,
          currency: 'KRW',
          order_id: orderId,
        })
        setError(responseData.error || t('nicepay_approve_failed'))
        setProcessingPayment(null)
      } else {
        analytics.paymentSuccess(planKey, 'nicepay', {
          amount,
          currency: 'KRW',
          order_id: orderId,
          offer_type: responseData.offer === 'regeneration' ? 'regeneration' : undefined,
        })
        setCardModalPlan(null)
        if (responseData.offer === 'regeneration') {
          router.push('/billing?success=true&offer=regeneration')
        } else {
          router.push('/billing?success=true')
        }
      }
    } catch (err) {
      console.error('Payment direct registration error:', err)
      setError(t('network_error'))
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
                          onClick={() => setCardModalPlan('LITE')}
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
                                <CreditCard className="h-4 w-4" />
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
          const isEnglish = locale === 'en'
          const isCurrentPlan = currentPlan === planKey
          const paypalPlanId = paypalPlanIds[planKey]
          const planDescription = isEnglish ? plan.description_en : plan.description
          const planPrice = isEnglish ? plan.price_en : plan.price
          const planFeatures = isEnglish ? plan.features_en : plan.features

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
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{planDescription}</p>
                    </div>
                    {isCurrentPlan && (
                      <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        {t('current_plan')}
                      </span>
                    )}
                  </div>
                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold tracking-tight text-slate-900">{planPrice}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {isEnglish ? 'VAT included' : '부가세 포함'}
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
                  <div className="space-y-3">
                    {isFastSpringTester && (
                      <button
                        type="button"
                        onClick={() => handleFastSpringCheckout(planKey)}
                        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 py-3.5 text-sm font-semibold text-slate-100 border border-indigo-900/30 shadow-sm transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative flex items-center justify-center gap-2">
                          {!fscLoaded ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 text-indigo-400" />
                              {locale === 'en' ? 'FastSpring (Pending)' : 'FastSpring (임시대기중)'}
                            </>
                          )}
                        </span>
                      </button>
                    )}
                    {showNicePay && (
                      <button
                        type="button"
                        onClick={() => setCardModalPlan(planKey)}
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
                              <CreditCard className="h-4 w-4" />
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
                        locale={locale}
                      />
                    )}
                    {showPayPal && !paypalPlanId && !isFastSpringTester && (
                      <p className="text-center text-xs font-medium text-slate-500">{t('payment_setup')}</p>
                    )}
                    {!showNicePay && !showPayPal && !isFastSpringTester && (
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
      {cardModalPlan && (
        <CardInfoModal
          planKey={cardModalPlan}
          processing={processingPayment !== null}
          onSubmit={handleCardDirectPayment}
          onClose={() => setCardModalPlan(null)}
          locale={locale}
        />
      )}
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
  locale = 'ko',
}: {
  planKey: string
  planId: string
  userId: string
  currentPlan: string
  onSuccess: () => void
  onError: (message: string) => void
  locale?: string
}) {
  const [{ isPending }] = usePayPalScriptReducer()
  const t = useTranslations('billing')
  const [agreed, setAgreed] = useState(false)

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
    <div className="space-y-3">
      {/* Checkbox for PayPal */}
      <div className="flex items-start gap-2 px-1 text-left">
        <input
          type="checkbox"
          id={`paypal-agree-${planKey}`}
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
        />
        <label htmlFor={`paypal-agree-${planKey}`} className="text-xs leading-normal text-slate-500">
          {locale === 'en' ? (
            <>
              I agree to the{' '}
              <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                Terms
              </Link>
              ,{' '}
              <Link href={`/${locale}/privacy`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                Privacy
              </Link>
              , and{' '}
              <Link href={`/${locale}/refund`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                Refund Policy
              </Link>
              . (Required)
            </>
          ) : (
            <>
              정기 결제 진행을 위해{' '}
              <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                이용약관
              </Link>
              ,{' '}
              <Link href={`/${locale}/privacy`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                개인정보처리방침
              </Link>
              ,{' '}
              <Link href={`/${locale}/refund`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                환불 정책
              </Link>
              을 모두 확인하였으며 이에 동의합니다. (필수)
            </>
          )}
        </label>
      </div>

      <div className={agreed ? '' : 'pointer-events-none opacity-40'}>
        <p className="mb-2 text-center text-xs font-bold text-[#6f6a61]">{t('paypal_label')}</p>
        <PayPalButtons
          fundingSource={FUNDING.PAYPAL}
          forceReRender={[planId, userId, agreed]}
          style={{ layout: 'vertical', color: 'gold', shape: 'rect', height: 40, label: 'subscribe' }}
          createSubscription={createSubscription as Parameters<typeof PayPalButtons>[0]['createSubscription']}
          onApprove={onApprove as Parameters<typeof PayPalButtons>[0]['onApprove']}
          onError={() => {
            analytics.paymentFailed(planKey, 'paypal', 'paypal_sdk_error', { subscription_id: planId })
            onError(t('paypal_error'))
          }}
        />
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

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function encryptCardDataClient(plainText: string, keyBase64: string): Promise<{ ciphertext: string; iv: string }> {
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const iv = window.crypto.getRandomValues(new Uint8Array(12))

  const encoder = new TextEncoder()
  const encodedText = encoder.encode(plainText)

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    cryptoKey,
    encodedText
  )

  return {
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
    iv: toBase64(iv),
  }
}

function CardInfoModal({
  planKey,
  processing,
  onSubmit,
  onClose,
  locale = 'ko',
}: {
  planKey: string
  processing: boolean
  onSubmit: (data: { cardNo: string; cardExpire: string; idNo: string; cardPw: string }) => void
  onClose: () => void
  locale?: string
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [cardNo, setCardNo] = useState('')
  const [cardExpire, setCardExpire] = useState('')
  const [idNo, setIdNo] = useState('')
  const [cardPw, setCardPw] = useState('')
  const [formError, setFormError] = useState('')
  const [agreed, setAgreed] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!agreed) {
      setFormError(locale === 'en' ? 'Please agree to the terms.' : '이용약관 및 환불정책 동의에 체크해주세요.')
      return
    }
    const rawCard = cardNo.replace(/-/g, '')
    if (!/^\d{14,16}$/.test(rawCard)) { setFormError('카드번호를 올바르게 입력해 주세요.'); return }
    if (!/^\d{4}$/.test(cardExpire.replace('/', ''))) { setFormError('유효기간을 MM/YY 형식으로 입력해 주세요.'); return }
    if (!/^\d{6}(\d{4})?$/.test(idNo)) { setFormError('생년월일(6자리) 또는 사업자번호(10자리)를 입력해 주세요.'); return }
    if (!/^\d{2}$/.test(cardPw)) { setFormError('비밀번호 앞 2자리를 입력해 주세요.'); return }
    // 유효기간 MM/YY → YYMM 변환
    const [mm, yy] = cardExpire.split('/')
    onSubmit({ cardNo: rawCard, cardExpire: `${yy}${mm}`, idNo, cardPw })
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === overlayRef.current && !processing) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">카드 정보 입력</h2>
          </div>
          <button type="button" onClick={onClose} disabled={processing} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">Shuffla {planKey === 'PRO' ? 'Creator' : planKey === 'UNLIMITED' ? 'Studio' : planKey}</span> 정기 구독 등록을 위해 카드 정보를 입력해 주세요.
        </p>

        {/* W-1/7: 결제 금액·자동갱신 주기 명시 */}
        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">결제 금액</span>
            <span className="font-bold text-slate-900">
              {planKey === 'PRO' ? '월 25,000원 (부가세 포함)' : planKey === 'UNLIMITED' ? '월 39,000원 (부가세 포함)' : planKey === 'LITE' ? '3,000원 (부가세 포함, 1회)' : ''}
            </span>
          </div>
          {planKey !== 'LITE' && (
            <p className="mt-1.5 text-xs text-slate-400">
              매월 자동 청구됩니다. 언제든지 취소할 수 있으며, 취소 후 즉시 이용이 중단됩니다.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">카드번호</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0000 - 0000 - 0000 - 0000"
              maxLength={19}
              value={cardNo}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 16)
                setCardNo(v.replace(/(.{4})/g, '$1-').replace(/-$/, ''))
              }}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm tracking-widest outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">유효기간</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="MM / YY"
                maxLength={5}
                value={cardExpire}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setCardExpire(v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v)
                }}
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm tracking-widest outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">비밀번호 앞 2자리</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="••"
                maxLength={2}
                value={cardPw}
                onChange={(e) => setCardPw(e.target.value.replace(/\D/g, '').slice(0, 2))}
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">생년월일 6자리 <span className="font-normal text-slate-400">(법인카드: 사업자번호 10자리)</span></label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYMMDD"
              maxLength={10}
              value={idNo}
              onChange={(e) => setIdNo(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm tracking-widest outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
          </div>

          {formError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</p>
          )}

          {/* Agreement Checkbox */}
          <div className="flex items-start gap-2.5 py-1">
            <input
              type="checkbox"
              id="payment-agree-modal"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            <label htmlFor="payment-agree-modal" className="text-xs leading-normal text-slate-500">
              {locale === 'en' ? (
                <>
                  I agree to the{' '}
                  <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    Terms
                  </Link>
                  ,{' '}
                  <Link href={`/${locale}/privacy`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    Privacy
                  </Link>
                  , and{' '}
                  <Link href={`/${locale}/refund`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    Refund Policy
                  </Link>
                  . (Required)
                </>
              ) : (
                <>
                  정기 결제 진행을 위해{' '}
                  <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    이용약관
                  </Link>
                  ,{' '}
                  <Link href={`/${locale}/privacy`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    개인정보처리방침
                  </Link>
                  ,{' '}
                  <Link href={`/${locale}/refund`} target="_blank" className="font-semibold text-slate-700 underline underline-offset-2 hover:text-[#ff6b35]">
                    환불 정책
                  </Link>
                  을 모두 확인하였으며 이에 동의합니다. (필수)
                </>
              )}
            </label>
          </div>

          <p className="text-xs text-slate-400">
            카드 정보는 나이스페이 보안 서버로 직접 전송되며 Shuffla 서버에 저장되지 않습니다.
          </p>

          <button
            type="submit"
            disabled={processing || !agreed}
            className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                결제 처리 중...
              </span>
            ) : '결제하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

