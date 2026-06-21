'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Loader2, AlertCircle, Send, Clapperboard, ImagePlus, X, Check, Clock, Sparkles, Film, ArrowRight } from 'lucide-react'
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
}

interface AiChatMessage {
  id: string
  type: 'progress' | 'result' | 'error'
  stageLabel?: string
  slideProgress?: SlideProgress[]
  slides?: VideoSlide[]
  errorText?: string
  partialFailures?: number
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

  const handleGenerate = async () => {
    if (!topic.trim() || generating) return
    const currentTopic = topic.trim()

    flushSync(() => {
      setUserMessages(prev => [...prev, { id: `u-${Date.now()}`, content: currentTopic }])
    })

    const msgId = `ai-${Date.now()}`
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
    setGenerating(true)
    setTopic('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000)

    try {
      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: currentTopic,
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
          if (stage === 'saving') {
            updateActiveMsg(m => ({ ...m, stageLabel: STAGE_LABELS.saving }))
          } else if (stage === 'video') {
            updateActiveMsg(m => ({ ...m, stageLabel: STAGE_LABELS.video_start }))
          }

        } else if (eventName === 'copy_done') {
          const copySlides = (data.slides as Array<{ slideNumber: number; role: string; headline: string }>) ?? []
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `${STAGE_LABELS.copy_done_prefix}${copySlides.length}개 슬라이드`,
            slideProgress: copySlides.map(s => ({
              slideNumber: s.slideNumber,
              status: 'waiting' as const,
            })),
          }))

        } else if (eventName === 'slide_start') {
          updateActiveMsg(m => ({
            ...m,
            stageLabel: `◎ 슬라이드 ${data.slideNumber}/${data.total} 영상 렌더링 중...`,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber
                ? { ...sp, status: 'generating' as const }
                : sp,
            ),
          }))

        } else if (eventName === 'slide_polling') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber
                ? { ...sp, status: 'generating' as const, elapsed: data.elapsed as number }
                : sp,
            ),
          }))

        } else if (eventName === 'slide_done') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber
                ? { ...sp, status: 'done' as const }
                : sp,
            ),
          }))

        } else if (eventName === 'slide_error') {
          updateActiveMsg(m => ({
            ...m,
            slideProgress: (m.slideProgress ?? []).map(sp =>
              sp.slideNumber === data.slideNumber
                ? { ...sp, status: 'error' as const, error: data.error as string }
                : sp,
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
            const path = locale === 'en' ? `/en/campaign/${campaignId}` : `/ko/campaign/${campaignId}`
            setTimeout(() => router.push(path), 1400)
          }

        } else if (eventName === 'error') {
          updateActiveMsg(m => ({
            ...m,
            type: 'error',
            errorText: data.error as string,
          }))
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleGenerate()
    }
  }

  // 편집 화면 전환 오버레이
  if (redirecting) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full flex-col items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f0f6ff 40%, #e4edfe 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg border border-[#dde5f5]">
            <Film className="h-7 w-7 text-[#4c6ef5]" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-bold text-[#1a2a5e]">영상 카드뉴스가 완성됐습니다</p>
            <p className="text-sm text-[#6b7fad] flex items-center gap-2 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              편집 화면으로 이동하는 중...
            </p>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 30%, #eef4ff 65%, #e8f0fe 100%)' }}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-[#e8edf8] bg-white/70 backdrop-blur-md px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dde5f5] bg-white px-3 py-1.5 text-xs font-bold text-[#3b5bdb] shadow-sm">
          <Clapperboard className="h-3.5 w-3.5" />
          영상 카드뉴스
          <span className="rounded-full bg-[#4c6ef5] px-1.5 py-0.5 text-[9px] font-black text-white tracking-wide">BETA</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#dde5f5] bg-[#f0f5ff] px-3 py-1.5 text-xs font-bold text-[#4c6ef5]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: brand.mainColor || '#4c6ef5' }} />
          {brand.name}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {/* Greeting */}
        <motion.div {...fadeIn} transition={{ ...smoothEase, delay: 0.05 }} className="flex justify-start">
          <div className="flex flex-col gap-2.5 items-start max-w-md">
            <AiBubbleAvatar />
            <div className="rounded-2xl rounded-tl-sm bg-white/90 backdrop-blur-sm border border-[#dde5f5] px-4 py-3.5 shadow-sm text-sm leading-7 text-[#2c3e6b]">
              안녕하세요! <span className="font-bold text-[#4c6ef5]">영상 카드뉴스</span>를 만들어드릴게요.
              <br /><br />
              어떤 주제로 만들고 싶으신가요? 주제를 입력하면 AI가 슬라이드 구성부터 영상 생성까지 자동으로 진행합니다.
              <br /><br />
              <span className="text-[11px] text-[#8899cc] font-semibold">✦ 슬라이드당 약 1~2분 · 9:16 세로 영상 · 텍스트 자동 합성</span>
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
                <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-[#4c6ef5] px-4 py-3 text-sm font-medium leading-6 text-white shadow-sm whitespace-pre-wrap">
                  {umsg.content}
                </div>
              </div>
              {aiMessages[idx] && (
                <AiProgressMessage msg={aiMessages[idx]} />
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
        className={`shrink-0 border-t px-4 py-3.5 space-y-2.5 transition-colors ${
          isDragging ? 'border-[#4c6ef5] bg-[#eef4ff]' : 'border-[#e8edf8] bg-white/70 backdrop-blur-md'
        }`}
      >
        {isDragging && (
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#4c6ef5] bg-[#eef4ff] py-3 text-sm font-medium text-[#4c6ef5]">
            이미지를 여기에 놓으세요
          </div>
        )}

        {attachedImages.length > 0 && (
          <div className="flex gap-2">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#dde5f5] shadow-sm">
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
          <span className="text-[11px] text-[#8899cc] font-semibold">슬라이드</span>
          {([3, 5, 7] as const).map(n => (
            <button
              key={n}
              type="button"
              disabled={generating}
              onClick={() => setSlideCount(n)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                slideCount === n
                  ? 'bg-[#4c6ef5] text-white shadow-sm'
                  : 'border border-[#dde5f5] bg-white/80 text-[#3b5bdb] hover:border-[#4c6ef5]'
              } disabled:opacity-50`}
            >
              {n}장
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <button type="button" disabled={generating || attachedImages.length >= 3}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dde5f5] bg-white/80 text-[#7c9cf5] transition hover:border-[#4c6ef5] hover:text-[#4c6ef5] hover:shadow-sm disabled:opacity-40">
            <ImagePlus className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = '' }} />

          <textarea ref={inputRef} rows={2} value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="만들 영상의 주제나 키워드를 입력하세요..."
            disabled={generating}
            className="flex-1 resize-none rounded-xl border border-[#dde5f5] bg-white/90 px-3.5 py-2.5 text-sm text-[#1a2a5e] placeholder-[#a0aecf] outline-none focus:border-[#4c6ef5] focus:ring-2 focus:ring-[#4c6ef5]/10 disabled:opacity-50 transition-all shadow-sm" />

          <button type="button" onClick={handleGenerate} disabled={generating || !topic.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4c6ef5] text-white shadow-sm transition hover:bg-[#3b5bdb] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 active:scale-95">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function AiBubbleAvatar() {
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#4c6ef5] to-[#74c0fc] text-[10px] font-black text-white shadow-sm ring-1 ring-white/30">
      <Film className="h-3 w-3" />
    </div>
  )
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
          <motion.div {...fadeIn} transition={smoothEase}
            className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3.5 text-sm text-red-700 max-w-md shadow-sm">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs mb-1">생성 중 오류가 발생했습니다</p>
              <p className="text-xs leading-5 text-red-600">{msg.errorText}</p>
              <p className="text-[10px] mt-2 text-red-400">잠시 후 다시 시도해주세요.</p>
            </div>
          </motion.div>
        )}

        {/* Progress / result */}
        {msg.type !== 'error' && (
          <div className="rounded-2xl rounded-tl-sm bg-white/90 backdrop-blur-sm border border-[#dde5f5] px-4 py-3.5 shadow-sm w-full space-y-3">
            {/* Stage label */}
            <div className="flex items-center gap-2">
              {msg.type === 'progress' && (
                <Loader2 className="h-3.5 w-3.5 text-[#4c6ef5] animate-spin shrink-0" />
              )}
              {msg.type === 'result' && (
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              <span className={`text-xs font-semibold leading-5 ${
                msg.type === 'result' ? 'text-emerald-700' : 'text-[#2c3e6b]'
              }`}>
                {msg.stageLabel}
              </span>
            </div>

            {/* Slide progress */}
            {(msg.slideProgress?.length ?? 0) > 0 && (
              <div className="space-y-1.5 border-t border-[#e8edf8] pt-2.5">
                {(msg.slideProgress ?? []).map(sp => (
                  <SlideProgressRow key={sp.slideNumber} sp={sp} />
                ))}
              </div>
            )}

            {/* Result: completion summary */}
            {msg.type === 'result' && msg.slides && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
                className="border-t border-[#e8edf8] pt-2.5"
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
    waiting: <div className="h-3 w-3 rounded-full border-2 border-[#c0cef5]" />,
    generating: <Loader2 className="h-3 w-3 text-[#4c6ef5] animate-spin" />,
    done: <Check className="h-3 w-3 text-emerald-500" />,
    error: <AlertCircle className="h-3 w-3 text-red-400" />,
  }[sp.status]

  const textColor = {
    waiting: 'text-[#a0aecf]',
    generating: 'text-[#4c6ef5]',
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
    waiting: 'bg-[#e8edf8]',
    generating: 'bg-[#4c6ef5]',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }[sp.status]

  return (
    <div className={`space-y-1 text-[11px] ${textColor}`}>
      <div className="flex items-center gap-2">
        <div className="shrink-0">{icons}</div>
        <span className="font-semibold">슬라이드 {sp.slideNumber}</span>
        {sp.status === 'generating' && sp.elapsed !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#8899cc]">
            <Clock className="h-2.5 w-2.5" />{sp.elapsed}초
          </span>
        )}
        {sp.status === 'done' && <span className="ml-auto text-[10px] text-emerald-500 font-bold">완료</span>}
        {sp.status === 'error' && <span className="ml-auto text-[9px] text-red-400 truncate max-w-[140px]">{sp.error}</span>}
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full rounded-full bg-[#e8edf8] overflow-hidden">
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
