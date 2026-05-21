import { redirect } from 'next/navigation'
import { AlertCircle, Briefcase, Info, Save } from 'lucide-react'
import { getSessionUser, saveBrandAction } from '../../actions'
import { checkBrandCountLimit } from '../../../lib/limits'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

const industries = ['온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS']
const tones = ['친근하고 명확한 톤', '전문적이고 신뢰감 있는 톤', '젊고 경쾌한 톤', '고급스럽고 차분한 톤']
const ctas = ['프로필 링크에서 예약하기', 'DM으로 문의하기', '무료 상담 신청하기', '스토어에서 자세히 보기']

export default async function BrandSettingsPage() {
  const user = await getSessionUser()
  if (!user) return null

  const brands = await dbService.getBrands(user.id)
  const existingBrand = brands[0] || null
  const limitCheck = await checkBrandCountLimit(user.id)

  async function handleSubmit(formData: FormData) {
    'use server'
    const res = await saveBrandAction(existingBrand?.id || null, {
      name: formData.get('name') as string,
      industry: formData.get('industry') as string,
      targetAudience: formData.get('targetAudience') as string,
      toneOfVoice: formData.get('toneOfVoice') as string,
      mainColor: formData.get('mainColor') as string,
      forbiddenWords: formData.get('forbiddenWords') as string,
      ctaStyle: formData.get('ctaStyle') as string,
    })

    if (res.success) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
      <div className="mb-8">
        <p className="eyebrow">Brand System</p>
        <div className="mt-3 flex items-start gap-3">
          <Briefcase className="mt-1 h-6 w-6 text-[#b94718]" />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-neutral-950">브랜드 설정</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
              카드뉴스의 말투, 색상, 금칙어, CTA를 정의합니다. 이 정보가 모든 캠페인 생성의 기준이 됩니다.
            </p>
          </div>
        </div>
      </div>

      {!existingBrand && !limitCheck.allowed && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>
              현재 {user.plan} 요금제에서는 브랜드를 최대 {limitCheck.limit}개까지 등록할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      <form action={handleSubmit} className="panel rounded-lg p-6 md:p-8">
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-[#dedbd2] bg-[#f1f0eb]/70 px-4 py-3 text-xs text-[#6f6a61]">
          <Info className="h-4 w-4 shrink-0" />
          기존 브랜드가 있으면 저장 시 현재 브랜드 정보가 업데이트됩니다.
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field
            id="name"
            label="브랜드명"
            placeholder="예: 모카 스튜디오"
            defaultValue={existingBrand?.name || ''}
            required
          />
          <Field
            id="industry"
            label="업종"
            placeholder="예: 카페 / F&B"
            defaultValue={existingBrand?.industry || ''}
            list="industries-list"
            required
          />
          <datalist id="industries-list">
            {industries.map((item) => <option key={item} value={item} />)}
          </datalist>

          <Field
            id="targetAudience"
            label="주요 고객"
            placeholder="예: 2030 직장인 여성, 동네 단골 고객"
            defaultValue={existingBrand?.targetAudience || ''}
            required
          />
          <Field
            id="toneOfVoice"
            label="톤앤매너"
            placeholder="예: 고급스럽고 차분한 톤"
            defaultValue={existingBrand?.toneOfVoice || ''}
            list="tones-list"
            required
          />
          <datalist id="tones-list">
            {tones.map((item) => <option key={item} value={item} />)}
          </datalist>

          <div>
            <label htmlFor="mainColor" className="mb-2 block text-xs font-bold text-[#5d584f]">
              브랜드 컬러
            </label>
            <div className="flex gap-2">
              <input
                id="mainColor"
                name="mainColor"
                type="text"
                required
                placeholder="#B94718"
                defaultValue={existingBrand?.mainColor || '#B94718'}
                className="field h-11 px-3"
              />
              <input
                type="color"
                defaultValue={existingBrand?.mainColor || '#b94718'}
                className="h-11 w-12 rounded-lg border border-[#dedbd2] bg-white p-1"
                aria-label="브랜드 컬러 선택"
              />
            </div>
          </div>

          <Field
            id="ctaStyle"
            label="기본 CTA"
            placeholder="예: 프로필 링크에서 예약하기"
            defaultValue={existingBrand?.ctaStyle || ''}
            list="ctas-list"
            required
          />
          <datalist id="ctas-list">
            {ctas.map((item) => <option key={item} value={item} />)}
          </datalist>
        </div>

        <div className="mt-6">
          <Field
            id="forbiddenWords"
            label="금칙어"
            placeholder="예: 100% 보장, 세계 최고, 최저가"
            defaultValue={existingBrand?.forbiddenWords || ''}
          />
          <p className="mt-2 text-xs text-[#6f6a61]">쉼표로 구분해 입력하세요.</p>
        </div>

        <div className="mt-8 flex justify-end border-t border-[#ece9e0] pt-6">
          <button
            type="submit"
            disabled={!existingBrand && !limitCheck.allowed}
            className="btn-primary px-5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            저장하기
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  id,
  label,
  placeholder,
  defaultValue,
  list,
  required,
}: {
  id: string
  label: string
  placeholder: string
  defaultValue: string
  list?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-bold text-[#5d584f]">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        list={list}
        className="field h-11 px-3"
      />
    </div>
  )
}
