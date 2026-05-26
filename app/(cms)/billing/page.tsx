import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'
import { PAID_SUBSCRIPTION_PLANS, normalizePlan } from '../../../lib/limits-types'
import { PAYPAL_PLAN_IDS } from '../../../lib/paypal'
import PricingClientView from './PricingClientView'

export const dynamic = 'force-dynamic'

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; canceled?: string }>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) redirect('/concept')

  const params = searchParams ? await searchParams : {}
  const plansList = PAID_SUBSCRIPTION_PLANS
  const hasSubscription = Boolean(user.paypalSubscriptionId)

  const paypalPlanIds: Record<string, string> = {}
  for (const [key, val] of Object.entries(PAYPAL_PLAN_IDS)) {
    if (val) paypalPlanIds[key] = val
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Billing</p>
        <div className="mt-3 flex items-start gap-3">
          <CreditCard className="mt-1 h-5 w-5 text-[#0066ff]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111111]">요금제</h1>
            <p className="mt-1.5 text-sm text-[#52525b]">
              월 3,000원 1회부터 제작 빈도에 맞는 카드뉴스 이용권을 선택하세요.
            </p>
          </div>
        </div>
      </div>

      {params.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          결제가 완료되었습니다. 플랜이 업그레이드되었습니다.
        </div>
      )}
      {params.canceled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          결제가 취소되었습니다.
        </div>
      )}

      <PricingClientView
        currentPlan={normalizePlan(user.plan)}
        plansList={plansList}
        hasSubscription={hasSubscription}
        paypalClientId={process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''}
        paypalPlanIds={paypalPlanIds}
      />
    </div>
  )
}
