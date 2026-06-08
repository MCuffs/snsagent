import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import { PAID_SUBSCRIPTION_PLANS, normalizePlan } from '../../../lib/limits-types'
import { isPaidPlan } from '../../../lib/nicepay'
import { getPublicPayPalClientId, PAYPAL_PLAN_IDS } from '../../../lib/paypal'
import { createNicepayReturnToken } from '../../../lib/nicepay-return-token'
import PricingClientView from './PricingClientView'

export const dynamic = 'force-dynamic'

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; canceled?: string; offer?: string; message?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) redirect('/concept')

  const params = searchParams ? await searchParams : {}
  const plansList = PAID_SUBSCRIPTION_PLANS
  const hasSubscription = Boolean(user.paypalSubscriptionId || user.nicepayBid)
  const paymentProvider = user.nicepayBid ? 'nicepay' : user.paypalSubscriptionId ? 'paypal' : null
  const paypalPlanIds: Record<string, string> = {}
  for (const [key, value] of Object.entries(PAYPAL_PLAN_IDS)) {
    if (value) paypalPlanIds[key] = value
  }
  const paypalClientId = getPublicPayPalClientId()
  const nicepayReturnTokens = Object.fromEntries(
    plansList.filter(isPaidPlan).map((plan) => [plan, createNicepayReturnToken(user.id, plan)]),
  )
  const t = await getTranslations('billing')

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">{t('eyebrow')}</p>
        <div className="mt-3 flex items-start gap-3">
          <CreditCard className="mt-1 h-5 w-5 text-[#0066ff]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111111]">{t('title')}</h1>
            <p className="mt-1.5 text-sm text-[#52525b]">{t('desc')}</p>
          </div>
        </div>
      </div>

      {params.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {t('payment_success')}
        </div>
      )}
      {params.canceled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {params.message || t('payment_canceled')}
        </div>
      )}

      <PricingClientView
        currentPlan={normalizePlan(user.plan)}
        plansList={plansList}
        hasSubscription={hasSubscription}
        paymentProvider={paymentProvider}
        userId={user.id}
        paypalClientId={paypalClientId}
        paypalPlanIds={paypalPlanIds}
        nicepayClientKey={(process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY || '').trim()}
        nicepayReturnTokens={nicepayReturnTokens}
        customerName={user.name}
        customerEmail={user.email}
        showRegenerationOffer={params.offer === 'regeneration'}
      />
    </div>
  )
}
