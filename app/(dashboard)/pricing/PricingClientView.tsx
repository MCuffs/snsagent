'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeUserPlanAction } from '../../actions'
import { PRICING_PLANS, SubscriptionPlan } from '../../../lib/limits-types'
import { Check, Sparkles, AlertCircle, X, ShieldCheck, Loader2 } from 'lucide-react'

interface PricingClientViewProps {
  currentPlan: string
  plansList: SubscriptionPlan[]
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function PricingClientView({ currentPlan, plansList }: PricingClientViewProps) {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showTossModal, setShowTossModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState('신한카드')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleOpenToss = (planKey: SubscriptionPlan) => {
    setSelectedPlan(planKey)
    setShowTossModal(true)
    setIsSuccess(false)
    setErrorMsg('')
  }

  const handleExecutePayment = async () => {
    if (!selectedPlan) return
    setIsProcessing(true)
    setErrorMsg('')

    try {
      // Simulate PG gateway authorization delay (1.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Call actual plan change Server Action
      const res = await changeUserPlanAction(selectedPlan)
      if (res.success) {
        setIsSuccess(true)
        // Redirect to dashboard after 1 second
        setTimeout(() => {
          setShowTossModal(false)
          router.refresh()
          router.push('/dashboard')
        }, 1200)
      } else {
        setErrorMsg(res.error || '가상 결제 승인에 실패했습니다.')
      }
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e, '네트워크 통신 오류가 발생했습니다.'))
    } finally {
      setIsProcessing(false)
    }
  }

  const cardList = ['신한카드', '현대카드', '삼성카드', 'KB국민카드', '토스페이', '카카오페이']

  return (
    <div className="space-y-8 font-sans">
      {/* active plan info summary banner */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white flex justify-between items-center text-xs shadow-sm">
        <div className="flex gap-2.5 items-center">
          <Sparkles className="w-5 h-5 text-[#ff4f00]" />
          <div>
            <p className="font-bold text-slate-800">현재 적용 중인 요금제: <span className="text-[#ff4f00] font-black">{currentPlan} PLAN</span></p>
            <p className="text-slate-500 mt-0.5 font-medium">실제 결제 없이 가상 토스페이먼츠 결제 게이트웨이를 통해 멤버십 등급 변경 및 한도 조정을 실시간 테스트할 수 있습니다.</p>
          </div>
        </div>
      </div>

      {/* Pricing grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plansList.map((planKey) => {
          const plan = PRICING_PLANS[planKey]
          const isCurrentPlan = currentPlan === planKey

          return (
            <div 
              key={planKey}
              className={`p-6 rounded-xl border flex flex-col justify-between bg-white relative transition-all duration-200 ${
                isCurrentPlan 
                  ? 'border-[#ff4f00] shadow-md' 
                  : 'border-slate-200 hover:border-slate-350'
              }`}
            >
              {isCurrentPlan && (
                <span className="absolute top-0 right-6 translate-y-[-50%] px-3 py-0.5 rounded-full bg-[#ff4f00] text-[8px] font-black uppercase text-white tracking-wider border border-[#ff4f00]/30 shadow-sm">
                  현재 이용 중
                </span>
              )}
              
              <div>
                <h3 className="text-base font-black text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-4 h-8 font-medium">{plan.description}</p>
                
                <div className="mb-6">
                  <span className="text-2xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-[10px] text-slate-400 font-bold ml-1">/ 월</span>
                </div>

                {/* Quotas list */}
                <div className="space-y-2.5 mb-6 border-t border-slate-100 pt-4 text-xs font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">월간 기획 한도</span>
                    <span className="text-slate-800">{plan.monthlyCampaignLimit === 9999 ? '무제한' : `월 ${plan.monthlyCampaignLimit}개`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">브랜드 슬롯</span>
                    <span className="text-slate-800">{plan.brandLimit === 9999 ? '무제한' : `최대 ${plan.brandLimit}개`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">인스타 자동예약</span>
                    <span className={`font-bold ${plan.canSchedule ? 'text-emerald-600' : 'text-red-500'}`}>{plan.canSchedule ? '공식 API 예약 지원' : '미지원 (수동)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">워터마크 여부</span>
                    <span className="text-slate-800">{plan.hasWatermark ? '워터마크 노출' : '워터마크 없음'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isCurrentPlan}
                onClick={() => handleOpenToss(planKey)}
                className={`w-full py-2.5 rounded-lg text-xs font-extrabold text-center transition-all cursor-pointer ${
                  isCurrentPlan 
                    ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-default' 
                    : 'bg-[#ff4f00] hover:bg-[#e04500] text-white shadow-sm active:scale-[0.98]'
                }`}
              >
                {isCurrentPlan ? '이용 중인 요금제' : '플랜 업그레이드'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Toss Payments SDK Simulated PG Modal */}
      {showTossModal && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden relative flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {/* Simulated Toss Payments Logo */}
                <div className="flex items-center gap-1">
                  <span className="text-blue-600 font-extrabold text-lg tracking-tight">toss</span>
                  <span className="text-slate-450 font-bold text-xs">payments</span>
                </div>
                <span className="text-[10px] bg-blue-150 text-blue-800 px-1.5 py-0.5 rounded font-extrabold">가상 테스트창</span>
              </div>
              <button 
                onClick={() => !isProcessing && setShowTossModal(false)}
                className="p-1 rounded-full hover:bg-slate-200 transition-colors text-slate-400 cursor-pointer disabled:opacity-50"
                disabled={isProcessing}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Merchant Details */}
            <div className="p-5 border-b border-slate-100 bg-white space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-450 font-bold uppercase">가맹점</span>
                <span className="text-xs font-bold text-slate-800">InstaAgent</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] text-slate-450 font-bold uppercase">상품명</span>
                <span className="text-sm font-extrabold text-slate-900">
                  InstaAgent {PRICING_PLANS[selectedPlan].name} 플랜 (1개월 구독)
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-[10px] text-slate-450 font-bold uppercase">결제금액</span>
                <span className="text-xl font-black text-[#ff4f00]">
                  {PRICING_PLANS[selectedPlan].price}
                </span>
              </div>
            </div>

            {/* Simulated Checkout Form */}
            <div className="p-5 space-y-4 flex-1">
              {isSuccess ? (
                /* Success message block */
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 animate-in zoom-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Check className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">가상 결제 승인 성공!</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    구독 변경이 완료되었습니다.<br />
                    잠시 후 대시보드로 이동합니다.
                  </p>
                </div>
              ) : (
                /* Interactive payment methods card list */
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">결제수단 선택</label>
                    <div className="grid grid-cols-3 gap-2">
                      {cardList.map((card) => (
                        <button
                          key={card}
                          type="button"
                          onClick={() => !isProcessing && setSelectedCard(card)}
                          disabled={isProcessing}
                          className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                            selectedCard === card
                              ? 'border-blue-600 bg-blue-50/20 text-blue-600 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-650 hover:bg-slate-50'
                          } disabled:opacity-50`}
                        >
                          {card}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex gap-2.5 items-start text-xs text-slate-550 leading-relaxed font-medium">
                    <ShieldCheck className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p>
                      본 창은 토스페이먼츠 결제 시스템 모사 시뮬레이터입니다. 실제 카드가 청구되지 않으며 결제 승인 요청 시 프로필 등급이 갱신됩니다.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 text-red-650 border border-red-150 rounded-lg text-xs font-bold flex gap-1.5 items-center">
                      <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Payment Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecutePayment}
                      className="w-full py-3.5 rounded-lg text-sm font-extrabold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer disabled:opacity-55"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>가상 결제 승인 처리 중...</span>
                        </>
                      ) : (
                        <span>{PRICING_PLANS[selectedPlan].price} 결제하기</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 text-center text-[9px] font-semibold text-slate-400">
              보안 인증서 검증 완료 | Toss Payments Corp Simulator
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
