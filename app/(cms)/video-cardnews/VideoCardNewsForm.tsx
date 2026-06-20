'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Video, AlertCircle, Send, Clapperboard } from 'lucide-react'
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
  videoUrl: string
  durationSeconds: number
}

interface VideoCardNewsFormProps {
  brand: Brand
  hasApiKey: boolean
}

const smoothTransition = { duration: 0.6, ease: [0.19, 1, 0.22, 1] as const }

export default function VideoCardNewsForm({ brand }: VideoCardNewsFormProps) {
  const [topic, setTopic] = useState('')
  const [slideCount, setSlideCount] = useState<3 | 5 | 7>(5)
  const [duration, setDuration] = useState<3 | 5>(5)
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState<'copy' | 'video' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<VideoSlide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [slides, generating, error])

  const handleGenerate = async () => {
    if (!topic.trim() || generating) return
    const currentTopic = topic.trim()
    setGenerating(true)
    setError(null)
    setSlides([])
    setStage('copy')

    try {
      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setStage('video')
      const data = await res.json() as {
        success?: boolean
        slides?: VideoSlide[]
        error?: string
      }
      if (!res.ok || data.error) {
        setError(data.error || '생성 중 오류가 발생했습니다.')
        return
      }
      setSlides(data.slides || [])
      setActiveSlide(0)
      setTopic('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '서버 오류가 발생했습니다.')
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
                  </div>
                  <div className="space-y-2 w-full">
                    {slides.map((s, i) => (
                      <button
                        key={s.slideNumber}
                        type="button"
                        onClick={() => setActiveSlide(i)}
                        className={`w-full rounded-xl border p-3 text-left text-[11px] transition-all bg-white/70 backdrop-blur-sm ${
                          i === activeSlide
                            ? 'border-[#4c6ef5] shadow-sm'
                            : 'border-[#dde5f5] hover:border-[#a5b4fc]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Video className="h-3 w-3 text-[#4c6ef5] shrink-0" />
                          <span className="font-bold text-[#1a2a5e] truncate">{s.headline}</span>
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
        <div className="shrink-0 border-t border-[#e8edf8] bg-white/60 backdrop-blur-sm px-4 py-3 space-y-2">
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
            <textarea
              ref={inputRef}
              rows={2}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="주제나 키워드를 입력하세요... (이미지 첨부 권장)"
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
          <VideoCardPreview slide={current} />
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
