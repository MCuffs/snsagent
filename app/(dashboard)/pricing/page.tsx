import { redirect } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { getSessionUser } from '../../actions'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits'
import PricingClientView from './PricingClientView'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const plansList = Object.keys(PRICING_PLANS) as SubscriptionPlan[]

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Billing</p>
        <div className="mt-3 flex items-start gap-3">
          <CreditCard className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">요금제</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
              현재 결제는 시뮬레이터입니다. 플랜을 변경하면 사용량 제한만 즉시 반영됩니다.
            </p>
          </div>
        </div>
      </div>

      <PricingClientView currentPlan={user.plan} plansList={plansList} />
    </div>
  )
}
