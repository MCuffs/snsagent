'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Sparkles, Sliders, Wand2, ImagePlus, X } from 'lucide-react'
import { recommendCampaignAction } from '../../../../app/actions'

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

interface GenerateCampaignResponse {
  campaignId?: string
  error?: string
}

interface UploadPreview {
  file: File
  previewUrl: string
  uploadedUrl?: string
  uploading: boolean
  error?: string
}

const contentTypes = ['신상품 홍보', '베스트셀러 추천', '고객 리얼 리뷰', '브랜드 스토리', '세일/이벤트 안내', '꿀팁/큐레이션']
const categories = ['패션/의류', '뷰티/화장품', '리빙/인테리어', '푸드/식품', '디지털/가전', '라이프스타일', '반려동물', '기타']
const tones = ['감성적이고 따뜻하게', '시크하고 고급스럽게', '톡톡 튀고 트렌디하게', '정보가 쏙쏙 들어오게', '신뢰감 있고 전문적이게']
const loadingSteps = [
  'AI가 브랜드를 분석하고 카드뉴스 콘셉트를 도출하고 있습니다.',
  '슬라이드별 최적의 마케팅 카피라인을 기획하고 있습니다.',
  '이미지 모델용 비주얼 방향과 배경 프롬프트를 설계하고 있습니다.',
  '헤드라인을 분절하고 타이포그래피 레이아웃을 계산하고 있습니다.',
  '가독성, safe area, 모바일 저장성을 최종 검수하고 있습니다.',
]

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function CreateCampaignForm({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'easy' | 'professional'>('easy')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Glow effect state for AI auto-fill
  const [showGlow, setShowGlow] = useState(false)

  const [brandId, setBrandId] = useState(brands[0]?.id || '')
  const [contentType, setContentType] = useState(contentTypes[0])
  const [category, setCategory] = useState(categories[0])
  const [topic, setTopic] = useState('')
  const [title, setTitle] = useState('')
  const [keyContent, setKeyContent] = useState('')
  const [tone, setTone] = useState(tones[0])
  const [visualHint, setVisualHint] = useState('')
  const [source, setSource] = useState('')
  const [slideCount, setSlideCount] = useState(7)
  const selectedBrand = brands.find(brand => brand.id === brandId) || brands[0]

  // Easy mode extra context
  const [targetCustomer, setTargetCustomer] = useState('')
  const [keyMessage, setKeyMessage] = useState('')
  const [productFeature, setProductFeature] = useState('')

  // Reference image upload
  const [imagePreviews, setImagePreviews] = useState<UploadPreview[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle reference image file selection — generate local previews, then upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    const newPreviews: UploadPreview[] = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    }))
    setImagePreviews(prev => [...prev, ...newPreviews])

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json() as { urls?: string[]; error?: string }

      if (!res.ok || !data.urls) {
        setImagePreviews(prev =>
          prev.map((p, i) => i >= prev.length - files.length
            ? { ...p, uploading: false, error: data.error || '업로드 실패' }
            : p
          )
        )
        return
      }

      setImagePreviews(prev => {
        const updated = [...prev]
        data.urls!.forEach((url, idx) => {
          const targetIdx = updated.length - files.length + idx
          if (updated[targetIdx]) {
            updated[targetIdx] = { ...updated[targetIdx], uploading: false, uploadedUrl: url }
          }
        })
        return updated
      })
    } catch {
      setImagePreviews(prev =>
        prev.map((p, i) => i >= prev.length - files.length
          ? { ...p, uploading: false, error: '업로드 오류' }
          : p
        )
      )
    }

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    setImagePreviews(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].previewUrl)
      updated.splice(index, 1)
      return updated
    })
  }

  // Build enriched topic string for recommendCampaignAction
  const buildEnrichedTopic = () => {
    const extras = [
      targetCustomer ? `타겟 고객: ${targetCustomer}` : '',
      keyMessage ? `핵심 메시지: ${keyMessage}` : '',
      productFeature ? `상품/서비스 특징: ${productFeature}` : '',
    ].filter(Boolean)
    if (!extras.length) return topic
    return `${topic}\n\n추가 컨텍스트:\n${extras.join('\n')}`
  }

  // Smart Fill logic for Professional Mode
  const handleSmartFill = async () => {
    if (!brandId) {
      setError('브랜드를 먼저 선택해 주세요.')
      return
    }
    if (!topic || topic.trim().length === 0) {
      setError('주제(Topic)를 입력해 주세요. 예: 신상품 리넨 원피스 출시')
      return
    }

    setRecommendLoading(true)
    setError(null)

    try {
      const res = await recommendCampaignAction(brandId, topic)
      if (res.success) {
        if (res.recommendation) {
          const rec = res.recommendation
          setContentType(rec.contentType)
          setCategory(rec.category)
          setTone(rec.tone)
          setTitle(rec.title)
          setKeyContent(rec.keyContent)
          setVisualHint(rec.visualHint)
          setSource(rec.source)
          setSlideCount(rec.slideCount)
          
          // Trigger visual glow effect
          setShowGlow(true)
          setTimeout(() => setShowGlow(false), 2000)
        } else {
          setError('AI 스마트 기획 추천 데이터가 올바르지 않습니다.')
        }
      } else {
        setError(res.error || 'AI 스마트 기획 추천에 실패했습니다.')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'AI 스마트 기획 호출 중 오류가 발생했습니다.'))
    } finally {
      setRecommendLoading(false)
    }
  }

  // Submit handler (supports both modes)
  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!brandId) {
      setError('사용할 브랜드가 없습니다. 브랜드 설정을 먼저 완료하세요.')
      return
    }
    if (!topic || topic.trim().length === 0) {
      setError('카드뉴스 주제를 입력해 주세요.')
      return
    }

    setLoading(true)
    setError(null)
    setLoadingStep(0)

    const interval = window.setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, loadingSteps.length - 1))
    }, 2500)

    try {
      let finalPayload: {
      campaignType: string
      brandId: string
      contentType: string
      category: string
      topic: string
      title: string
      keyContent: string
      tone: string
      visualHint: string
      source: string
      slideCount: number
      productImageUrls?: string[]
    } = {
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
      }

      // In Easy Mode, fetch AI recommendations behind the scenes first
      if (activeTab === 'easy') {
        setLoadingStep(0) // Reset step text
        const enrichedTopic = buildEnrichedTopic()
        const recResult = await recommendCampaignAction(brandId, enrichedTopic)
        if (recResult.success) {
          if (recResult.recommendation) {
            const rec = recResult.recommendation
            const uploadedUrls = imagePreviews
              .filter(p => p.uploadedUrl)
              .map(p => p.uploadedUrl!)
            finalPayload = {
              campaignType: 'media',
              brandId,
              contentType: rec.contentType,
              category: rec.category,
              topic,
              title: rec.title,
              keyContent: rec.keyContent,
              tone: rec.tone,
              visualHint: rec.visualHint,
              source: rec.source,
              slideCount: rec.slideCount,
              productImageUrls: uploadedUrls,
            }
          } else {
            throw new Error('AI 자동 기획 추천 데이터가 올바르지 않습니다.')
          }
        } else {
          throw new Error(recResult.error || 'AI 자동 기획 추천에 실패했습니다. 상세 설정 모드로 전환하여 시도해 보세요.')
        }
      }

      // Trigger Media Generation API
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
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
      <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[12px] border border-[#e8dfd4] bg-white/70 backdrop-blur-md p-8 text-center shadow-[0_24px_70px_rgba(31,21,18,0.05)] transition-all duration-300">
        <div className="relative mb-8">
          <div className="h-16 w-16 rounded-full border-2 border-[#e8dfd4] border-t-[#ff4f0a] animate-spin" />
          <Sparkles className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#ff4f0a] animate-pulse" />
        </div>
        <p className="eyebrow text-[#ff4f0a] tracking-widest font-black uppercase">AI Agent Engine</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#1f1512]">초개인화 카드뉴스 자동 생성 중</h2>
        <div className="mt-5 min-h-[48px] max-w-lg">
          <p className="text-base font-bold text-[#3a2e2b]">{loadingSteps[loadingStep]}</p>
        </div>
        <p className="mt-3 text-xs text-[#746a62] leading-5">
          입력하신 브랜드 톤앤매너와 주제에 맞춘 디자인 및 카피 레이아웃을 정밀 렌더링하고 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[10px] border border-red-200 bg-red-50/80 backdrop-blur-xs px-4 py-3 text-sm font-bold text-red-800 shadow-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Modern Segmented Tab Switcher */}
      <div className="flex rounded-[10px] bg-[#f5efe6] p-1 shadow-inner border border-[#e8dfd4]/40">
        <button
          type="button"
          onClick={() => setActiveTab('easy')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black rounded-[8px] transition-all duration-300 ${
            activeTab === 'easy'
              ? 'bg-white text-[#ff4f0a] shadow-xs border border-[#e8dfd4]/20'
              : 'text-[#746a62] hover:text-[#1f1512]'
          }`}
        >
          <Wand2 className="h-4 w-4" />
          AI 초간편 생성 (Easy)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('professional')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black rounded-[8px] transition-all duration-300 ${
            activeTab === 'professional'
              ? 'bg-white text-[#ff4f0a] shadow-xs border border-[#e8dfd4]/20'
              : 'text-[#746a62] hover:text-[#1f1512]'
          }`}
        >
          <Sliders className="h-4 w-4" />
          프로 상세 설정 (Professional)
        </button>
      </div>

      <form onSubmit={onSubmit} className="rounded-[12px] border border-[#e8dfd4] bg-white p-6 shadow-[0_24px_70px_rgba(31,21,18,0.06)] md:p-8 transition-all duration-300">
        {/* TOPIC & BRAND - Common to both modes */}
        <div className="grid gap-6 md:grid-cols-2">
          <Select
            label="브랜드"
            value={brandId}
            onChange={setBrandId}
            options={brands.map(brand => ({ label: brand.name, value: brand.id }))}
          />
          <div>
            <label htmlFor="topic" className="mb-2 block text-xs font-black text-[#4a4039]">
              카드뉴스 주제 / 기획 아이디어
            </label>
            <div className="relative">
              <input
                id="topic"
                type="text"
                required
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="예: 올여름 린넨 원피스 출시 소식, 혹은 여름철 피부 홈케어 꿀팁"
                className={`field h-12 px-4 pr-32 text-base transition-all duration-300 ${
                  showGlow ? 'ring-2 ring-amber-500 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''
                }`}
              />
              {activeTab === 'professional' && (
                <button
                  type="button"
                  onClick={handleSmartFill}
                  disabled={recommendLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 items-center gap-1.5 rounded-[6px] bg-[#ff4f0a]/10 hover:bg-[#ff4f0a]/20 text-[#ff4f0a] px-2.5 text-xs font-black transition-all"
                  title="브랜드와 주제를 바탕으로 아래 폼을 AI가 자동 완성합니다."
                >
                  {recommendLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI 추천 채우기
                </button>
              )}
            </div>
          </div>
        </div>

        {selectedBrand && (
          <div className="mt-5 grid gap-3 rounded-[8px] border border-[#e8dfd4] bg-[#fffdf8] p-4 text-xs text-[#746a62] md:grid-cols-4">
            <BrandMeta label="업종" value={selectedBrand.industry} />
            <BrandMeta label="타깃" value={selectedBrand.targetAudience} />
            <BrandMeta label="톤" value={selectedBrand.toneOfVoice} />
            <BrandMeta label="CTA" value={selectedBrand.ctaStyle} />
          </div>
        )}

        {/* 1. EASY MODE VIEW */}
        {activeTab === 'easy' && (
          <div className="mt-6 space-y-6 border-t border-[#f0e7dc] pt-6">
            <div className="bg-[#fffdf8] border border-[#e8dfd4] rounded-[10px] p-5">
              <h4 className="text-sm font-black text-[#1f1512] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#ff4f0a]" />
                AI Agent 원클릭 생성 메커니즘
              </h4>
              <p className="mt-2 text-xs leading-5 text-[#746a62]">
                상단의 <strong>주제</strong> 한 줄만 입력하고 생성을 누르면, AI가 귀하의 <strong>브랜드 프로필({brands.find(b => b.id === brandId)?.name || '선택됨'})</strong>에 설정된 어조, 색상, 업종 가이드를 유기적으로 학습하여 다음을 백그라운드에서 자동 설계합니다:
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-[#4a4039] list-inside list-disc">
                <li>클릭률이 높은 인스타 전용 헤드라인 카피</li>
                <li>기승전결 구조의 슬라이드별 요약 내용</li>
                <li>브랜드 메인 컬러 기반의 배경 이미지 힌트</li>
                <li>콘텐츠의 성격에 적합한 최적의 톤앤매너</li>
              </ul>
            </div>

            {/* Context questions — optional but strongly improve output */}
            <div className="space-y-4">
              <p className="text-xs font-black text-[#4a4039]">
                컨텍스트 보강 <span className="font-normal text-[#a59b91]">(선택, 입력할수록 카드뉴스 품질이 높아집니다)</span>
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#746a62]">
                    주요 타겟 고객
                  </label>
                  <input
                    type="text"
                    value={targetCustomer}
                    onChange={e => setTargetCustomer(e.target.value)}
                    placeholder="예: 30대 직장여성, 피부 트러블 고민"
                    className="field h-11 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#746a62]">
                    핵심 전달 메시지
                  </label>
                  <input
                    type="text"
                    value={keyMessage}
                    onChange={e => setKeyMessage(e.target.value)}
                    placeholder="예: 일주일 안에 피부가 바뀝니다"
                    className="field h-11 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#746a62]">
                    상품/서비스 핵심 특징
                  </label>
                  <input
                    type="text"
                    value={productFeature}
                    onChange={e => setProductFeature(e.target.value)}
                    placeholder="예: 자연유래 성분 97%, 피부과 테스트"
                    className="field h-11 px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Reference image upload */}
            <div>
              <p className="mb-3 text-xs font-black text-[#4a4039]">
                참고 이미지 첨부{' '}
                <span className="font-normal text-[#a59b91]">(선택 — 배경 이미지 생성 시 비주얼 레퍼런스로 활용됩니다)</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div
                    key={index}
                    className="relative h-20 w-20 overflow-hidden rounded-[8px] border border-[#e8dfd4] bg-[#f5efe6]"
                  >
                    <Image
                      src={preview.previewUrl}
                      alt={`ref ${index + 1}`}
                      fill
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                    {preview.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {preview.error && (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-900/60">
                        <span className="text-[9px] text-white font-bold text-center px-1">오류</span>
                      </div>
                    )}
                    {!preview.uploading && !preview.error && (
                      <div className="absolute top-1 right-1 h-3 w-3 rounded-full bg-green-500 border border-white" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {imagePreviews.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[#e8dfd4] bg-[#fffdf8] text-[#a59b91] hover:border-[#ff4f0a] hover:text-[#ff4f0a] transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px] font-bold">이미지 추가</span>
                  </button>
                )}
              </div>
              {imagePreviews.length > 0 && (
                <p className="mt-2 text-[11px] text-[#a59b91]">
                  {imagePreviews.filter(p => p.uploadedUrl).length}/{imagePreviews.length}개 업로드 완료
                  {imagePreviews.some(p => p.uploading) ? ' — 업로드 중...' : ''}
                </p>
              )}
            </div>

            <div>
              <p className="mb-3 text-xs font-black text-[#4a4039]">슬라이드 장수 추천</p>
              <div className="grid grid-cols-3 gap-3">
                {[5, 7, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSlideCount(count)}
                    className={`h-16 rounded-[8px] border text-sm font-black transition ${
                      slideCount === count
                        ? 'border-[#ff4f0a] bg-[#ff4f0a] text-white shadow-[0_14px_28px_rgba(255,79,10,0.15)]'
                        : 'border-[#e8dfd4] bg-[#fffdf8] text-[#746a62] hover:border-[#ffb08a]'
                    }`}
                  >
                    {count}장 {count === 7 ? '(추천)' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. PROFESSIONAL MODE VIEW */}
        {activeTab === 'professional' && (
          <div className="mt-6 space-y-6 border-t border-[#f0e7dc] pt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Select
                label="콘텐츠 타입"
                value={contentType}
                onChange={setContentType}
                options={contentTypes.map(item => ({ label: item, value: item }))}
                glow={showGlow}
              />
              <Select
                label="카테고리"
                value={category}
                onChange={setCategory}
                options={categories.map(item => ({ label: item, value: item }))}
                glow={showGlow}
              />
              <Select
                label="분위기"
                value={tone}
                onChange={setTone}
                options={tones.map(item => ({ label: item, value: item }))}
                glow={showGlow}
              />
            </div>

            <div>
              <Field
                label="제목 (카피라이팅)"
                value={title}
                onChange={setTitle}
                placeholder="예: 올여름 필수템, 핏 예쁜 리넨 원피스"
                required
                glow={showGlow}
              />
            </div>

            <div>
              <label htmlFor="keyContent" className="mb-2 block text-xs font-black text-[#4a4039]">
                슬라이드별 핵심 내용 (줄바꿈이나 글머리 기호로 구분)
              </label>
              <textarea
                id="keyContent"
                required
                rows={7}
                placeholder="카드뉴스에 담을 핵심 맥락을 장별로 적어주세요. 문장이나 bullet을 여러 개 넣으면 장별 구조로 나눕니다."
                value={keyContent}
                onChange={(event) => setKeyContent(event.target.value)}
                className={`field resize-none px-4 py-3 text-base transition-all duration-500 ${
                  showGlow
                    ? 'ring-2 ring-amber-500 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-amber-50/20'
                    : 'border-[#e8dfd4]'
                }`}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Field
                label="비주얼 힌트 (배경 이미지용)"
                value={visualHint}
                onChange={setVisualHint}
                placeholder="예: 밝은 자연광이 비치는 화이트 톤 스튜디오, 리넨 패브릭 질감"
                glow={showGlow}
              />
              <Field
                label="출처/브랜드 표시"
                value={source}
                onChange={setSource}
                placeholder="예: 스토어 브랜드명 또는 웹사이트 주소"
                glow={showGlow}
              />
            </div>

            <div>
              <p className="mb-3 text-xs font-black text-[#4a4039]">슬라이드 수</p>
              <div className="grid grid-cols-3 gap-3">
                {[5, 7, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSlideCount(count)}
                    className={`h-16 rounded-[8px] border text-sm font-black transition-all duration-300 ${
                      slideCount === count
                        ? 'border-[#ff4f0a] bg-[#ff4f0a] text-white shadow-[0_14px_28px_rgba(255,79,10,0.18)]'
                        : 'border-[#e8dfd4] bg-[#fffdf8] text-[#746a62] hover:border-[#ffb08a]'
                    } ${showGlow ? 'ring-2 ring-amber-500 border-amber-500' : ''}`}
                  >
                    {count}장
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BUTTON SUBMIT */}
        <div className="mt-8 flex justify-end border-t border-[#f0e7dc] pt-6">
          <button type="submit" className="btn-primary px-8 flex items-center gap-2 group">
            <Sparkles className="h-4 w-4 text-white group-hover:scale-110 transition-transform animate-pulse" />
            <span>
              {activeTab === 'easy' ? 'AI 원클릭 카드뉴스 생성' : '카드뉴스 생성 및 렌더링'}
            </span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
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
  glow,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  required?: boolean
  glow?: boolean
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
        className={`field h-12 px-4 text-base transition-all duration-500 ${
          glow ? 'ring-2 ring-amber-500 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-amber-50/20' : 'border-[#e8dfd4]'
        }`}
      />
    </div>
  )
}

function BrandMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-black uppercase tracking-[0.12em] text-[#a59b91]">{label}</p>
      <p className="mt-1 truncate font-bold text-[#1f1512]" title={value}>
        {value || '-'}
      </p>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  glow,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  glow?: boolean
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
        className={`field h-12 px-4 text-base transition-all duration-500 ${
          glow ? 'ring-2 ring-amber-500 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-amber-50/20' : 'border-[#e8dfd4]'
        }`}
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
