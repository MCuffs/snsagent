import { redirect } from 'next/navigation'
import { Info, Sparkles } from 'lucide-react'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import CreateCampaignForm from './CreateCampaignForm'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  const user = await getSessionUser()
  if (!user) return null

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) {
    redirect('/brand')
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Media Card Engine</p>
        <div className="mt-3 flex items-start gap-3">
          <Sparkles className="mt-1 h-6 w-6 text-[#ff4f0a]" />
          <div>
            <h1 className="text-4xl font-black tracking-[-0.055em] text-[#1f1512]">미디어 카드뉴스 생성</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#746a62]">
              뉴스형, 트렌드형, 정보형 카드뉴스를 생성합니다. 이미지는 배경만 만들고,
              레이아웃과 한글 타이포그래피는 렌더링 엔진이 직접 합성합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-3 rounded-[8px] border border-[#d8edf7] bg-[#f3fbff] p-4 text-sm text-[#4c6070]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2aa2db]" />
        <p>
          현재 브랜드는 <strong>{brands[0].name}</strong>입니다. 생성 결과는 캠페인으로 저장되고,
          결과 화면에서 슬라이드와 캡션을 확인할 수 있습니다.
        </p>
      </div>

      <CreateCampaignForm
        brands={brands.map(brand => ({
          id: brand.id,
          name: brand.name,
          industry: brand.industry,
          targetAudience: brand.targetAudience,
          toneOfVoice: brand.toneOfVoice,
          mainColor: brand.mainColor,
          forbiddenWords: brand.forbiddenWords,
          ctaStyle: brand.ctaStyle,
        }))}
      />
    </div>
  )
}
