import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getSessionUser } from '../../../lib/auth/user'
import { PAID_SUBSCRIPTION_PLANS, normalizePlan } from '../../../lib/limits-types'
import PricingClientView from './PricingClientView'

export const dynamic = 'force-dynamic'

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; canceled?: string; offer?: string; message?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = searchParams ? await searchParams : {}
  const hasSubscription = Boolean(user.polarSubscriptionId)
  const paymentProvider = user.polarSubscriptionId ? 'polar' : null
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
        plansList={PAID_SUBSCRIPTION_PLANS}
        hasSubscription={hasSubscription}
        paymentProvider={paymentProvider}
        userId={user.id}
        showRegenerationOffer={params.offer === 'regeneration'}
      />

      <div className="mt-12 border-t border-[#e4e4e7] pt-6 text-[11px] leading-6 text-[#a1a1aa] space-y-0.5">
        <p className="font-semibold text-[#71717a]">파랑버섯 스튜디오</p>
        <p>대표자: 정민수 · 사업자등록번호: 354-14-0333 · 통신판매업 신고번호: 2026-서울영등포-1320호</p>
        <p>주소: 서울특별시 영등포구 · 고객센터: admin@shuffla.io</p>
        <p>부가세 포함 가격 · 구독 취소 시 잔여 기간 부분 환불 미제공</p>
      </div>
    </div>
  )
}
