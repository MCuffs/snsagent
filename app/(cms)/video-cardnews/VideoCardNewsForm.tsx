'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { Loader2, Video, AlertCircle, Send, Clapperboard, ImagePlus, X } from 'lucide-react'
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

interface VideoCardNewsFormProps {
  brand: Brand
  hasApiKey?: boolean
}

const smoothTransition = { duration: 0.6, ease: [0.19, 1, 0.22, 1] as const }

interface UserChatMessage {
  id: string
  content: string
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  if (!text.trim()) return null

  try {
    return JSON.parse(text) as T
  } catch (error) {
    console.warn('[VideoCardNewsForm] Non-JSON response received', {
      status: response.status,
      contentType: response.headers.get('content-type'),
      preview: text.slice(0, 180),
      error,
    })
    return null
  }
}

export default function VideoCardNewsForm({ brand }: VideoCardNewsFormProps) {
  const [topic, setTopic] = useState('')
  const [userMessages, setUserMessages] = useState<UserChatMessage[]>([])
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string }>>([])
  const [isDragging, setIsDragging] = useState(false)
  const [slideCount, setSlideCount] = useState<3 | 5 | 7>(5)
  const [duration, setDuration] = useState<3 | 5>(5)
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState<'copy' | 'video' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<VideoSlide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

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

  // Paste handler
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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addImages(e.dataTransfer.files)
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [slides, generating, error, userMessages])

  const handleGenerate = async () => {
    if (!topic.trim() || generating) return
    const currentTopic = topic.trim()
    flushSync(() => {
      setUserMessages(prev => [...prev, { id: `${Date.now()}-${prev.length}`, content: currentTopic }])
    })
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })

    setGenerating(true)
    setError(null)
    setSlides([])
    setStage('copy')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000) // 4 minutes

    try {
      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: currentTopic,
          brandId: brand.id,
          slideCount,
          durationSeconds: duration,
          domainLabel: brand.industry,
          brandTone: brand.toneOfVoice,
          language: 'ko',
        }),
      })
      clearTimeout(timeoutId)
      setStage('video')
      const data = await readJsonResponse<{
        success?: boolean
        slides?: VideoSlide[]
        error?: string
        partialFailures?: number
      }>(res)
      if (!data) {
        setError('생성 중 오류가 발생했습니다.')
        return
      }
      if (!res.ok || data.error) {
        setError(data.error || '생성 중 오류가 발생했습니다.')
        return
      }
      setSlides(data.slides || [])
      setActiveSlide(0)
      setTopic('')
      
      if (data.partialFailures && data.partialFailures > 0) {
        setError(`${data.partialFailures}개 슬라이드 영상 생성에 실패했습니다. 성공한 슬라이드만 표시됩니다.`)
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('요청 시간이 초과되었습니다. 슬라이드 수를 줄이거나 다시 시도해주세요.')
        } else {
          setError(err.message)
        }
      } else {
        setError('서버 오류가 발생했습니다.')
      }
    } finally {
      setGenerating(false)
      setStage(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleGenerate()
    }
  }

  const current = slides[activeSlide]

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 30%, #eef4ff 65%, #e8f0fe 100%)',
      }}
    >
      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-[#e8edf8] bg-white/60 backdrop-blur-sm px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dde5f5] bg-white px-3 py-1.5 text-xs font-bold text-[#3b5bdb] shadow-sm">
            <Clapperboard className="h-3.5 w-3.5" />
            영상 카드뉴스 · Beta
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#dde5f5] bg-[#f0f5ff] px-3 py-1.5 text-xs font-bold text-[#4c6ef5]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: brand.mainColor || '#4c6ef5' }}
            />
            {brand.name}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={smoothTransition}
            className="flex justify-start"
          >
            <div className="flex flex-col gap-2 items-start max-w-md">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#4c6ef5] to-[#74c0fc] text-[10px] font-black text-white shadow-sm">
                V
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-white/80 backdrop-blur-sm border border-[#dde5f5] px-4 py-3 shadow-sm text-sm leading-6 text-[#2c3e6b]">
                안녕하세요! 영상 카드뉴스를 만들어봅시다.
                <br /><br />
                참고할 이미지를 첨부하고, 어떤 영상 카드뉴스를 만들고 싶은지 주제를 입력해주세요.
                <br /><br />
                영상은 슬라이드별 3~5초 클립으로 생성되며, 9:16 화면 상단에 영상, 하단에 텍스트가 배치됩니다.
              </div>
            </div>
          </motion.div>

          {/* User messages */}
          <AnimatePresence initial={false}>
            {userMessages.map(message => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={smoothTransition}
                className="flex justify-end"
              >
                <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-[#4c6ef5] px-4 py-3 text-sm font-medium leading-6 text-white shadow-sm whitespace-pre-wrap">
                  {message.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Generating indicator */}
          {generating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={smoothTransition}
              className="flex justify-start"
            >
              <div className="flex flex-col gap-2 items-start">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#4c6ef5] to-[#74c0fc] text-[10px] font-black text-white shadow-sm">
                  V
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-white/80 border border-[#dde5f5] px-4 py-3 shadow-sm text-sm text-[#4c6ef5]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {stage === 'copy' ? '카피 기획 중...' : `영상 생성 중 (${slideCount}개 슬라이드, 약 2~3분 소요)...`}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && !generating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-md">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            </motion.div>
          )}

          {/* Result: slide thumbnails as chat message */}
          <AnimatePresence>
            {slides.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={smoothTransition}
                className="flex justify-start"
              >
                <div className="flex flex-col gap-2 items-start max-w-sm w-full">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#4c6ef5] to-[#74c0fc] text-[10px] font-black text-white shadow-sm">
                    V
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-white/80 border border-[#dde5f5] px-4 py-3 shadow-sm text-sm text-[#2c3e6b] mb-2">
                    영상 {slides.length}개가 완성됐습니다. 우측에서 확인하세요.
                    {slides.some(s => !s.videoUrl) && (
                      <p className="text-[11px] text-orange-600 mt-1">
                        ⚠ 일부 슬라이드 영상 생성 실패
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 w-full">
                    {slides.map((s, i) => (
                      <button
                        key={s.slideNumber}
                        type="button"
                        onClick={() => setActiveSlide(i)}
                        disabled={!s.videoUrl}
                        className={`w-full rounded-xl border p-3 text-left text-[11px] transition-all bg-white/70 backdrop-blur-sm ${
                          i === activeSlide
                            ? 'border-[#4c6ef5] shadow-sm'
                            : 'border-[#dde5f5] hover:border-[#a5b4fc]'
                        } ${!s.videoUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Video className={`h-3 w-3 shrink-0 ${s.videoUrl ? 'text-[#4c6ef5]' : 'text-gray-400'}`} />
                          <span className="font-bold text-[#1a2a5e] truncate">{s.headline}</span>
                          {!s.videoUrl && (
                            <span className="text-[9px] text-red-500 font-semibold ml-auto">실패</span>
                          )}
                        </div>
                        <p className="text-[#6b7fad] line-clamp-2 leading-4">{s.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chatBottomRef} />
        </div>

        {/* Config bar + input */}
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`shrink-0 border-t px-4 py-3 space-y-2 transition-colors ${
            isDragging
              ? 'border-[#4c6ef5] bg-[#eef4ff]'
              : 'border-[#e8edf8] bg-white/60 backdrop-blur-sm'
          }`}
        >
          {isDragging && (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-[#4c6ef5] bg-[#eef4ff] py-3 text-sm font-medium text-[#4c6ef5]">
              이미지를 여기에 놓으세요
            </div>
          )}

          {/* Attached image previews */}
          {attachedImages.length > 0 && (
            <div className="flex gap-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#dde5f5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Options row */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8899cc] font-medium">슬라이드</span>
            <select
              value={slideCount}
              onChange={e => setSlideCount(Number(e.target.value) as 3 | 5 | 7)}
              disabled={generating}
              className="rounded-lg border border-[#dde5f5] bg-white/80 px-2 py-1 text-xs font-medium text-[#3b5bdb] outline-none disabled:opacity-50"
            >
              <option value={3}>3장</option>
              <option value={5}>5장</option>
              <option value={7}>7장</option>
            </select>
            <span className="text-[11px] text-[#8899cc] font-medium ml-2">길이</span>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value) as 3 | 5)}
              disabled={generating}
              className="rounded-lg border border-[#dde5f5] bg-white/80 px-2 py-1 text-xs font-medium text-[#3b5bdb] outline-none disabled:opacity-50"
            >
              <option value={3}>3초</option>
              <option value={5}>5초</option>
            </select>
          </div>

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* Image attach button */}
            <button
              type="button"
              disabled={generating || attachedImages.length >= 3}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dde5f5] bg-white/80 text-[#7c9cf5] transition hover:border-[#4c6ef5] hover:text-[#4c6ef5] disabled:opacity-40"
            >
              <ImagePlus className="h-4.5 w-4.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = '' }}
            />

            <textarea
              ref={inputRef}
              rows={2}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="주제나 키워드를 입력하세요... (이미지 붙여넣기/드래그 가능)"
              disabled={generating}
              className="flex-1 resize-none rounded-xl border border-[#dde5f5] bg-white/80 px-3.5 py-2.5 text-sm text-[#1a2a5e] placeholder-[#a0aecf] outline-none focus:border-[#4c6ef5] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4c6ef5] text-white shadow-sm transition hover:bg-[#3b5bdb] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right: video preview */}
      <div
        className="w-[380px] shrink-0 flex items-center justify-center p-6 border-l border-[#e8edf8]"
        style={{
          background: 'linear-gradient(160deg, #f8faff 0%, #eef4ff 50%, #e4edfe 100%)',
        }}
      >
        {slides.length === 0 ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 shadow-sm border border-[#dde5f5]">
              <Clapperboard className="h-7 w-7 text-[#7c9cf5]" />
            </div>
            <p className="text-sm font-medium text-[#4c6ef5]">미리 보기</p>
            <p className="text-[11px] text-[#8899cc] mt-1">생성 후 여기서 영상을 확인하세요</p>
            {/* Mock card preview */}
            <div className="mt-5 mx-auto w-[140px] h-[249px] rounded-xl overflow-hidden shadow-lg border border-[#dde5f5]">
              <div className="h-[124px] bg-[#dde5f5]/60 flex items-center justify-center">
                <Video className="h-8 w-8 text-[#a5b4fc]" />
              </div>
              <div className="h-[125px] bg-[#1a1a2e] flex flex-col justify-center px-3 py-3">
                <p className="text-[9px] text-white font-black leading-tight mb-1.5">제목이 여기에 표시됩니다</p>
                <p className="text-[7.5px] text-white/60 leading-relaxed">하단 텍스트가 여기에 배치됩니다. AI가 슬라이드별로 완성합니다.</p>
              </div>
            </div>
            <p className="text-[10px] text-[#a5b4fc] mt-3">영상 길이 : 슬라이드당 3~5초</p>
          </div>
        ) : current ? (
          current.videoUrl ? (
            <VideoCardPreview slide={current} />
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-200">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <p className="text-sm font-medium text-red-600">영상 생성 실패</p>
              <p className="text-[11px] text-[#8899cc] mt-1">{current.error || '다시 시도해주세요'}</p>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

function VideoCardPreview({ slide }: { slide: VideoSlide }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(true)

  const togglePlay = () => {
    if (!videoRef.current) return
    if (playing) { videoRef.current.pause() } else { void videoRef.current.play() }
    setPlaying(!playing)
  }

  if (!slide.videoUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ width: 270, height: 480 }}>
          <div className="h-full bg-red-50 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-red-600">영상 생성 실패</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-[#7c9cf5]">슬라이드 {slide.slideNumber}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ width: 270, height: 480 }}>
        {/* Top half: video */}
        <div className="relative bg-black" style={{ height: 240 }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={slide.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
          >
            <span className="text-white text-2xl drop-shadow-lg">{playing ? '⏸' : '▶'}</span>
          </button>
        </div>
        {/* Bottom half: text */}
        <div className="flex flex-col justify-center px-4 py-4" style={{ height: 240, background: '#0d0d1a' }}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[#4c6ef5] mb-2">
            {slide.role} · {slide.durationSeconds}s
          </p>
          <h2 className="font-black text-white leading-tight mb-2.5" style={{ fontSize: 17 }}>
            {slide.headline}
          </h2>
          <p className="text-white/60 leading-relaxed" style={{ fontSize: 11 }}>
            {slide.body}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-[#7c9cf5]">슬라이드 {slide.slideNumber}</p>
    </div>
  )
}
