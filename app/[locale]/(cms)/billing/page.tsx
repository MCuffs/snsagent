import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getSessionUser } from '../../../../lib/auth/user'
import { PAID_SUBSCRIPTION_PLANS, normalizePlan } from '../../../../lib/limits-types'
import PricingClientView from '../../../(cms)/billing/PricingClientView'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export default async function PricingPage({
  searchParams,
  params,
}: {
  searchParams?: Promise<{ success?: string; canceled?: string; offer?: string; message?: string }>
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login`)

  const t = await getTranslations('billing')
  const sp = searchParams ? await searchParams : {}
  const hasSubscription = Boolean(user.polarSubscriptionId && user.polarSubscriptionStatus === 'active')
  const paymentProvider = hasSubscription ? 'polar' : null

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

      {sp.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {t('payment_success')}
        </div>
      )}
      {sp.canceled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {sp.message || t('payment_canceled')}
        </div>
      )}

      <PricingClientView
        currentPlan={normalizePlan(user.plan)}
        plansList={PAID_SUBSCRIPTION_PLANS}
        hasSubscription={hasSubscription}
        paymentProvider={paymentProvider}
        userId={user.id}
        showRegenerationOffer={sp.offer === 'regeneration'}
        paymentSuccess={sp.success === 'true'}
        locale={locale}
      />

      <div className="mt-12 border-t border-[#e4e4e7] pt-6 text-[11px] leading-6 text-[#a1a1aa] space-y-0.5">
        <p className="font-semibold text-[#71717a]">{t('company_name')}</p>
        <p>{t('company_info_1')}</p>
        <p>{t('company_info_2')}</p>
        <p>{t('company_info_3')}</p>
      </div>
    </div>
  )
}
