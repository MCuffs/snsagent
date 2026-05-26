'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ImagePlus, Sparkles, Send, X } from 'lucide-react'

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
  productUrl?: string
}

const LOADING_STEPS = [
  'AI가 브랜드를 분석하고 카드뉴스 콘셉트를 도출하고 있습니다.',
  '슬라이드별 최적의 마케팅 카피라인을 기획하고 있습니다.',
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
      }
    } catch {
      setDisplayMessages(prev => [...prev, aiDisplay('서버 오류가 발생했습니다. 다시 시도해주세요.')])
    } finally {
      setIsWaiting(false)
      inputRef.current?.focus()
    }
  }, [brand.id])

  // Load the initial Agent greeting without synchronously mutating state in an effect.
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
      <div className="flex h-full flex-col items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center"
        >
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0066ff]/10">
              <Sparkles className="h-6 w-6 animate-pulse text-[#0066ff]" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#111111]">카드뉴스 생성 중</h2>
          <p className="mt-2 text-sm text-[#71717a]">{LOADING_STEPS[loadingStep]}</p>
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#e4e4e7]">
            <motion.div
              className="h-full bg-[#0066ff]"
              animate={{ width: `${((loadingStep + 1) / LOADING_STEPS.length) * 100}%` }}
              transition={{ duration: 3.5, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-3 text-xs text-[#a1a1aa]">보통 1~2분 소요됩니다</p>
        </motion.div>
      </div>
    )
  }

  // ── Main layout ─────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Brand chip */}
        <div className="shrink-0 border-b border-[#e4e4e7] px-5 py-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e4e4e7] bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#52525b]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.mainColor || '#0066ff' }} />
            {brand.name}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
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
                <div className={`flex max-w-[80%] flex-col gap-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">
                      S
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-[#111111] text-white'
                        : 'rounded-tl-sm bg-[#f4f4f5] text-[#111111]'
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
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">S</div>
                <div className="rounded-2xl rounded-tl-sm bg-[#f4f4f5] px-4 py-3">
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
              className="flex justify-start"
            >
              <div className="flex flex-col gap-3">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}
                <div className="rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[#52525b]">상품 참고 이미지 (선택, 최대 4장)</p>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#e4e4e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#111111] transition hover:border-[#0066ff]">
                      <ImagePlus className="h-3.5 w-3.5" />
                      선택
                      <input type="file" accept="image/*" multiple className="hidden" onChange={selectReferenceFiles} />
                    </label>
                  </div>
                  {referenceFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {referenceFiles.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-[#52525b]">
                          <span className="truncate">{file.name}</span>
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
                  className="flex items-center gap-2 rounded-full bg-[#0066ff] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0052cc]"
                >
                  <Sparkles className="h-4 w-4" />
                  카드뉴스 생성 시작
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-[#e4e4e7] bg-white px-4 py-3">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 여름 반팔 티셔츠 7장 다크로..."
              disabled={isWaiting}
              className="h-11 flex-1 rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/10 disabled:opacity-50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim() || isWaiting}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333333] disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Strategy Brief panel (hidden on mobile) */}
      <div className="hidden w-[340px] shrink-0 flex-col border-l border-[#e4e4e7] bg-[#fafafa] xl:flex">
        <div className="border-b border-[#e4e4e7] px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#a1a1aa]">Strategy Brief</p>
        </div>
        <div className="flex-1 px-5 py-6 space-y-5">
          <BriefRow label="브랜드" value={brand.name} always />
          <BriefRow label="상품" value={readyParams?.topic ?? ''} />
          <BriefRow label="목표" value={readyParams?.objective ?? ''} />
          <BriefRow label="콘텐츠" value={readyParams?.contentType ?? ''} />
          <BriefRow label="비주얼" value={readyParams?.visualHint ?? ''} />
          <BriefRow label="슬라이드" value={readyParams?.slideCount ? `${readyParams.slideCount}장` : ''} />
          <BriefRow label="참고 이미지" value={referenceFiles.length ? `${referenceFiles.length}장` : ''} />
          <BriefRow
            label="URL"
            value={
              readyParams?.productUrl
                ? (() => {
                    try {
                      return new URL(readyParams.productUrl.startsWith('http') ? readyParams.productUrl : `https://${readyParams.productUrl}`).hostname
                    } catch { return readyParams.productUrl }
                  })()
                : ''
            }
          />
        </div>
        <div className="border-t border-[#e4e4e7] px-5 py-4">
          <p className="text-[11px] leading-5 text-[#a1a1aa]">
            브랜드 DNA와 대화 내용을 바탕으로 카드뉴스 전략을 수립합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function BriefRow({ label, value, always }: { label: string; value: string; always?: boolean }) {
  const show = always || Boolean(value)
  return (
    <motion.div
      animate={{ opacity: show ? 1 : 0.3 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between gap-3"
    >
      <span className="shrink-0 text-[11px] font-semibold text-[#a1a1aa]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#111111] truncate max-w-[200px]">
        {value || '—'}
      </span>
    </motion.div>
  )
}
