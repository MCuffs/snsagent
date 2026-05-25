'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Globe, Loader2, Sparkles } from 'lucide-react'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
}

interface GenerateFormProps {
  brand: Brand
}

const STYLE_CARDS = [
  {
    id: 'dark-editorial',
    label: 'Dark Editorial',
    desc: '무게감 있는 에디토리얼',
    bg: '#111111',
    accent: '#ffffff',
  },
  {
    id: 'trend-feed',
    label: 'Trend Feed',
    desc: '인스타 트렌드 피드',
    bg: '#ff4757',
    accent: '#ffffff',
  },
  {
    id: 'community-style',
    label: 'Community',
    desc: '커뮤니티 감성',
    bg: '#5352ed',
    accent: '#ffffff',
  },
  {
    id: 'minimal-clean',
    label: 'Minimal Clean',
    desc: '깔끔한 미니멀',
    bg: '#f8f8f8',
    accent: '#111111',
  },
  {
    id: 'breaking-news',
    label: 'Breaking News',
    desc: '뉴스형 강렬한',
    bg: '#ffa502',
    accent: '#111111',
  },
]

const SLIDE_COUNTS = [5, 7, 10]

const loadingSteps = [
  'AI가 브랜드를 분석하고 카드뉴스 콘셉트를 도출하고 있습니다.',
  '슬라이드별 최적의 마케팅 카피라인을 기획하고 있습니다.',
  '이미지 모델용 비주얼 방향과 배경 프롬프트를 설계하고 있습니다.',
  '헤드라인을 분절하고 타이포그래피 레이아웃을 계산하고 있습니다.',
  '가독성, safe area, 모바일 저장성을 최종 검수하고 있습니다.',
]

export default function GenerateForm({ brand }: GenerateFormProps) {
  const router = useRouter()

  const [productUrl, setProductUrl] = useState('')
  const [style, setStyle] = useState('dark-editorial')
  const [direction, setDirection] = useState('')
  const [slideCount, setSlideCount] = useState(7)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (loading) {
      intervalRef.current = setInterval(() => {
        setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev))
      }, 4000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setLoadingStep(0)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [loading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productUrl) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType: 'media',
          brandId: brand.id,
          topic: direction || `${brand.industry} 신상품`,
          category: brand.industry,
          title: direction || `${brand.name} 카드뉴스`,
          keyContent: direction || `${brand.name}의 신상품을 소개합니다.`,
          tone: brand.toneOfVoice || '감성적이고 따뜻하게',
          contentType: '신상품 홍보',
          slideCount,
          productUrl: productUrl || undefined,
          visualHint: style,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || '생성에 실패했습니다.')
        return
      }

      router.push(`/campaign/${data.campaignId}`)
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0066ff]/10">
              <Sparkles className="h-6 w-6 text-[#0066ff] animate-pulse" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#111111]">카드뉴스 생성 중</h2>
          <p className="mt-2 text-sm text-[#71717a]">{loadingSteps[loadingStep]}</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#e4e4e7]">
            <div
              className="h-full bg-[#0066ff] transition-all duration-[3500ms] ease-out"
              style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-[#a1a1aa]">보통 1~2분 소요됩니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#52525b]">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: brand.mainColor || '#0066ff' }}
          />
          Using: {brand.name}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">카드뉴스 생성</h1>
        <p className="mt-1.5 text-sm text-[#52525b]">상품 페이지 URL과 스타일을 선택하면 AI가 카드뉴스를 만들어드립니다.</p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1 — Product URL */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 1 — 상품 페이지 URL</h2>
          <div className="relative">
            <Globe className="absolute left-3.5 top-3 h-4 w-4 text-[#a1a1aa]" />
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              required
              placeholder="https://smartstore.naver.com/..."
              className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white pl-10 pr-3 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
            />
          </div>
          <p className="mt-2 text-xs text-[#a1a1aa]">상품 상세 페이지를 입력하면 AI가 상품 정보를 자동으로 분석합니다.</p>
        </div>

        {/* Step 2 — Style */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 2 — 카드뉴스 스타일</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {STYLE_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setStyle(card.id)}
                className={`relative overflow-hidden rounded-xl border-2 p-0 transition-all ${
                  style === card.id
                    ? 'border-[#0066ff] ring-2 ring-[#0066ff]/20'
                    : 'border-[#e4e4e7] hover:border-[#a1a1aa]'
                }`}
              >
                <div
                  className="flex h-20 flex-col items-center justify-center"
                  style={{ backgroundColor: card.bg }}
                >
                  <span
                    className="text-[10px] font-bold tracking-wide"
                    style={{ color: card.accent }}
                  >
                    {card.label}
                  </span>
                </div>
                <div className="bg-white px-2 py-1.5">
                  <p className="text-[10px] leading-tight text-[#52525b]">{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 3 — Direction */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 3 — 방향 제시 (선택)</h2>
          <textarea
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="특별히 강조하고 싶은 내용이나 방향을 적어주세요. 예: 신학기 시즌, MZ 타겟, 가성비 강조"
            rows={3}
            className="w-full resize-none rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
          />
        </div>

        {/* Step 4 — Slide count */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 4 — 슬라이드 수</h2>
          <div className="flex gap-2">
            {SLIDE_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSlideCount(n)}
                className={`flex h-11 w-16 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
                  slideCount === n
                    ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff] ring-1 ring-[#0066ff]'
                    : 'border-[#e4e4e7] bg-white text-[#52525b] hover:border-[#a1a1aa]'
                }`}
              >
                {n}장
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-[#e4e4e7] pt-6">
          <button
            type="submit"
            disabled={!productUrl}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#111111] text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            카드뉴스 생성하기
          </button>
        </div>
      </form>
    </div>
  )
}
