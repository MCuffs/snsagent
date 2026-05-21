import { redirect } from 'next/navigation'
import { getSessionUser } from '../../actions'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits'
import { CreditCard } from 'lucide-react'
import PricingClientView from './PricingClientView'

export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const plansList = Object.keys(PRICING_PLANS) as SubscriptionPlan[]

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-[#ff4f00]" />
          <span>요금제 및 멤버십 설정</span>
        </h1>
        <p className="text-xs font-semibold text-slate-500">
          가상 토스페이먼츠 연동 결제 게이트웨이를 사용하여 등급을 직접 전환하고, 인스타 자동 예약 업로드 및 브랜드 생성 한도 스펙을 테스트할 수 있습니다.
        </p>
      </div>

      {/* Interactive Client Checkout Module */}
      <PricingClientView 
        currentPlan={user.plan} 
        plansList={plansList} 
      />
    </div>
  )
}
