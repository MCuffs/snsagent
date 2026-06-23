'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Loader2, AlertCircle, Send, Clapperboard, ImagePlus, X, Check, Clock, Sparkles, Film, ArrowRight, RotateCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor?: string
}

interface VideoSlide {
  slideNumber: number
  headline: string
  body: string
  role: string
  videoUrl: string | null
  durationSeconds: number
  error?: string | null
}

interface SlideProgress {
  slideNumber: number
  status: 'waiting' | 'generating' | 'done' | 'error'
  elapsed?: number
  error?: string
}

interface VideoCardNewsFormProps {
  brand: Brand
  hasApiKey?: boolean
}

interface UserChatMessage {
  id: string
  content: string
  images?: string[]
}

interface AiChatMessage {
  id: string
  type: 'clarify' | 'confirm' | 'progress' | 'result' | 'error'
  text?: string
  confirmInfo?: CollectedInfo
  stageLabel?: string
  slideProgress?: SlideProgress[]
  slides?: VideoSlide[]
  errorText?: string
  partialFailures?: number
  clarification?: ClarificationPrompt
}

interface ClarificationOption {
  label: string
  value: string
}

interface ClarificationPrompt {
  question: string
  options: ClarificationOption[]
  allowCustom?: boolean
  skipLabel?: string
}

// ── 대화형 흐름 상태 ──────────────────────────────────────────────

type ChatPhase = 'idle' | 'clarifying' | 'confirming' | 'generating' | 'done'

interface CollectedInfo {
  rawTopic: string
  targetAndMessage?: string  // 1차 답변 전체 (타겟 + 핵심 메시지)
  mood?: string              // 2차 답변 (분위기)
  refinedTopic: string       // API에 전송할 최종 topic
}

function buildRefinedTopic(info: Omit<CollectedInfo, 'refinedTopic'>): string {
  const parts = [info.rawTopic]
  if (info.targetAndMessage) parts.push(`독자와 메시지: ${info.targetAndMessage}`)
  if (info.mood) parts.push(`분위기: ${info.mood}`)
  return parts.join('\n')
}

// 각 단계별 사용자 친화적 안내 문구
const STAGE_LABELS: Record<string, string> = {
  copy_thinking: '✦ AI가 슬라이드 구성을 기획하고 있습니다...',
  copy_done_prefix: '✓ 카피 기획 완료 — ',
  video_start: '◎ 영상 생성을 시작합니다. 슬라이드당 약 1~2분 소요됩니다.',
  saving: '↑ 캠페인을 저장하고 있습니다...',
  redirect: '→ 편집 화면으로 이동합니다...',
}

const smoothEase = { duration: 0.7, ease: [0.19, 1, 0.22, 1] as const }
const fadeIn = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } }

export default function VideoCardNewsForm({ brand }: VideoCardNewsFormProps) {
  const router = useRouter()
  const locale = useLocale()
  const [topic, setTopic] = useState('')
  const [userMessages, setUserMessages] = useState<UserChatMessage[]>([])
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([])
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string }>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [slideCount, setSlideCount] = useState<3 | 5 | 7>(5)
  const [generating, setGenerating] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // 대화형 흐름 상태
  const [phase, setPhase] = useState<ChatPhase>('idle')
  const [collectedInfo, setCollectedInfo] = useState<Partial<CollectedInfo>>({})
  const [isWaiting, setIsWaiting] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const activeMsgIdRef = useRef<string | null>(null)

  const addImages = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    const newImages = imageFiles.slice(0, 3 - attachedImages.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setAttachedImages(prev => [...prev, ...newImages].slice(0, 3))
  }, [attachedImages.length])

  const removeImage = (index: number) => {
    setAttachedImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean) as File[]
      if (imageFiles.length > 0) addImages(imageFiles)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [addImages])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addImages(e.dataTransfer.files)
  }

  useEffect(() => {
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [aiMessages, generating, userMessages])

  const updateActiveMsg = (updater: (msg: AiChatMessage) => AiChatMessage) => {
    const id = activeMsgIdRef.current
    if (!id) return
    setAiMessages(prev => prev.map(m => m.id === id ? updater(m) : m))
  }

  // ── 실제 영상 생성 호출 ──────────────────────────────────────────

  const runGenerate = async (info: CollectedInfo) => {
    setPhase('generating')
    setGenerating(true)

    const msgId = `ai-gen-${Date.now()}`
    activeMsgIdRef.current = msgId
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: msgId,
        type: 'progress',
        stageLabel: STAGE_LABELS.copy_thinking,
        slideProgress: [],
      }])
    })
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000)

    try {
      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: info.rawTopic,
          targetAndMessage: info.targetAndMessage,
          mood: info.mood,
          brandId: brand.id,
          slideCount,
          durationSeconds: 5,
          domainLabel: brand.industry,
          brandTone: brand.toneOfVoice,
          language: 'ko',
        }),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        const text = await res.text()
        let errMsg = '서버 오류가 발생했습니다.'
        try {
          const data = JSON.parse(text) as { error?: string }
          if (data.error) errMsg = data.error
        } catch { /* ignore */ }
        updateActiveMsg(m => ({ ...m, type: 'error', errorText: errMsg }))
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processEvent = (eventName: string, rawData: string) => {
        let data: Record<string, unknown>
        try { data = JSON.parse(rawData) } catch { return }

        if (eventName === 'stage') {
          const stage = data.stage as string
          if (stage === 'research') {
            updateActiveMsg(m => ({ ...m, stageLabel: '✦ 최신 뉴스와 트렌드를 수집하는 중...' }))
          } else if (stage === 'saving') {
            updateActiveMsg(m => ({ ...m, stageLabel: STAGE_LABELS.saving }))
          } else if (stage === 'video') {
            updateActiveMsg(m => ({ ...m, stageLabel: STAGE_LABELS.video_start }))
          }
        } else if (eventName === 'copy_done') {
          const copySlides = (data.slides as Array<{ slideNumber: number; role: string; headline: string }>) ?? []
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `${STAGE_LABELS.copy_done_prefix}${copySlides.length}개 슬라이드`,
            slideProgress: copySlides.map(s => ({ slideNumber: s.slideNumber, status: 'waiting' as const })),
          }))
        } else if (eventName === 'slide_start') {
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `◎ 슬라이드 ${data.slideNumber}/${data.total} 영상 렌더링 중...`,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'generating' as const } : sp,
            ),
          }))
        } else if (eventName === 'slide_polling') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'generating' as const, elapsed: data.elapsed as number } : sp,
            ),
          }))
        } else if (eventName === 'slide_done') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'done' as const } : sp,
            ),
          }))
        } else if (eventName === 'slide_error') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber ? { ...sp, status: 'error' as const, error: data.error as string } : sp,
            ),
          }))
        } else if (eventName === 'done') {
          const resultSlides = (data.slides as VideoSlide[]) ?? []
          const campaignId = data.campaignId as string | undefined
          const successCount = resultSlides.filter(s => s.videoUrl).length
          updateActiveMsg(m => ({
            ...m,
            type: 'result',
            stageLabel: `✓ ${successCount}개 영상 완성 — 편집 화면으로 이동합니다`,
            slides: resultSlides,
            partialFailures: (data.partialFailures as number) ?? 0,
          }))
          if (campaignId) {
            setRedirecting(true)
            setPhase('done')
            const path = locale === 'en' ? `/en/campaign/${campaignId}` : `/ko/campaign/${campaignId}`
            setTimeout(() => router.push(path), 1400)
          }
        } else if (eventName === 'error') {
          updateActiveMsg(m => ({ ...m, type: 'error', errorText: data.error as string }))
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const eventMatch = part.match(/^event: (\S+)\ndata: ([\s\S]+)$/)
          if (eventMatch) processEvent(eventMatch[1], eventMatch[2])
        }
      }

    } catch (err) {
      clearTimeout(timeoutId)
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? '요청 시간이 초과되었습니다. 슬라이드 수를 줄이거나 다시 시도해주세요.' : err.message)
        : '서버 오류가 발생했습니다.'
      updateActiveMsg(m => ({ ...m, type: 'error', errorText: msg }))
    } finally {
      setGenerating(false)
      activeMsgIdRef.current = null
    }
  }

  const callAgent = async (userResponseContent: string) => {
    setIsWaiting(true)
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    
    for (let i = 0; i < userMessages.length; i++) {
      const u = userMessages[i]
      history.push({ role: 'user', content: u.content })
      
      const a = aiMessages[i]
      if (a && !a.id.startsWith('ai-temp-')) {
        if (a.type === 'clarify' && a.text) {
          history.push({ role: 'assistant', content: a.text })
        }
      }
    }
    history.push({ role: 'user', content: userResponseContent })

    try {
      const res = await fetch('/api/agents/video-cardnews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          brandId: brand.id,
          language: locale === 'en' ? 'en' : 'ko',
        }),
      })

      if (!res.ok) {
        throw new Error('API request failed')
      }

      const data = await res.json() as {
        message: string
        ready: boolean
        params?: {
          topic: string
          targetAndMessage?: string
          mood?: string
        }
        clarification?: ClarificationPrompt
      }

      setAiMessages(prev => {
        const next = [...prev]
        const tempIdx = next.findIndex(m => m.id.startsWith('ai-temp-'))
        const updatedMsg: AiChatMessage = data.ready && data.params
          ? {
              id: `ai-confirm-${Date.now()}`,
              type: 'confirm',
              text: data.message,
              confirmInfo: {
                rawTopic: data.params.topic,
                targetAndMessage: data.params.targetAndMessage,
                mood: data.params.mood,
                refinedTopic: buildRefinedTopic({
                  rawTopic: data.params.topic,
                  targetAndMessage: data.params.targetAndMessage ?? '',
                  mood: data.params.mood ?? '',
                })
              }
            }
          : {
              id: `ai-clarify-${Date.now()}`,
              type: 'clarify',
              text: data.message,
              clarification: data.clarification,
            }
        
        if (tempIdx !== -1) {
          next[tempIdx] = updatedMsg
        } else {
          next.push(updatedMsg)
        }
        return next
      })

      if (data.ready && data.params) {
        setCollectedInfo({
          rawTopic: data.params.topic,
          targetAndMessage: data.params.targetAndMessage,
          mood: data.params.mood,
          refinedTopic: buildRefinedTopic({
            rawTopic: data.params.topic,
            targetAndMessage: data.params.targetAndMessage ?? '',
            mood: data.params.mood ?? '',
          })
        })
        setPhase('confirming')
      } else {
        setPhase('clarifying')
      }

    } catch (err) {
      console.error(err)
      setAiMessages(prev => {
        const next = [...prev]
        const tempIdx = next.findIndex(m => m.id.startsWith('ai-temp-'))
        const errMsg: AiChatMessage = {
          id: `ai-err-${Date.now()}`,
          type: 'error',
          errorText: '디렉터와의 연결 중 오류가 발생했습니다. 다시 시도해 주세요.',
        }
        if (tempIdx !== -1) {
          next[tempIdx] = errMsg
        } else {
          next.push(errMsg)
        }
        return next
      })
    } finally {
      setIsWaiting(false)
    }
  }

  // ── 대화형 흐름 핸들러 ──────────────────────────────────────────

  const handleSend = async () => {
    const input = topic.trim()
    if ((!input && attachedImages.length === 0) || generating || isWaiting) return
    setTopic('')

    const imageUrls = attachedImages.map(img => img.preview)
    setAttachedImages([])

    // 유저 메시지 표시
    const userMsg: UserChatMessage = {
      id: `u-${Date.now()}`,
      content: input,
      images: imageUrls,
    }
    flushSync(() => setUserMessages(prev => [...prev, userMsg]))

    const tempAiId = `ai-temp-${Date.now()}`
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: tempAiId,
        type: 'progress',
        stageLabel: '✦ AI 디렉터가 입력 내용을 분석하고 있습니다...',
      }])
    })

    await callAgent(input)
  }

  const handleClarificationSelect = async (option: ClarificationOption) => {
    if (generating || isWaiting || phase === 'confirming') return
    const text = option.value
    const userLabel = option.label

    const userMsg: UserChatMessage = { id: `u-${Date.now()}`, content: userLabel }
    flushSync(() => {
      setUserMessages(prev => [...prev, userMsg])
    })

    const tempAiId = `ai-temp-${Date.now()}`
    flushSync(() => {
      setAiMessages(prev => [...prev, {
        id: tempAiId,
        type: 'progress',
        stageLabel: '✦ AI 디렉터가 선택하신 답변을 반영하고 있습니다...',
      }])
    })

    await callAgent(text)
  }

  const handleConfirmGenerate = () => {
    if (!collectedInfo.rawTopic) return
    flushSync(() => {
      setUserMessages(prev => [...prev, { id: `u-confirm-${Date.now()}`, content: '지금 만들기' }])
    })
    void runGenerate(collectedInfo as CollectedInfo)
  }

  const handleReset = () => {
    setPhase('idle')
    setCollectedInfo({})
    setUserMessages([])
    setAiMessages([])
    setTopic('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const inputDisabled = generating || isWaiting || phase === 'confirming' || phase === 'generating' || phase === 'done'
  const getPlaceholder = () => {
    if (phase === 'idle') return '영상 카드뉴스 주제를 입력하세요...'
    if (phase === 'clarifying') return 'AI 디렉터의 질문에 답해 주세요...'
    if (phase === 'confirming') return '[지금 만들기] 또는 [처음부터] 버튼을 눌러주세요'
    return '생성 중...'
  }

  // 편집 화면 전환 오버레이
  if (redirecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-col items-center justify-center bg-[#f7f7f7]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#e5e7eb]">
            <Film className="h-7 w-7 text-[#3b82f6]" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-bold text-[#111111]">영상 카드뉴스가 완성됐습니다</p>
            <p className="text-sm text-[#6b7280] flex items-center gap-2 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              편집 화면으로 이동하는 중...
            </p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#f7f7f7]">
      {/* Left: Chat */}
      <div className="flex min-w-0 flex-1 flex-col border-r border-[#e5e7eb] bg-[#f7f7f7]">

        {/* Header */}
        <div className="shrink-0 border-b border-[#e5e7eb] bg-[#f7f7f7] px-5 py-3 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <Clapperboard className="h-3.5 w-3.5" />
            영상 카드뉴스
            <span className="rounded-full bg-[#111827] px-1.5 py-0.5 text-[9px] font-black text-white tracking-wide">BETA</span>
          </div>
          <div className="flex items-center gap-3">
            {(phase !== 'idle' && phase !== 'generating' && phase !== 'done') && (
              <button type="button" onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-[#9ca3af] hover:text-[#6b7280] transition-colors">
                <RotateCcw className="h-3 w-3" />
                처음부터
              </button>
            )}
            <div className="text-xs text-[#9ca3af]">
              {brand.name}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">

          {/* Greeting */}
          <motion.div {...fadeIn} transition={{ ...smoothEase, delay: 0.05 }} className="flex justify-start">
            <div className="flex flex-col gap-2.5 items-start max-w-md">
              <AiBubbleAvatar />
              <div className="rounded-xl rounded-tl-sm bg-white px-4 py-3.5 text-sm leading-7 text-[#111111]">
                안녕하세요! <span className="font-bold">영상 카드뉴스</span>를 만들어드릴게요.
                <br /><br />
                어떤 주제로 만들고 싶으신가요?
                <br />
                <span className="text-[11px] text-[#9ca3af] font-semibold">✦ 슬라이드당 약 1~2분 · 9:16 세로 영상 · 텍스트 자동 합성</span>
              </div>
            </div>
          </motion.div>

          {/* Interleaved messages */}
          <AnimatePresence initial={false}>
            {userMessages.map((umsg, idx) => (
              <motion.div key={umsg.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={smoothEase} className="contents"
              >
                <div className="flex justify-end">
                  <div className="max-w-[78%] rounded-xl rounded-tr-sm bg-white px-4 py-3 text-sm font-medium leading-6 text-[#111111] whitespace-pre-wrap flex flex-col gap-2">
                    {umsg.images && umsg.images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {umsg.images.map((img, i) => (
                          <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {umsg.content && <div>{umsg.content}</div>}
                  </div>
                </div>
                {aiMessages[idx] && (
                  <AiMessage
                    msg={aiMessages[idx]}
                    onConfirmGenerate={handleConfirmGenerate}
                    onReset={handleReset}
                    onClarificationSelect={handleClarificationSelect}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={chatBottomRef} />
        </div>

        {/* Input bar */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="shrink-0 bg-[#f7f7f7] px-4 pb-5 pt-3 space-y-2.5"
        >
          {isDragging && (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#3b82f6] bg-[#eff6ff] py-3 text-sm font-medium text-[#3b82f6]">
              이미지를 여기에 놓으세요
            </div>
          )}

          {attachedImages.length > 0 && (
            <div className="flex gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Slide count selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9ca3af] font-semibold">슬라이드</span>
            {([3, 5, 7] as const).map(n => (
              <button
                key={n}
                type="button"
                disabled={generating || phase === 'generating'}
                onClick={() => setSlideCount(n)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  slideCount === n
                    ? 'bg-[#111111] text-white'
                    : 'bg-[#eeeeee] text-[#374151] hover:bg-[#e5e7eb]'
                } disabled:opacity-50`}
              >
                {n}장
              </button>
            ))}
          </div>

          <div className={`flex items-center gap-2 bg-white rounded-2xl border shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-3 py-2 ${isDragging ? 'border-[#3b82f6]' : 'border-[#e5e7eb]'}`}>
            <button type="button" disabled={generating || attachedImages.length >= 3}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#6b7280] transition-colors disabled:opacity-40">
              <ImagePlus className="h-4 w-4" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = '' }} />

            <textarea ref={inputRef} rows={2} value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={inputDisabled}
              className="flex-1 resize-none bg-transparent border-none outline-none px-2 py-1 text-sm text-[#111111] placeholder-[#9ca3af] disabled:opacity-50 transition-all" />

            <button type="button" onClick={handleSend} disabled={inputDisabled || (!topic.trim() && attachedImages.length === 0)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-white hover:bg-[#1f2937] disabled:opacity-30 transition-colors">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Script panel */}
      <ScriptPanel aiMessages={aiMessages} />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function AiBubbleAvatar() {
  return (
    <span className="text-[11px] font-semibold text-[#6b7280] tracking-wide">Shuffla</span>
  )
}

function AiMessage({
  msg,
  onConfirmGenerate,
  onReset,
  onClarificationSelect,
}: {
  msg: AiChatMessage
  onConfirmGenerate: () => void
  onReset: () => void
  onClarificationSelect?: (option: ClarificationOption) => void
}) {
  if (msg.type === 'clarify') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        className="flex justify-start"
      >
        <div className="flex flex-col gap-2.5 items-start max-w-md">
          <AiBubbleAvatar />
          <div className="rounded-xl rounded-tl-sm bg-white px-4 py-3.5 text-sm leading-7 text-[#111111] whitespace-pre-line flex flex-col gap-3 w-full">
            <div>{msg.text}</div>
            
            {msg.clarification && msg.clarification.options && onClarificationSelect && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f3f4f6]">
                {msg.clarification.options.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => onClarificationSelect(opt)}
                    className="rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-xs text-[#374151] hover:bg-[#f9fafb] hover:text-[#111111] transition-all active:scale-[0.98]"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  if (msg.type === 'confirm' && msg.confirmInfo) {
    const info = msg.confirmInfo
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
        className="flex justify-start"
      >
        <div className="flex flex-col gap-2.5 items-start max-w-sm w-full">
          <AiBubbleAvatar />
          <div className="rounded-xl rounded-tl-sm bg-white px-4 py-4 w-full space-y-4">
            <p className="text-sm font-bold text-[#111111]">완벽해요! 이렇게 만들게요.</p>

            <div className="space-y-2.5 text-sm">
              <div className="flex gap-2.5">
                <span className="text-base leading-5">📌</span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">주제</span>
                  <p className="text-[#111111] leading-5 mt-0.5">{info.rawTopic}</p>
                </div>
              </div>
              {info.targetAndMessage && (
                <div className="flex gap-2.5">
                  <span className="text-base leading-5">👥</span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">독자 & 메시지</span>
                    <p className="text-[#111111] leading-5 mt-0.5">{info.targetAndMessage}</p>
                  </div>
                </div>
              )}
              {info.mood && (
                <div className="flex gap-2.5">
                  <span className="text-base leading-5">🎬</span>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#9ca3af]">분위기</span>
                    <p className="text-[#111111] leading-5 mt-0.5">{info.mood}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1 border-t border-[#f3f4f6]">
              <button
                type="button"
                onClick={onConfirmGenerate}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#111827] py-2.5 text-sm font-semibold text-white hover:bg-[#1f2937] transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                지금 만들기
              </button>
              <button
                type="button"
                onClick={onReset}
                className="rounded-lg border border-[#e5e7eb] px-3 py-2.5 text-xs text-[#6b7280] hover:bg-[#f9fafb] transition-colors"
              >
                처음부터
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return <AiProgressMessage msg={msg} />
}

function AiProgressMessage({ msg }: { msg: AiChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className="flex justify-start"
    >
      <div className="flex flex-col gap-2.5 items-start max-w-sm w-full">
        <AiBubbleAvatar />

        {/* Error */}
        {msg.type === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3.5 text-sm text-red-700 max-w-md shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs mb-1">생성 중 오류가 발생했습니다</p>
              <p className="text-xs leading-5 text-red-600">{msg.errorText}</p>
              <p className="text-[10px] mt-2 text-red-400">잠시 후 다시 시도해주세요.</p>
            </div>
          </motion.div>
        )}

        {/* Progress / result */}
        {msg.type !== 'error' && msg.type !== 'clarify' && msg.type !== 'confirm' && (
          <div className="rounded-xl rounded-tl-sm bg-white px-4 py-3.5 w-full space-y-3">
            <div className="flex items-center gap-2">
              {msg.type === 'progress' && (
                <Loader2 className="h-3.5 w-3.5 text-[#3b82f6] animate-spin shrink-0" />
              )}
              {msg.type === 'result' && (
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              <span className={`text-xs font-semibold leading-5 ${
                msg.type === 'result' ? 'text-emerald-700' : 'text-[#111111]'
              }`}>
                {msg.stageLabel}
              </span>
            </div>

            {(msg.slideProgress?.length ?? 0) > 0 && (
              <div className="space-y-1.5 border-t border-[#e5e7eb] pt-2.5">
                {(msg.slideProgress ?? []).map(sp => (
                  <SlideProgressRow key={sp.slideNumber} sp={sp} />
                ))}
              </div>
            )}

            {msg.type === 'result' && msg.slides && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
                className="border-t border-[#e5e7eb] pt-2.5"
              >
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800">
                      {msg.slides.filter(s => s.videoUrl).length}개 영상 완성
                      {(msg.partialFailures ?? 0) > 0 && (
                        <span className="ml-1.5 text-orange-500">({msg.partialFailures}개 실패)</span>
                      )}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                      <ArrowRight className="h-2.5 w-2.5" />
                      편집 화면으로 이동 중...
                    </p>
                  </div>
                  <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin shrink-0" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function SlideProgressRow({ sp }: { sp: SlideProgress }) {
  const icons = {
    waiting: <div className="h-3 w-3 rounded-full border-2 border-[#d1d5db]" />,
    generating: <Loader2 className="h-3 w-3 text-[#3b82f6] animate-spin" />,
    done: <Check className="h-3 w-3 text-emerald-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-400" />,
  }[sp.status]

  const textColor = {
    waiting: 'text-[#9ca3af]',
    generating: 'text-[#3b82f6]',
    done: 'text-emerald-600',
    error: 'text-red-500',
  }[sp.status]

  const barWidth = {
    waiting: '0%',
    generating: sp.elapsed ? `${Math.min(95, (sp.elapsed / 90) * 100)}%` : '5%',
    done: '100%',
    error: '100%',
  }[sp.status]

  const barColor = {
    waiting: 'bg-[#e5e7eb]',
    generating: 'bg-[#3b82f6]',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }[sp.status]

  return (
    <div className={`space-y-1 text-[11px] ${textColor}`}>
      <div className="flex items-center gap-2">
        <div className="shrink-0">{icons}</div>
        <span className="font-semibold">슬라이드 {sp.slideNumber}</span>
        {sp.status === 'generating' && sp.elapsed !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#6b7280]">
            <Clock className="h-2.5 w-2.5" />{sp.elapsed}초
          </span>
        )}
        {sp.status === 'done' && <span className="ml-auto text-[10px] text-emerald-500 font-bold">완료</span>}
        {sp.status === 'error' && <span className="ml-auto text-[9px] text-red-400 truncate max-w-[140px]">{sp.error}</span>}
      </div>
      <div className="h-0.5 w-full rounded-full bg-[#e5e7eb] overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: '0%' }}
          animate={{ width: barWidth }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Script panel (right side) ────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  hook: 'HOOK',
  context: 'CONTEXT',
  'key-point': 'KEY POINT',
  detail: 'DETAIL',
  stat: 'STAT',
  summary: 'SUMMARY',
  'save-cta': 'CTA',
}

function ScriptPanel({ aiMessages }: { aiMessages: AiChatMessage[] }) {
  const latest = aiMessages.filter(m => m.type === 'progress' || m.type === 'result').pop()
  const slideProgress = latest?.slideProgress ?? []
  const resultSlides = latest?.slides

  return (
    <div className="hidden w-[340px] shrink-0 flex-col xl:flex bg-white border-l border-[#e5e7eb]">
      <div className="shrink-0 border-b border-[#e5e7eb] bg-white px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b7280] mb-1 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> 슬라이드 스크립트
        </p>
        <p className="text-sm font-bold text-[#111111]">AI 기획 내용</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        <AnimatePresence initial={false}>
          {slideProgress.length === 0 && !resultSlides && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-48 text-center gap-3"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f3f4f6] border border-[#e5e7eb] shadow-sm">
                <Film className="h-5 w-5 text-[#9ca3af]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#374151]">스크립트 미리보기</p>
                <p className="text-[11px] text-[#6b7280] mt-1">주제를 입력하면<br />슬라이드별 스크립트가 여기 나타납니다</p>
              </div>
            </motion.div>
          )}

          {slideProgress.length > 0 && !resultSlides && slideProgress.map((sp, i) => (
            <motion.div
              key={`sp-${sp.slideNumber}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className={`rounded-xl border p-3.5 transition-all ${
                sp.status === 'done' ? 'bg-emerald-50/60 border-emerald-100' :
                sp.status === 'generating' ? 'bg-white border-[#3b82f6] shadow-sm' :
                sp.status === 'error' ? 'bg-red-50/60 border-red-100' :
                'bg-white border-[#e5e7eb]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#f3f4f6] text-[10px] font-black text-[#374151]">
                  {sp.slideNumber}
                </span>
                {sp.status === 'generating' && <Loader2 className="h-3 w-3 text-[#3b82f6] animate-spin ml-auto" />}
                {sp.status === 'done' && <Check className="h-3 w-3 text-emerald-500 ml-auto" />}
                {sp.status === 'error' && <AlertCircle className="h-3 w-3 text-red-400 ml-auto" />}
              </div>
              <div className="text-[11px] text-[#6b7280]">
                {sp.status === 'waiting' && '영상 생성 대기 중'}
                {sp.status === 'generating' && `렌더링 중${sp.elapsed ? ` (${sp.elapsed}초)` : '...'}`}
                {sp.status === 'done' && '영상 완성'}
                {sp.status === 'error' && <span className="text-red-400 text-[10px]">{sp.error}</span>}
              </div>
            </motion.div>
          ))}

          {resultSlides && resultSlides.map((slide, i) => (
            <motion.div
              key={`slide-${slide.slideNumber}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={`rounded-xl border p-3.5 ${slide.videoUrl ? 'bg-white border-[#e5e7eb]' : 'bg-red-50/60 border-red-100 opacity-60'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#111827] text-[9px] font-black text-white">
                  {slide.slideNumber}
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#374151] bg-[#f3f4f6] rounded-full px-2 py-0.5">
                  {ROLE_LABEL[slide.role] ?? slide.role}
                </span>
                {slide.videoUrl
                  ? <Check className="h-3 w-3 text-emerald-500 ml-auto" />
                  : <AlertCircle className="h-3 w-3 text-red-400 ml-auto" />}
              </div>
              <p className="text-[12px] font-bold text-[#111111] leading-5 mb-1">{slide.headline}</p>
              <p className="text-[11px] text-[#6b7280] leading-relaxed">{slide.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
