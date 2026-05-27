import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import { PAID_SUBSCRIPTION_PLANS, normalizePlan } from '../../../lib/limits-types'
import { PAYPAL_PLAN_IDS } from '../../../lib/paypal'
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
  const hasSubscription = Boolean(user.tossBillingKey || user.paypalSubscriptionId)
  const tossCustomerKey = await dbService.ensureTossCustomerKey(user.id)
  const paymentProvider = user.tossBillingKey ? 'toss' : user.paypalSubscriptionId ? 'paypal' : null
  const paypalPlanIds: Record<string, string> = {}
  for (const [key, value] of Object.entries(PAYPAL_PLAN_IDS)) {
    if (value) paypalPlanIds[key] = value
  }
  const tossClientKey = (process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || '').trim()
  const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '').trim()

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Billing</p>
        <div className="mt-3 flex items-start gap-3">
          <CreditCard className="mt-1 h-5 w-5 text-[#0066ff]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111111]">요금제</h1>
            <p className="mt-1.5 text-sm text-[#52525b]">
              무료로 하루 한 장을 생성하고, 더 많은 운영이 필요하면 월 19,000원 Creator를 선택하세요.
            </p>
          </div>
        </div>
      </div>

      {params.success && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          결제가 완료되었습니다. 선택한 이용 권한이 계정에 반영되었습니다.
        </div>
      )}
      {params.canceled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {params.message || '결제가 취소되었습니다.'}
        </div>
      )}

      <PricingClientView
        currentPlan={normalizePlan(user.plan)}
        plansList={plansList}
        hasSubscription={hasSubscription}
        paymentProvider={paymentProvider}
        userId={user.id}
        tossClientKey={tossClientKey}
        tossCustomerKey={tossCustomerKey}
        paypalClientId={paypalClientId}
        paypalPlanIds={paypalPlanIds}
        customerName={user.name}
        customerEmail={user.email}
        showRegenerationOffer={params.offer === 'regeneration'}
      />
    </div>
  )
}
