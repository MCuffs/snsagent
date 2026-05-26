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
  Sparkle
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

function buildCardCopyContext(params: GenerateParams) {
  const lines = [
    `주제: ${params.topic}`,
    `콘텐츠 방향: ${params.contentType}`,
    `기획 목표: ${params.objective}`,
  ]

  if (params.hookDirection) lines.push(`훅 방향: ${params.hookDirection}`)
  if (params.brandAnalysis) lines.push(`브랜드 해석: ${params.brandAnalysis}`)
  if (params.recommendedCta) lines.push(`권장 행동: ${params.recommendedCta}`)
  if (params.structurePreview?.length) {
    lines.push('슬라이드별 기획 흐름:')
    params.structurePreview.forEach(slide => {
      lines.push(`${slide.slideNumber}. ${slide.role}: ${slide.description}`)
    })
  }

  return lines.join('\n')
}

// Custom smooth cubic bezier for high-end feel
const smoothTransition = { duration: 0.75, ease: [0.19, 1, 0.22, 1] as const }

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.8, 0.25, 1] as const
    }
  }
}

const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
}

const formItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as const
    }
  }
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
          keyContent: buildCardCopyContext(readyParams),
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
      <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#FFFDF9] via-[#FAF7F2] to-[#FAF8F5] px-6 py-16 text-[#2C1E1A] relative overflow-hidden">
        {/* Glow ambient background bubbles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E8DCCB]/20 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#C2A794]/15 blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={smoothTransition}
          className="w-full max-w-md bg-white/75 backdrop-blur-md border border-[#EFEAE2] rounded-3xl p-8 shadow-[0_12px_40px_rgba(158,125,104,0.06),_0_2px_4px_rgba(158,125,104,0.02)] text-center relative z-10"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="mb-6 flex justify-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#9E7D68]/10 to-[#C4A38E]/20 border border-[#9E7D68]/20 shadow-[0_8px_24px_rgba(158,125,104,0.06)]">
              <Sparkles className="h-6 w-6 text-[#9E7D68]" />
            </div>
          </motion.div>
          <h2 className="text-xl font-black tracking-[-0.03em] text-[#2C1E1A]">전략 카드뉴스 기획 빌드 중</h2>
          <p className="mt-3 text-sm text-[#8C7E7A] font-semibold leading-6 min-h-[48px] px-2">{LOADING_STEPS[loadingStep]}</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#F2EAE1]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#C29B84] to-[#9E7D68]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 3.5, ease: 'easeInOut' }}
            />
          </div>
          <p className="mt-4 text-xs text-[#C2B5AA] font-bold">잠시만 기다려주세요 (약 1분 소요)</p>
        </motion.div>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <motion.div
      variants={formContainerVariants}
      initial="hidden"
      animate="visible"
      className="flex h-full overflow-hidden bg-gradient-to-br from-[#FCFBF9] via-[#FAF7F2] to-[#FAF5EE]"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5DDD3;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #C4BCAE;
        }
      ` }} />

      {/* Chat panel */}
      <motion.div
        variants={formItemVariants}
        className="flex min-w-0 flex-1 flex-col bg-[#FFFDFB]/80 backdrop-blur-sm border-r border-[#EFEAE2]"
      >
        {/* Brand chip */}
        <div className="shrink-0 border-b border-[#EFEAE2] px-5 py-3.5 bg-[#FCFBF9]/60">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5DDD3] bg-white px-3 py-1.5 text-xs font-bold text-[#5C4E4B] shadow-[0_2px_8px_rgba(158,125,104,0.04)]">
            <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: brand.mainColor || '#9E7D68' }} />
            {brand.name}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 custom-scrollbar">
          {/* Initial loading skeleton */}
          {displayMessages.length === 0 && isWaiting && (
            <div className="flex justify-start">
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#FDFBF7] border border-[#E6DFD5] px-4 py-2.5 shadow-[0_4px_18px_rgba(212,197,185,0.08)]">
                  <div className="flex gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={smoothTransition}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[85%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">
                      S
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 font-medium whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-gradient-to-br from-[#6B5D57] to-[#5C4E4B] text-white shadow-[0_4px_16px_rgba(94,82,77,0.12)]'
                        : 'rounded-tl-sm bg-[#FDFBF7] text-[#2C1E1A] border border-[#E6DFD5] shadow-[0_4px_18px_rgba(212,197,185,0.08)]'
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
              transition={smoothTransition}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-2.5 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#9E7D68] to-[#C4A38E] text-[10px] font-black text-white shadow-sm ring-1 ring-white/20">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#FDFBF7] px-4 py-3 border border-[#E6DFD5] shadow-[0_4px_18px_rgba(212,197,185,0.08)]">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#C4A38E]" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Confirm CTA */}
          {readyParams && !isWaiting && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.15 }}
              className="flex justify-start pt-2"
            >
              <div className="flex flex-col gap-3.5 w-full max-w-md">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-750">
                    {error}
                  </div>
                )}
                <div className="rounded-2xl border border-[#E6DFD5] bg-[#FFFDFB] p-4.5 space-y-3.5 shadow-[0_6px_24px_rgba(158,125,104,0.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#2C1E1A]">실제 상품 이미지 첨부</p>
                      <p className="text-[10px] text-[#8C7E7A] mt-0.5 font-semibold">AI 배경에 합성할 제품 컷 (선택, 최대 4장)</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#2C1E1A] transition-all hover:border-[#9E7D68] hover:bg-[#FFFDFB] shadow-sm active:scale-98">
                      <ImagePlus className="h-3.5 w-3.5 text-[#9E7D68]" />
                      파일 선택
                      <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                    </label>
                  </div>
                  {referenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {referenceFiles.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-[#5C4E4B] bg-[#FDFBF7] border border-[#EBE2D9] rounded-xl px-3 py-1.5 shadow-sm">
                          <span className="truncate font-bold">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setReferenceFiles(current => current.filter(item => item !== file))}
                            className="rounded-full p-1 text-[#8C7E7A] hover:bg-[#EBE2D9]/50 transition-colors"
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
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#9E7D68] to-[#8C6B56] hover:to-[#7E5E4A] py-4 text-sm font-black text-white transition-all hover:shadow-[0_8px_24px_rgba(158,125,104,0.25)] active:scale-[0.99]"
                >
                  <Sparkles className="h-4 w-4 text-[#FFFDF8]" />
                  이 기획안으로 카드뉴스 생성 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[#EFEAE2] bg-[#FCFBF9]/80 backdrop-blur-md px-4 py-3.5">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={readyParams ? "피드백을 적어 상세 기획을 조율해보세요 (예: 글자 크기 살짝 줄여서...)" : "소개할 상품명이나 홍보할 주제를 말씀해 주세요..."}
              disabled={isWaiting}
              className="h-12 flex-1 rounded-2xl border border-[#E6DFD5] bg-white px-4 text-sm text-[#2C1E1A] placeholder-[#C2B5AA] outline-none focus:border-[#9E7D68] focus:ring-2 focus:ring-[#9E7D68]/5 disabled:opacity-50 font-bold transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || isWaiting}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#9E7D68] to-[#8C6B56] text-white transition-all hover:to-[#7E5E4A] hover:shadow-[0_4px_12px_rgba(158,125,104,0.2)] disabled:opacity-30 active:scale-95 shadow-sm"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </motion.div>

      {/* AI Strategy Director Panel (hidden on mobile) */}
      <motion.div
        variants={formItemVariants}
        className="hidden w-[390px] shrink-0 flex-col bg-gradient-to-b from-[#FCFBF9] to-[#F5F1E9] text-[#2C1E1A] border-l border-[#EFEAE2] overflow-y-auto xl:flex custom-scrollbar"
      >
        <div className="border-b border-[#EFEAE2] px-5 py-5 bg-[#FCFBF9]/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#B88E76] flex items-center gap-1">
                <Sparkle className="h-3 w-3 fill-current" /> AI Content Director
              </p>
              <h3 className="mt-1 text-base font-black tracking-tight text-[#2C1E1A]">전략 기획 브리핑</h3>
            </div>
            {readyParams ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#EDF7F2] px-2.5 py-1 text-[10px] font-bold text-[#2F7E53] border border-[#C6EBCE]/50 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F7E53] animate-pulse" />
                기획 완료
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-[#FEF6EE] px-2.5 py-1 text-[10px] font-bold text-[#C27330] border border-[#FAD8BC]/50 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C27330] animate-pulse" />
                대기 중
              </span>
            )}
          </div>
        </div>

        {readyParams ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex-1 px-5 py-6 space-y-6"
          >
            {/* 1. Core Summary Card */}
            <motion.div 
              variants={itemVariants}
              className="rounded-2xl border border-[#EFEAE2] bg-white/80 backdrop-blur-sm p-4.5 space-y-3.5 shadow-[0_4px_20px_rgba(158,125,104,0.03)]"
            >
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">홍보 주제</span>
                <span className="text-xs font-black text-[#2C1E1A] truncate max-w-[200px]">{readyParams.topic}</span>
              </div>
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">비주얼 스타일</span>
                <span className="rounded bg-[#9E7D68]/10 border border-[#9E7D68]/20 px-2 py-0.5 text-[10px] font-black text-[#9E7D68]">
                  {readyParams.visualHint}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#F5EFE6] pb-2.5">
                <span className="text-[11px] text-[#8C7E7A] font-bold">콘텐츠 구성 목적</span>
                <span className="text-xs font-bold text-[#5C4E4B]">{readyParams.contentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px] text-[#8C7E7A] font-bold">슬라이드 분량</span>
                <span className="text-xs font-bold text-[#5C4E4B]">{readyParams.slideCount}장 구성</span>
              </div>
            </motion.div>

            {/* 2. Reasoning Cards */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#B88E76]" /> AI 전략분석 및 추론
              </h4>

              {readyParams.brandAnalysis && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#8C7E7A]">브랜드 감성 분석 결과</span>
                  <p className="text-xs leading-5 text-[#5C4E4B] bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-3.5 font-medium shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                    {readyParams.brandAnalysis}
                  </p>
                </div>
              )}

              {readyParams.targetEmotion && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-3 shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                    <span className="block text-[9px] font-bold text-[#A69282] mb-1">타겟 자극 감정</span>
                    <span className="text-xs font-black text-[#C68D6A]">{readyParams.targetEmotion}</span>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-3 shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                    <span className="block text-[9px] font-bold text-[#A69282] mb-1">예상 퍼포먼스</span>
                    <span className="text-xs font-black text-[#5C4E4B] truncate block">{readyParams.expectedGoal || '브랜드 확장'}</span>
                  </div>
                </div>
              )}

              {readyParams.saveProbability && (
                <div className="bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-4 space-y-2.5 shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#5C4E4B] flex items-center gap-1">
                      <Bookmark className="h-3.5 w-3.5 text-[#B88E76]" /> 유저 저장 유도 확률
                    </span>
                    <span className="font-black text-[#C68D6A]">{readyParams.saveProbability}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#F2EAE1] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#E6B392] to-[#C89474] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: readyParams.saveProbability.includes('%') ? readyParams.saveProbability : '85%' }}
                      transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1], delay: 0.25 }}
                    />
                  </div>
                </div>
              )}

              {(readyParams.hookDirection || readyParams.recommendedCta) && (
                <div className="bg-white/80 backdrop-blur-sm border border-[#EFEAE2] rounded-2xl p-4 space-y-3 shadow-[0_4px_16px_rgba(158,125,104,0.02)]">
                  {readyParams.hookDirection && (
                    <div>
                      <span className="block text-[9px] font-bold text-[#A69282]">첫 장 카피(후크) 방향</span>
                      <p className="text-xs font-bold text-[#2C1E1A] mt-1 leading-5">{readyParams.hookDirection}</p>
                    </div>
                  )}
                  {readyParams.recommendedCta && (
                    <div className="border-t border-[#F5EFE6] pt-3">
                      <span className="block text-[9px] font-bold text-[#A69282]">추천 최종 유도(CTA)</span>
                      <p className="text-xs font-bold text-[#C68D6A] mt-1">{readyParams.recommendedCta}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* 3. Slide Flow Preview */}
            {readyParams.structurePreview && readyParams.structurePreview.length > 0 && (
              <motion.div variants={itemVariants} className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#A69282] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#B88E76]" /> 슬라이드 기획 프리뷰
                </h4>
                <div className="relative border-l border-dashed border-[#E5DDD3] pl-5 ml-2.5 space-y-5">
                  {readyParams.structurePreview.map((slide, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1], delay: idx * 0.08 + 0.3 }}
                      className="relative"
                    >
                      <span className="absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FAF8F5] border-2 border-[#9E7D68] text-[10px] font-black text-[#9E7D68] shadow-[0_2px_4px_rgba(158,125,104,0.1)]">
                        {slide.slideNumber}
                      </span>
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black tracking-wider uppercase text-[#B88E76]">{slide.role}</span>
                        <p className="text-xs font-semibold text-[#5C4E4B] leading-5">{slide.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-5 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#E8DCCB]/25 blur-[60px] pointer-events-none" />
            <motion.div 
              animate={{ 
                y: [0, -6, 0],
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[#E6DFD5] shadow-[0_8px_24px_rgba(158,125,104,0.06)]"
            >
              <Compass className="h-6 w-6 text-[#B88E76] animate-[spin_12s_linear_infinite]" />
            </motion.div>
            <div className="relative z-10 space-y-2">
              <p className="text-sm font-black text-[#2C1E1A]">AI 디렉터 기획 제안 대기 중</p>
              <p className="text-xs leading-5 text-[#8C7E7A] font-semibold max-w-[240px] mx-auto">
                홍보할 상품명 또는 제품 URL을 대화창에 남겨주시면 브랜드 취향과 마케팅 트렌드를 분석하여 최적의 전략안을 제안합니다.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-[#EFEAE2] px-5 py-4 bg-[#FCFBF9] text-center shrink-0">
          <p className="text-[10px] text-[#A69282] leading-relaxed font-semibold">
            Shuffla AI Content Strategy Engine v2.0
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
