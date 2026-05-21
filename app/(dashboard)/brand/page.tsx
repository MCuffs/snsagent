import { redirect } from 'next/navigation'
import { getSessionUser, saveBrandAction } from '../../actions'
import { dbService } from '../../../lib/db-service'
import { checkBrandCountLimit } from '../../../lib/limits'
import { Briefcase, AlertCircle, Save, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BrandSettingsPage() {
  const user = await getSessionUser()
  if (!user) return null

  // Fetch existing brands
  const brands = await dbService.getBrands(user.id)
  const existingBrand = brands.length > 0 ? brands[0] : null

  // Check brand creation limit (for warning representation)
  const limitCheck = await checkBrandCountLimit(user.id)

  // Server action handler to trigger inside server component
  async function handleSubmit(formData: FormData) {
    'use server'
    const name = formData.get('name') as string
    const industry = formData.get('industry') as string
    const targetAudience = formData.get('targetAudience') as string
    const toneOfVoice = formData.get('toneOfVoice') as string
    const mainColor = formData.get('mainColor') as string
    const forbiddenWords = formData.get('forbiddenWords') as string
    const ctaStyle = formData.get('ctaStyle') as string

    const res = await saveBrandAction(existingBrand?.id || null, {
      name,
      industry,
      targetAudience,
      toneOfVoice,
      mainColor,
      forbiddenWords,
      ctaStyle,
    })

    if (res.success) {
      redirect('/dashboard')
    }
  }

  // Pre-sets for easy clicks
  const industries = ['스마트스토어 쇼핑몰', '뷰티 / 피부샵', '헬스 / 피트니스', '카페 / F&B', '학원 / 강사', 'IT / SaaS']
  const tones = ['친근한 대화체 (~해요, ~요)', '신뢰감을 주는 전문 격식체 (~합니다)', '트렌디한 MZ 밈 말투', '고급스럽고 차분한 브랜드 어투']
  const ctas = ['프로필 링크 클릭 후 예약하기', 'DM으로 문의하기', '지금 바로 무료 상담 신청', '댓글로 키워드 남기기', '스마트스토어에서 자세히 보기']

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 font-sans">
      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
          <Briefcase className="w-8 h-8 text-[#ff4f00]" />
          <span>브랜드 프로필 설정</span>
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          이곳에 기입된 정보는 AI 비서가 카드뉴스를 기획하고, 캡션 및 해시태그를 작성할 때 고유 기준(컨셉, 말투, 테마 색상)으로 활용됩니다.
        </p>
      </div>

      {/* Plan quota warning banner */}
      {!existingBrand && !limitCheck.allowed && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex gap-3 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 font-semibold">
            <p className="font-bold text-red-900">브랜드 생성 한도 초과</p>
            <p>현재 사용 중인 {user.plan} 요금제는 브랜드를 최대 {limitCheck.limit}개까지만 등록할 수 있습니다. 추가 등록을 원하시면 요금제를 업그레이드 하세요.</p>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-8 relative">
        <div className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 flex items-center gap-1">
          <Info className="w-3 h-3" />
          <span>기존 내용 수정 시 덮어쓰기됩니다</span>
        </div>

        <form action={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brand Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                브랜드명 / 회사 이름
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="예: 핏포스 짐, 데일리 모카"
                defaultValue={existingBrand?.name || ''}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
            </div>

            {/* Industry Selection */}
            <div className="space-y-2">
              <label htmlFor="industry" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                업종 카테고리
              </label>
              <input
                id="industry"
                name="industry"
                type="text"
                required
                placeholder="예: 헬스 / 피트니스"
                defaultValue={existingBrand?.industry || ''}
                list="industries-list"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
              <datalist id="industries-list">
                {industries.map((ind, i) => <option key={i} value={ind} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Audience */}
            <div className="space-y-2">
              <label htmlFor="targetAudience" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                주요 타겟 고객
              </label>
              <input
                id="targetAudience"
                name="targetAudience"
                type="text"
                required
                placeholder="예: 2030 직장인 여성, 스마트스토어 초보 대표님들"
                defaultValue={existingBrand?.targetAudience || ''}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
            </div>

            {/* Tone of Voice */}
            <div className="space-y-2">
              <label htmlFor="toneOfVoice" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                콘텐츠 말투 (어조)
              </label>
              <input
                id="toneOfVoice"
                name="toneOfVoice"
                type="text"
                required
                placeholder="예: 친근하고 따뜻한 이모지 가득 어투"
                defaultValue={existingBrand?.toneOfVoice || ''}
                list="tones-list"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
              <datalist id="tones-list">
                {tones.map((t, i) => <option key={i} value={t} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brand Primary Color */}
            <div className="space-y-2">
              <label htmlFor="mainColor" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                브랜드 주요 강조 색상 (Hex Code)
              </label>
              <div className="flex gap-2">
                <input
                  id="mainColor"
                  name="mainColor"
                  type="text"
                  required
                  placeholder="#EE2A7B"
                  defaultValue={existingBrand?.mainColor || '#EE2A7B'}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
                />
                <input 
                  type="color"
                  defaultValue={existingBrand?.mainColor || '#ee2a7b'}
                  className="w-12 h-10 border border-slate-200 bg-white cursor-pointer p-1 rounded-lg"
                />
              </div>
            </div>

            {/* CTA Style */}
            <div className="space-y-2">
              <label htmlFor="ctaStyle" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                기본 Call-To-Action (마지막 장 유도 문구)
              </label>
              <input
                id="ctaStyle"
                name="ctaStyle"
                type="text"
                required
                placeholder="예: 프로필 링크 클릭 후 예약하기"
                defaultValue={existingBrand?.ctaStyle || ''}
                list="ctas-list"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
              />
              <datalist id="ctas-list">
                {ctas.map((c, i) => <option key={i} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Forbidden Words */}
          <div className="space-y-2">
            <label htmlFor="forbiddenWords" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex justify-between">
              <span>금지 단어 (피해야 할 단어들)</span>
              <span className="text-[9px] text-slate-400 font-bold lowercase">쉼표(,)로 구분</span>
            </label>
            <input
              id="forbiddenWords"
              name="forbiddenWords"
              type="text"
              placeholder="예: 100% 보장, 원조, 세계 최고, 최저가"
              defaultValue={existingBrand?.forbiddenWords || ''}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
            />
          </div>

          {/* Submit Button */}
          <div className="border-t border-slate-100 pt-6 flex justify-end">
            <button
              type="submit"
              disabled={!existingBrand && !limitCheck.allowed}
              className="px-6 py-3 rounded-lg text-sm font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>브랜드 설정 저장하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
