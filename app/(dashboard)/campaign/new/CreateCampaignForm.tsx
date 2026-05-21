'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Sparkles } from 'lucide-react'

interface Brand {
  id: string
  name: string
}

interface GenerateCampaignResponse {
  campaignId?: string
  error?: string
}

const contentTypes = ['뉴스형 카드뉴스', '트렌드형 카드뉴스', '정보형 카드뉴스', '미디어형 카드뉴스']
const categories = ['AI 뉴스', '정치 이슈', '트렌드', '비즈니스', '라이프스타일', '데이터/통계', '커뮤니티 반응']
const tones = ['진지하고 몰입감 있게', '빠르고 트렌디하게', '차분하고 신뢰감 있게', '프리미엄 매거진처럼', '저장하고 싶게']
const loadingSteps = [
  '카드뉴스 스타일과 레이아웃을 선택하고 있습니다.',
  '이미지 모델용 비주얼 방향을 생성하고 있습니다.',
  '헤드라인을 분절하고 타이포그래피를 계산하고 있습니다.',
  '오버레이와 safe area를 적용해 슬라이드를 렌더링하고 있습니다.',
  '가독성, overflow, 모바일 저장성을 검수하고 있습니다.',
]

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function CreateCampaignForm({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [brandId, setBrandId] = useState(brands[0]?.id || '')
  const [contentType, setContentType] = useState(contentTypes[2])
  const [category, setCategory] = useState(categories[0])
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [keyContent, setKeyContent] = useState('')
  const [tone, setTone] = useState(tones[0])
  const [visualHint, setVisualHint] = useState('')
  const [source, setSource] = useState('')
  const [slideCount, setSlideCount] = useState(7)

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!brandId) {
      setError('사용할 브랜드가 없습니다. 브랜드 설정을 먼저 완료하세요.')
      return
    }

    setLoading(true)
    setError(null)
    setLoadingStep(0)

    const interval = window.setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, loadingSteps.length - 1))
    }, 2200)

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType: 'media',
          brandId,
          contentType,
          category,
          topic,
          title,
          keyContent,
          tone,
          visualHint,
          source,
          slideCount,
        }),
      })
      const result = await response.json() as GenerateCampaignResponse
      window.clearInterval(interval)

      if (response.ok && result.campaignId) {
        router.push(`/campaign/${result.campaignId}`)
        return
      }

      setError(result.error || '카드뉴스 생성에 실패했습니다.')
      setLoading(false)
    } catch (err) {
      window.clearInterval(interval)
      setError(getErrorMessage(err, '알 수 없는 오류가 발생했습니다.'))
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[10px] border border-[#e8dfd4] bg-white p-8 text-center shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
        <div className="relative mb-8">
          <div className="h-16 w-16 rounded-full border-2 border-[#e8dfd4] border-t-[#ff4f0a] animate-spin" />
          <Sparkles className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#ff4f0a]" />
        </div>
        <p className="eyebrow">Rendering Engine</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1f1512]">미디어 카드뉴스를 렌더링하는 중</h2>
        <p className="mt-5 min-h-6 text-sm font-black text-[#4a4039]">{loadingSteps[loadingStep]}</p>
        <p className="mt-2 max-w-md text-xs leading-5 text-[#746a62]">
          이미지 생성과 타이포그래피 합성, 품질 검사를 분리해 처리합니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-[10px] border border-[#e8dfd4] bg-white p-6 shadow-[0_24px_70px_rgba(31,21,18,0.07)] md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Select label="브랜드" value={brandId} onChange={setBrandId} options={brands.map(brand => ({ label: brand.name, value: brand.id }))} />
          <Select label="콘텐츠 타입" value={contentType} onChange={setContentType} options={contentTypes.map(item => ({ label: item, value: item }))} />
          <Select label="카테고리" value={category} onChange={setCategory} options={categories.map(item => ({ label: item, value: item }))} />
          <Select label="분위기" value={tone} onChange={setTone} options={tones.map(item => ({ label: item, value: item }))} />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="주제" value={topic} onChange={setTopic} placeholder="예: 젠슨 황의 AI 발언이 던진 의미" required />
          <Field label="제목" value={title} onChange={setTitle} placeholder="예: 젠슨 황, 왜 고통을 말했나" required />
        </div>

        <div className="mt-6">
          <label htmlFor="keyContent" className="mb-2 block text-xs font-black text-[#4a4039]">
            핵심 내용
          </label>
          <textarea
            id="keyContent"
            required
            rows={7}
            placeholder="카드뉴스에 담을 핵심 맥락을 적어주세요. 문장이나 bullet을 여러 개 넣으면 장별 구조로 나눕니다."
            value={keyContent}
            onChange={(event) => setKeyContent(event.target.value)}
            className="field resize-none px-4 py-3 text-base"
          />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Field label="비주얼 힌트" value={visualHint} onChange={setVisualHint} placeholder="예: 어두운 무대 조명, 인물은 우측" />
          <Field label="출처/브랜드 표시" value={source} onChange={setSource} placeholder="예: InstaAgent Research" />
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-black text-[#4a4039]">슬라이드 수</p>
          <div className="grid grid-cols-3 gap-3">
            {[5, 7, 10].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSlideCount(count)}
                className={`h-16 rounded-[8px] border text-sm font-black transition ${
                  slideCount === count
                    ? 'border-[#ff4f0a] bg-[#ff4f0a] text-white shadow-[0_14px_28px_rgba(255,79,10,0.18)]'
                    : 'border-[#e8dfd4] bg-[#fffdf8] text-[#746a62] hover:border-[#ffb08a]'
                }`}
              >
                {count}장
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-end border-t border-[#f0e7dc] pt-6">
          <button type="submit" className="btn-primary px-7">
            <Loader2 className="hidden h-4 w-4" />
            <Sparkles className="h-4 w-4" />
            미디어 카드뉴스 생성
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
}) {
  const id = label.replace(/\s+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-black text-[#4a4039]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field h-12 px-4 text-base"
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
}) {
  const id = label.replace(/\s+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-black text-[#4a4039]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field h-12 px-4 text-base"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
