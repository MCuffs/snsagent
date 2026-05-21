'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Image as ImageIcon, ArrowRight } from 'lucide-react'

interface Brand {
  id: string
  name: string
}

interface GenerateCampaignResponse {
  campaignId?: string
  error?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function CreateCampaignForm({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Form fields
  const [brandId, setBrandId] = useState(brands[0]?.id || '')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [keyBenefits, setKeyBenefits] = useState('')
  const [objective, setObjective] = useState('정보 제공 및 가치 어필')
  const [slideCount, setSlideCount] = useState(5)
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null)

  const steps = [
    'AI 직원이 브랜드 프로필을 분석하고 있습니다...',
    '핵심 혜택을 기반으로 슬라이드 기획 초안을 구성 중입니다...',
    '모바일 화면에 최적화된 문구를 다듬는 카피라이팅 작업 중...',
    '이미지 생성 모델에 전달할 비주얼 프롬프트를 빌드 중...',
    '각 슬라이드에 어울리는 고품질 디자인 배경을 그리는 중...',
    '캡션 및 해시태그를 포함한 피드 정보가 최종 취합되고 있습니다...'
  ]

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandId) {
      setError('연동된 브랜드가 없습니다. 브랜드 설정을 먼저 완료해 주세요.')
      return
    }

    setLoading(true)
    setError(null)
    setLoadingStep(0)

    // Rotate loading status messages
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 2500)

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brandId,
          productName,
          productDescription,
          keyBenefits,
          objective,
          slideCount,
          productImageUrls: [],
        }),
      })
      const res = await response.json() as GenerateCampaignResponse

      clearInterval(stepInterval)

      if (response.ok && res.campaignId) {
        router.push(`/campaign/${res.campaignId}`)
      } else {
        setError(res.error || '생성에 실패했습니다.')
        setLoading(false)
      }
    } catch (err: unknown) {
      clearInterval(stepInterval)
      setError(getErrorMessage(err, '알 수 없는 오류가 발생했습니다.'))
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white shadow-sm p-16 text-center space-y-8 flex flex-col items-center justify-center min-h-[500px] font-sans">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-t-[#ff4f00] border-r-[#e04500] border-b-slate-200 border-l-slate-200 animate-spin"></div>
          <Sparkles className="w-6 h-6 text-[#ff4f00] absolute top-1/2 left-1/2 translate-x-[-50%] translate-y-[-50%] animate-pulse" />
        </div>
        
        <div className="space-y-3 max-w-lg">
          <h2 className="text-xl font-black text-slate-900">AI 직원이 일하는 중...</h2>
          <p className="text-sm text-indigo-650 font-black h-6 transition-all duration-300">
            {steps[loadingStep]}
          </p>
          <p className="text-xs text-slate-400 font-semibold">
            기획안 및 DALL-E 이미지 생성이 완료되기까지 최대 15초가 소요될 수 있습니다. 창을 닫지 마세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 text-xs font-bold text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="border border-slate-200 rounded-xl bg-white shadow-sm p-8 space-y-6">
        {/* Brand Selector */}
        <div className="space-y-2">
          <label htmlFor="brandId" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            기획을 진행할 브랜드
          </label>
          <select
            id="brandId"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id} className="text-slate-900 bg-white">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Name */}
          <div className="space-y-2">
            <label htmlFor="productName" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              홍보 상품 / 서비스명
            </label>
            <input
              id="productName"
              type="text"
              required
              placeholder="예: 프리미엄 에티오피아 드립백, 1:1 맞춤형 퍼스널트레이닝 패키지"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
            />
          </div>

          {/* Objective Selector */}
          <div className="space-y-2">
            <label htmlFor="objective" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              카드뉴스 기획 목적
            </label>
            <select
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
            >
              <option value="정보 제공 및 가치 어필" className="text-slate-900 bg-white">정보 제공 및 구매 욕구 자극 (유익함 위주)</option>
              <option value="신규 프로모션 및 할인이벤트" className="text-slate-900 bg-white">신규 프로모션 및 혜택 홍보 (기간 한정)</option>
              <option value="고객 리뷰 소개 및 신뢰 제고" className="text-slate-900 bg-white">고객 실제 후기 소개 및 신뢰성 어필</option>
              <option value="브랜드 철학 및 스토리텔링" className="text-slate-900 bg-white">브랜드 철학 및 스토리텔링 (브랜딩 위주)</option>
            </select>
          </div>
        </div>

        {/* Product Description */}
        <div className="space-y-2">
          <label htmlFor="productDescription" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            상품 / 서비스 상세 설명
          </label>
          <textarea
            id="productDescription"
            required
            rows={4}
            placeholder="상품이 가진 기능, 디자인 특징, 탄생 배경 등 상세 정보를 자유롭게 적어주세요. 정보가 상세할수록 AI 직원이 더욱 뛰어난 훅(Hook) 카피를 작성합니다."
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
          />
        </div>

        {/* Key Benefits */}
        <div className="space-y-2">
          <label htmlFor="keyBenefits" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex justify-between">
            <span>핵심 세부 특징 / 고객 혜택 (쉼표로 구분)</span>
            <span className="text-[9px] text-slate-400 font-bold">3개 작성 추천</span>
          </label>
          <input
            id="keyBenefits"
            type="text"
            required
            placeholder="예: 1회당 15분 압축루틴, 체계적인 밀착 식단관리, 운동복 및 락커 무료 지원"
            value={keyBenefits}
            onChange={(e) => setKeyBenefits(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00] transition-all font-medium"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card News Slide Length */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              카드뉴스 장수 선택
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[5, 7, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSlideCount(num)}
                  className={`py-3 px-4 rounded-lg border text-sm font-extrabold transition-all cursor-pointer ${
                    slideCount === num
                      ? 'border-[#ff4f00] bg-[#ff4f00]/5 text-[#ff4f00] shadow-sm'
                      : 'border-slate-200 bg-slate-50/20 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <span className="block text-base">{num}장</span>
                  <span className={`text-[9px] font-medium block mt-1 ${slideCount === num ? 'text-[#ff4f00]/80' : 'text-slate-400'}`}>
                    {num === 5 ? '가벼운 훅' : num === 7 ? '정보 전달' : '심층 분석'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference Image Upload (Simulated for MVP) */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              참고 이미지 업로드 (선택)
            </label>
            <div className="border border-slate-200 border-dashed rounded-lg bg-slate-50/20 p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-all relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadedImageName(e.target.files[0].name)
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-800">
                {uploadedImageName || '클릭하여 파일 첨부'}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold mt-1">
                상품 사진이나 참고할 시안 레이아웃 첨부
              </span>
            </div>
          </div>
        </div>

        {/* Generate Trigger */}
        <div className="border-t border-slate-150 pt-6 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3.5 rounded-lg text-sm font-extrabold bg-[#ff4f00] hover:bg-[#e04500] text-white flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>AI 카드뉴스 기획 및 생성 시작</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
