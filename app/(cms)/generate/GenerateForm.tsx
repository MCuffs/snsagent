'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, 
  ImagePlus, 
  Sparkles, 
  Send, 
  X, 
  Bookmark, 
  Target, 
  Compass, 
  Layers, 
  HelpCircle 
} from 'lucide-react'


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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DisplayMessage {
  id: string
  role: 'ai' | 'user'
  content: string
}

interface GenerateParams {
  topic: string
  visualHint: string
  contentType: string
  objective: string
  slideCount: number
  productUrl?: string | null
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  expectedGoal?: string
  saveProbability?: string
  structurePreview?: { slideNumber: number; role: string; description: string }[]
}

const LOADING_STEPS = [
  'AI 콘텐츠 디렉터가 브랜드를 분석하고 카드뉴스 콘셉트를 도출하고 있습니다.',
  '슬라이드별 최적의 마케팅 카피라인과 톤을 조율하고 있습니다.',
  '이미지 모델용 비주얼 방향과 배경 프롬프트를 설계하고 있습니다.',
  '헤드라인을 분절하고 타이포그래피 레이아웃을 계산하고 있습니다.',
  '가독성, safe area, 모바일 저장성을 최종 검수하고 있습니다.',
]

let msgCounter = 0
function mkId() { return `m-${++msgCounter}` }

function aiDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'ai', content }
}

function userDisplay(content: string): DisplayMessage {
  return { id: mkId(), role: 'user', content }
}

export default function GenerateForm({ brand }: GenerateFormProps) {
  const router = useRouter()

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isWaiting, setIsWaiting] = useState(true)
  const [readyParams, setReadyParams] = useState<GenerateParams | null>(null)
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  useEffect(() => {
    if (!generating) return
    loadingIntervalRef.current = setInterval(() => {
      setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev))
    }, 4000)
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current) }
  }, [generating])

  const callAgent = useCallback(async (history: ChatMessage[]) => {
    setIsWaiting(true)
    try {
      const res = await fetch('/api/agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, brandId: brand.id }),
      })
      const data = await res.json() as { message?: string; ready?: boolean; params?: GenerateParams; error?: string }

      if (data.error) {
        setDisplayMessages(prev => [...prev, aiDisplay('오류가 발생했습니다. 다시 시도해주세요.')])
        return
      }

      const msg = data.message || '다시 시도해주세요.'
      setDisplayMessages(prev => [...prev, aiDisplay(msg)])

      const assistantHistory: ChatMessage = { role: 'assistant', content: msg }
      setChatHistory(prev => [...prev, assistantHistory])

      if (data.ready && data.params) {
        setReadyParams(data.params)
      } else {
        setReadyParams(null)
      }
    } catch {
      setDisplayMessages(prev => [...prev, aiDisplay('서버 오류가 발생했습니다. 다시 시도해주세요.')])
    } finally {
      setIsWaiting(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [brand.id])

  // Load the initial Agent greeting
  useEffect(() => {
    let active = true
    const loadGreeting = async () => {
      try {
        const res = await fetch('/api/agents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [], brandId: brand.id }),
        })
        const data = await res.json() as { message?: string; error?: string }
        if (!active) return
        const msg = data.error ? '오류가 발생했습니다. 다시 시도해주세요.' : (data.message || '다시 시도해주세요.')
        setDisplayMessages([aiDisplay(msg)])
        setChatHistory([{ role: 'assistant', content: msg }])
      } catch {
        if (active) setDisplayMessages([aiDisplay('서버 오류가 발생했습니다. 다시 시도해주세요.')])
      } finally {
        if (active) setIsWaiting(false)
      }
    }
    void loadGreeting()
    return () => { active = false }
  }, [brand.id])

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isWaiting) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newHistory = [...chatHistory, userMsg]

    setDisplayMessages(prev => [...prev, userDisplay(text)])
    setChatHistory(newHistory)
    setInput('')
    setReadyParams(null)

    await callAgent(newHistory)
  }

  const handleGenerate = async () => {
    if (!readyParams) return
    setLoadingStep(0)
    setGenerating(true)
    setError(null)

    try {
      let productImageUrls: string[] = []
      if (referenceFiles.length > 0) {
        const formData = new FormData()
        referenceFiles.forEach(file => formData.append('files', file))
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json() as { urls?: string[]; error?: string }
        if (!uploadRes.ok || !uploadData.urls?.length) {
          setError(uploadData.error || '참고 이미지 업로드에 실패했습니다.')
          setGenerating(false)
          return
        }
        productImageUrls = uploadData.urls
      }

      const res = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType: 'media',
          brandId: brand.id,
          topic: readyParams.topic,
          category: brand.industry,
          title: `${readyParams.topic} 카드뉴스`,
          keyContent: readyParams.topic,
          tone: brand.toneOfVoice || '감성적이고 따뜻하게',
          contentType: readyParams.contentType,
          slideCount: readyParams.slideCount,
          productUrl: readyParams.productUrl || undefined,
          visualHint: readyParams.visualHint,
          objective: readyParams.objective,
          productImageUrls,
        }),
      })

      const data = await res.json() as { campaignId?: string; error?: string }
      if (!res.ok || data.error) {
        setError(data.error || '생성에 실패했습니다.')
        setGenerating(false)
        return
      }

      router.push(`/campaign/${data.campaignId}`)
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
      setGenerating(false)
    }
  }

  const selectReferenceFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 4) {
      setError('참고 이미지는 최대 4장까지 선택할 수 있습니다.')
      return
    }
    setReferenceFiles(files)
    setError(null)
  }

  // ── Generating overlay ──────────────────────────────────────────
  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0c0d14] px-6 py-16 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0066ff]/20 border border-[#0066ff]/30 shadow-[0_0_15px_rgba(0,102,255,0.4)] animate-pulse">
              <Sparkles className="h-7 w-7 text-[#0066ff]" />
            </div>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">전략 카드뉴스 빌드 중</h2>
          <p className="mt-3 text-sm text-white/60 font-medium leading-6 min-h-[48px]">{LOADING_STEPS[loadingStep]}</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-[#0066ff] to-[#66a3ff]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 3.5, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-4 text-xs text-white/40 font-semibold">보통 1~2분 소요됩니다</p>
        </motion.div>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {/* Brand chip */}
        <div className="shrink-0 border-b border-[#e4e4e7] px-5 py-3.5 bg-[#fafafa]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-bold text-[#52525b]">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: brand.mainColor || '#0066ff' }} />
            {brand.name}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {/* Initial loading skeleton */}
          {displayMessages.length === 0 && isWaiting && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#f4f4f5] px-4 py-2.5">
                  <div className="flex gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white shadow-sm">
                      S
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 font-medium whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-[#111111] text-white'
                        : 'rounded-tl-sm bg-[#f4f4f5] text-[#111111] border border-[#e4e4e7]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* AI typing indicator */}
          {isWaiting && displayMessages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white shadow-sm">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#f4f4f5] px-4 py-3 border border-[#e4e4e7]">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a1a1aa]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Confirm CTA */}
          {readyParams && !isWaiting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="flex justify-start pt-2"
            >
              <div className="flex flex-col gap-3.5 w-full max-w-md">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700">
                    {error}
                  </div>
                )}
                <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#111111]">상품 이미지 업로드</p>
                      <p className="text-[10px] text-[#71717a] mt-0.5 font-medium">참고용 실제 상품 컷 (선택, 최대 4장)</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition hover:border-[#0066ff]">
                      <ImagePlus className="h-3.5 w-3.5" />
                      파일 선택
                      <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                    </label>
                  </div>
                  {referenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {referenceFiles.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-[#52525b] bg-white border border-[#e4e4e7] rounded-lg px-2.5 py-1">
                          <span className="truncate font-semibold">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setReferenceFiles(current => current.filter(item => item !== file))}
                            className="rounded p-1 text-[#71717a] hover:bg-[#e4e4e7]"
                            aria-label={`${file.name} 제거`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] py-3.5 text-sm font-black text-white transition hover:bg-[#0052cc] shadow-md active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  전략 기획안으로 카드뉴스 생성 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[#e4e4e7] bg-white px-4 py-3.5">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={readyParams ? "피드백을 입력해 기획을 조율하세요 (예: 슬라이드 5장으로 줄여줘)" : "상품 URL 또는 홍보할 핵심 제품 주제를 입력하세요..."}
              disabled={isWaiting}
              className="h-12 flex-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50 font-medium"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || isWaiting}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333333] disabled:opacity-30 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* AI Strategy Director Panel (hidden on mobile) */}
      <div className="hidden w-[380px] shrink-0 flex-col border-l border-[#1e2030] bg-[#0c0d14] text-white/90 overflow-y-auto xl:flex">
        <div className="border-b border-white/10 px-5 py-5 bg-[#0e101c]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0066ff]">AI Content Director</p>
              <h3 className="mt-1 text-base font-black tracking-tight text-white">전략 기획 브리핑</h3>
            </div>
            {readyParams ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                기획 완료
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black text-amber-400 border border-amber-500/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                대기 중
              </span>
            )}
          </div>
        </div>

        {readyParams ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 px-5 py-6 space-y-6"
          >
            {/* 1. Core Summary Card */}
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-3 shadow-md">
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-[11px] text-white/40 font-bold">주제</span>
                <span className="text-xs font-black text-[#66a3ff] truncate max-w-[200px]">{readyParams.topic}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-[11px] text-white/40 font-bold">비주얼 스타일</span>
                <span className="rounded bg-[#0066ff]/20 border border-[#0066ff]/30 px-1.5 py-0.5 text-[10px] font-black text-[#66a3ff]">
                  {readyParams.visualHint}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-[11px] text-white/40 font-bold">콘텐츠 형태</span>
                <span className="text-xs font-bold text-white/80">{readyParams.contentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-white/40 font-bold">슬라이드 수</span>
                <span className="text-xs font-bold text-white/80">{readyParams.slideCount}장</span>
              </div>
            </div>

            {/* 2. Reasoning Cards */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#0066ff]" /> AI 전략분석 및 추론
              </h4>

              {readyParams.brandAnalysis && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-white/40">브랜드 감성 분석</span>
                  <p className="text-xs leading-5 text-white/80 bg-white/[0.01] border border-white/5 rounded-lg p-2.5 font-medium">
                    {readyParams.brandAnalysis}
                  </p>
                </div>
              )}

              {readyParams.targetEmotion && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/[0.01] border border-white/5 rounded-lg p-2.5">
                    <span className="block text-[9px] font-bold text-white/40 mb-1">타겟 자극 감정</span>
                    <span className="text-xs font-black text-[#66a3ff]">{readyParams.targetEmotion}</span>
                  </div>
                  <div className="bg-white/[0.01] border border-white/5 rounded-lg p-2.5">
                    <span className="block text-[9px] font-bold text-white/40 mb-1">예상 퍼포먼스</span>
                    <span className="text-xs font-black text-white/80 truncate block">{readyParams.expectedGoal || '유입 극대화'}</span>
                  </div>
                </div>
              )}

              {readyParams.saveProbability && (
                <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white/80 flex items-center gap-1">
                      <Bookmark className="h-3.5 w-3.5 text-[#0066ff]" /> 인스타그램 저장 확률
                    </span>
                    <span className="font-black text-[#66a3ff]">{readyParams.saveProbability}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0066ff] to-[#66a3ff] rounded-full shadow-[0_0_8px_rgba(0,102,255,0.5)]"
                      style={{ width: readyParams.saveProbability.includes('%') ? readyParams.saveProbability : '85%' }}
                    />
                  </div>
                </div>
              )}

              {(readyParams.hookDirection || readyParams.recommendedCta) && (
                <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-2.5">
                  {readyParams.hookDirection && (
                    <div>
                      <span className="block text-[9px] font-bold text-white/40">후킹 핵심 메시지</span>
                      <p className="text-xs font-bold text-white/80 mt-0.5">{readyParams.hookDirection}</p>
                    </div>
                  )}
                  {readyParams.recommendedCta && (
                    <div className="border-t border-white/5 pt-2.5">
                      <span className="block text-[9px] font-bold text-white/40">추천 행동유도(CTA)</span>
                      <p className="text-xs font-bold text-[#66a3ff] mt-0.5">{readyParams.recommendedCta}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Slide Flow Preview */}
            {readyParams.structurePreview && readyParams.structurePreview.length > 0 && (
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#0066ff]" /> 카드뉴스 구조 프리뷰
                </h4>
                <div className="relative border-l border-white/10 pl-4 ml-2 space-y-5">
                  {readyParams.structurePreview.map((slide, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[23px] top-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#0066ff] text-[9px] font-black text-white shadow-[0_0_8px_rgba(0,102,255,0.4)]">
                        {slide.slideNumber}
                      </span>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black tracking-wide uppercase text-white/40">{slide.role}</span>
                        <p className="text-xs font-bold text-white/80 leading-5">{slide.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10">
              <Compass className="h-6 w-6 text-white/30 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
            <div>
              <p className="text-sm font-black text-white/80">AI 기획 디렉터 대기 중</p>
              <p className="mt-2 text-xs leading-5 text-white/40 font-medium max-w-[240px] mx-auto">
                소개할 상품명이나 URL을 입력창에 작성하시면, 브랜드 DNA에 알맞은 전략 보고서를 실시간으로 기획해 드립니다.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-white/5 px-5 py-4 bg-[#0a0b12] text-center">
          <p className="text-[10px] text-white/30 leading-relaxed font-semibold">
            Shuffla AI Content Strategy Engine v2.0
          </p>
        </div>
      </div>
    </div>
  )
}
