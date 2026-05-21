import { redirect } from 'next/navigation'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import CreateCampaignForm from './CreateCampaignForm'
import { Sparkles, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  const user = await getSessionUser()
  if (!user) return null

  // Fetch brands
  const brands = await dbService.getBrands(user.id)
  
  // If no brands are configured, redirect to brand settings page first
  if (brands.length === 0) {
    redirect('/brand')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-[#ff4f00]" />
          <span>새 카드뉴스 기획 및 생성</span>
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          홍보하고 싶은 신상품 정보나 비즈니스 혜택을 입력하면, AI 비서가 첫 장의 헤드 카피 훅(Hook)부터 마지막 장의 구매 유도(CTA) 버튼까지 기획안과 디자인 시안을 원클릭으로 빌드합니다.
        </p>
      </div>

      {/* Info Tip */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white flex gap-3 text-xs text-slate-500 items-center shadow-sm">
        <Info className="w-5 h-5 text-indigo-650 flex-shrink-0" />
        <p className="font-semibold text-slate-600">
          작성하신 제품 혜택과 설명은 브랜드 설정 시 입력해 둔 **&lsquo;{brands[0].name}&rsquo; 브랜드의 말투와 색상 필터**에 걸러져 최적의 카피로 조리됩니다.
        </p>
      </div>

      {/* Campaign Form Client Component */}
      <CreateCampaignForm brands={brands} />
    </div>
  )
}
