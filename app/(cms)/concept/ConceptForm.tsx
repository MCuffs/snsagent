'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Bot, CheckCircle2, Globe, Loader2, MessageCircle, Palette, Save, Send, Sparkles, X } from 'lucide-react'
import { analyzeBrandWebsiteAction, saveBrandAction } from '../../actions'
import { parseBrandDna, stringifyBrandDna } from '../../../lib/brand-dna'
import { motion, AnimatePresence } from 'framer-motion'

interface BrandData {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}

interface ConceptFormProps {
  existingBrand: BrandData | null
}

const VISUAL_MOODS = [
  { id: 'minimal', label: 'Minimal', desc: '깔끔하고 여백 중심' },
  { id: 'dark-editorial', label: 'Dark Editorial', desc: '무게감 있는 에디토리얼' },
  { id: 'warm-lifestyle', label: 'Warm Lifestyle', desc: '따뜻하고 감성적인' },
  { id: 'bold-commerce', label: 'Bold Commerce', desc: '강렬한 커머스 중심' },
  { id: 'clean-pro', label: 'Clean Professional', desc: '신뢰감 있는 전문적' },
]

const analyzeSteps = [
  '웹사이트 데이터 스크래핑 중...',
  '브랜드 주요 가치 및 정체성 분석 중...',
  '비주얼 테마 및 컬러 추출 중...',
  '브랜드 콘텐츠 가이드라인 생성 중...',
]

export default function ConceptForm({ existingBrand }: ConceptFormProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<'url' | 'profile'>(
    existingBrand?.websiteUrl ? 'profile' : 'url'
  )
  const [brandId, setBrandId] = useState(existingBrand?.id || null)

  // URL phase state
  const [url, setUrl] = useState(existingBrand?.websiteUrl || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState(0)

  // Profile fields
  const [name, setName] = useState(existingBrand?.name || '')
  const [industry, setIndustry] = useState(existingBrand?.industry || '')
  const [targetAudience, setTargetAudience] = useState(existingBrand?.targetAudience || '')
  const [toneOfVoice, setToneOfVoice] = useState(existingBrand?.toneOfVoice || '')
  const [mainColor, setMainColor] = useState(existingBrand?.mainColor || '#0066ff')
  const [forbiddenWords, setForbiddenWords] = useState(existingBrand?.forbiddenWords || '')
  const [ctaStyle, setCtaStyle] = useState(existingBrand?.ctaStyle || '')
  const [brandDna, setBrandDna] = useState(existingBrand?.brandDna || '')
  const [brandDescription, setBrandDescription] = useState(
    () => parseBrandDna(existingBrand?.brandDna).brandDescription
  )
  const [visualMood, setVisualMood] = useState('minimal')

  // Keep brandDescription in sync when brandDna changes externally (after analysis)
  const updateBrandDna = (newDna: string) => {
    setBrandDna(newDna)
    setBrandDescription(parseBrandDna(newDna).brandDescription)
  }

  const handleBrandDescriptionChange = (desc: string) => {
    setBrandDescription(desc)
    const parsed = parseBrandDna(brandDna)
    setBrandDna(stringifyBrandDna({ ...parsed, brandDescription: desc }))
  }

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // AI chat panel
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatWaiting, setChatWaiting] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'ai' | 'user'; content: string; id: string }>>([])
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalyzeStep((prev) => (prev < 3 ? prev + 1 : prev))
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [isAnalyzing])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleChatSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = chatInput.trim()
    if (!text || chatWaiting || !brandId) return

    const msgId = `cm-${Date.now()}`
    const userMsg = { role: 'user' as const, content: text }
    setChatMessages(prev => [...prev, { role: 'user', content: text, id: msgId }])
    setChatHistory(prev => [...prev, userMsg])
    setChatInput('')
    setChatWaiting(true)

    try {
      const newHistory = [...chatHistory, userMsg]
      const res = await fetch('/api/agents/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, brandId }),
      })
      const data = await res.json() as {
        message?: string
        updates?: {
          name?: string
          industry?: string
          targetAudience?: string
          toneOfVoice?: string
          mainColor?: string
          brandDescription?: string
        }
        error?: string
      }

      const aiText = data.message || '알 수 없는 오류가 발생했습니다.'
      setChatMessages(prev => [...prev, { role: 'ai', content: aiText, id: `cm-ai-${Date.now()}` }])
      setChatHistory(prev => [...prev, { role: 'assistant', content: aiText }])

      if (data.updates) {
        const u = data.updates
        if (u.name) setName(u.name)
        if (u.industry) setIndustry(u.industry)
        if (u.targetAudience) setTargetAudience(u.targetAudience)
        if (u.toneOfVoice) setToneOfVoice(u.toneOfVoice)
        if (u.mainColor) setMainColor(u.mainColor)
        if (u.brandDescription) handleBrandDescriptionChange(u.brandDescription)
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', content: '서버 오류가 발생했습니다.', id: `cm-err-${Date.now()}` }])
    } finally {
      setChatWaiting(false)
      chatInputRef.current?.focus()
    }
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url) return
    setIsAnalyzing(true)
    setAnalyzeStep(0)
    setError(null)

    try {
      const res = await analyzeBrandWebsiteAction(url)
      if (!res.success) {
        setError(res.error || 'AI 브랜드 분석에 실패했습니다.')
        setIsAnalyzing(false)
        return
      }
      if (res.brandProfile) {
        const p = res.brandProfile
        setName(p.name)
        setIndustry(p.industry)
        setTargetAudience(p.targetAudience)
        setToneOfVoice(p.toneOfVoice)
        setMainColor(p.mainColor)
        setForbiddenWords(p.forbiddenWords)
        setCtaStyle(p.ctaStyle)
        updateBrandDna(p.brandDna || '')

        // Auto-save brand
        const saved = await saveBrandAction(brandId, {
          name: p.name,
          industry: p.industry,
          targetAudience: p.targetAudience,
          toneOfVoice: p.toneOfVoice,
          mainColor: p.mainColor,
          forbiddenWords: p.forbiddenWords,
          ctaStyle: p.ctaStyle,
          brandDna: p.brandDna,
          websiteUrl: url,
        })
        if (saved.success) {
          setBrandId(saved.brand.id)
          setPhase('profile')
        } else {
          setError(saved.error || '저장 실패')
        }
      }
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await saveBrandAction(brandId, {
        name,
        industry,
        targetAudience,
        toneOfVoice,
        mainColor,
        forbiddenWords,
        ctaStyle,
        brandDna: brandDna || null,
        websiteUrl: url || null,
      })
      if (res.success) {
        setBrandId(res.brand.id)
        setSuccess('브랜드 프로필이 저장되었습니다.')
      } else {
        setError(res.error || '저장 실패')
      }
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── URL Phase ──────────────────────────────────────────────────
  if (phase === 'url') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Step 1 of 1</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#111111]">
              브랜드 스토어 URL을 입력하세요
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#52525b]">
              스마트스토어, 쇼핑몰, 브랜드 홈페이지 URL을 입력하면 AI가 브랜드 프로필을 자동으로 생성합니다.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a1a1aa]" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isAnalyzing}
                required
                placeholder="https://smartstore.naver.com/..."
                className="h-12 w-full rounded-lg border border-[#e4e4e7] bg-white pl-11 pr-4 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
              />
            </div>

            {isAnalyzing && (
              <div className="rounded-lg border border-[#e4e4e7] bg-[#fafafa] p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-[#0066ff]">{analyzeSteps[analyzeStep]}</span>
                  <span className="text-xs text-[#71717a]">{Math.round(((analyzeStep + 1) / 4) * 100)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#e4e4e7]">
                  <div
                    className="h-full bg-[#0066ff] transition-all duration-1000 ease-out"
                    style={{ width: `${((analyzeStep + 1) / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isAnalyzing || !url}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#111111] text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isAnalyzing ? '분석 중...' : 'AI로 브랜드 분석하기'}
            </button>
          </form>

          {existingBrand && (
            <button
              type="button"
              onClick={() => setPhase('profile')}
              className="mt-4 w-full text-center text-sm text-[#71717a] hover:text-[#111111] underline underline-offset-2"
            >
              기존 브랜드 프로필 수정하기 →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Profile Phase ──────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Main form */}
      <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#71717a]">Brand Concept</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111111]">브랜드 프로필</h1>
          <p className="mt-1.5 text-sm text-[#52525b]">모든 카드뉴스 생성의 기준이 되는 브랜드 정체성을 설정합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase('url')}
            className="flex items-center gap-1.5 rounded-md border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-medium text-[#52525b] hover:border-[#a1a1aa] transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            URL 재분석
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(prev => !prev)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              chatOpen
                ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff]'
                : 'border-[#e4e4e7] bg-white text-[#52525b] hover:border-[#a1a1aa]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            AI와 대화하기
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Store URL */}
        <Section title="스토어 URL">
          <div className="relative">
            <Globe className="absolute left-3.5 top-3 h-4 w-4 text-[#a1a1aa]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://smartstore.naver.com/..."
              className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white pl-10 pr-3 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
            />
          </div>
        </Section>

        {/* Basic Info */}
        <Section title="기본 정보">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="브랜드명" value={name} onChange={setName} placeholder="예: Mocha Studio" required />
            <Field label="업종 / 카테고리" value={industry} onChange={setIndustry} placeholder="예: 뷰티, 패션, 식품" required />
          </div>
          <div className="mt-4">
            <Field label="주요 고객" value={targetAudience} onChange={setTargetAudience} placeholder="예: 2030 직장인 여성" required />
          </div>
        </Section>

        {/* Brand Description */}
        <Section title="브랜드 설명">
          <label className="mb-1.5 block text-xs font-medium text-[#52525b]">Brand Description</label>
          <textarea
            value={brandDescription}
            onChange={(e) => handleBrandDescriptionChange(e.target.value)}
            placeholder="브랜드의 핵심 가치, 차별점, 스토리를 간략히 작성하세요."
            rows={4}
            className="w-full resize-none rounded-lg border border-[#e4e4e7] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
          />
        </Section>

        {/* Visual Identity */}
        <Section title="비주얼 아이덴티티">
          {/* Visual Mood */}
          <div className="mb-5">
            <label className="mb-2.5 block text-xs font-medium text-[#52525b]">비주얼 무드</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {VISUAL_MOODS.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  onClick={() => setVisualMood(mood.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    visualMood === mood.id
                      ? 'border-[#0066ff] bg-[#0066ff]/5 ring-1 ring-[#0066ff]'
                      : 'border-[#e4e4e7] bg-white hover:border-[#a1a1aa]'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#111111]">{mood.label}</p>
                  <p className="mt-0.5 text-[10px] text-[#71717a] leading-4">{mood.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Brand Color */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#52525b]">브랜드 컬러</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mainColor}
                  onChange={(e) => setMainColor(e.target.value)}
                  placeholder="#0066ff"
                  className="h-11 flex-1 rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
                />
                <input
                  type="color"
                  value={mainColor.startsWith('#') && mainColor.length === 7 ? mainColor : '#0066ff'}
                  onChange={(e) => setMainColor(e.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-lg border border-[#e4e4e7] p-1"
                  aria-label="컬러 선택"
                />
              </div>
            </div>

            {/* Tone */}
            <Field
              label="톤앤매너"
              value={toneOfVoice}
              onChange={setToneOfVoice}
              placeholder="예: 친근하고 명확한"
              required
            />
          </div>
        </Section>

        {/* CTA & Forbidden */}
        <Section title="콘텐츠 가이드">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="기본 CTA"
              value={ctaStyle}
              onChange={setCtaStyle}
              placeholder="예: 프로필 링크에서 구매하기"
            />
            <Field
              label="금칙어"
              value={forbiddenWords}
              onChange={setForbiddenWords}
              placeholder="쉼표로 구분, 예: 최저가, 100% 보장"
            />
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-[#e4e4e7] pt-6">
          <button
            type="submit"
            disabled={isSaving || !name}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장하기
          </button>
          {brandId && (
            <button
              type="button"
              onClick={() => router.push('/generate')}
              className="flex h-11 items-center gap-2 rounded-lg border border-[#e4e4e7] bg-white px-5 text-sm font-semibold text-[#111111] transition hover:border-[#a1a1aa] hover:bg-[#fafafa]"
            >
              카드뉴스 생성하기
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      </div>
      </div>

      {/* AI Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex shrink-0 flex-col border-l border-[#e4e4e7] bg-[#fafafa] overflow-hidden"
          >
            {/* Chat header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0066ff] text-[10px] font-bold text-white">S</div>
                <span className="text-xs font-semibold text-[#111111]">브랜드 프로필 AI</span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-[#a1a1aa] transition hover:bg-[#e4e4e7] hover:text-[#111111]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.length === 0 && !chatWaiting && (
                <div className="rounded-xl rounded-tl-sm bg-[#f0f0f0] px-3.5 py-2.5 text-sm leading-5.5 text-[#111111]">
                  안녕하세요! 브랜드에 대해 궁금한 점이나 수정하고 싶은 내용을 말씀해주세요. 대화를 통해 브랜드 프로필을 함께 완성해 드릴게요.
                </div>
              )}
              <AnimatePresence initial={false}>
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                        msg.role === 'user'
                          ? 'rounded-tr-sm bg-[#111111] text-white'
                          : 'rounded-tl-sm bg-[#f0f0f0] text-[#111111]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {chatWaiting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="rounded-xl rounded-tl-sm bg-[#f0f0f0] px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '120ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-[#e4e4e7] bg-white px-3 py-3">
              {!brandId && (
                <p className="mb-2 text-[11px] text-[#a1a1aa]">브랜드를 먼저 저장해야 AI와 대화할 수 있습니다.</p>
              )}
              <form onSubmit={handleChatSend} className="flex items-center gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatWaiting || !brandId}
                  placeholder={brandId ? '브랜드에 대해 말씀해주세요...' : '먼저 브랜드를 저장하세요'}
                  className="h-10 flex-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatWaiting || !brandId}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333333] disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#71717a]">{title}</h2>
      {children}
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
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#52525b]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-[#e4e4e7] bg-white px-3.5 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10"
      />
    </div>
  )
}
