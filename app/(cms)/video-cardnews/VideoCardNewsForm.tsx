'use client'

import { useState, useRef } from 'react'
import { Loader2, Play, Pause, Video, AlertCircle } from 'lucide-react'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
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

export default function VideoCardNewsForm({ brand, hasApiKey }: VideoCardNewsFormProps) {
  const [topic, setTopic] = useState('')
  const [slideCount, setSlideCount] = useState<3 | 5 | 7>(5)
  const [duration, setDuration] = useState<3 | 5>(5)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<VideoSlide[]>([])
  const [activeSlide, setActiveSlide] = useState(0)

  const handleGenerate = async () => {
    if (!topic.trim() || generating) return
    setGenerating(true)
    setError(null)
    setSlides([])
    setProgress('카피 생성 중...')

    try {
      const res = await fetch('/api/video-cardnews/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          brandId: brand.id,
          slideCount,
          durationSeconds: duration,
          domainLabel: brand.industry,
          brandTone: brand.toneOfVoice,
          language: 'ko',
        }),
      })
      setProgress(`영상 생성 중... (${slideCount}개, 각 ${duration}초 — 최대 3분 소요)`)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '서버 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  const current = slides[activeSlide]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: form + slide list */}
      <div className="w-[320px] shrink-0 overflow-y-auto border-r border-[#e4e4e7] bg-[#fafafa] p-5 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#71717a] mb-1">영상 카드뉴스 생성</p>
          <p className="text-[11px] text-[#a1a1aa]">상단 영상 + 하단 텍스트 · 9:16 포맷</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#52525b]">주제 또는 키워드</label>
            <textarea
              rows={3}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="예: 호두의 효능, 2026 패션 트렌드..."
              disabled={generating}
              className="w-full resize-none rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#111111] placeholder-[#a1a1aa] outline-none focus:border-[#111111] disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#52525b]">슬라이드 수</label>
              <select
                value={slideCount}
                onChange={e => setSlideCount(Number(e.target.value) as 3 | 5 | 7)}
                disabled={generating}
                className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#111111] disabled:opacity-50"
              >
                <option value={3}>3장</option>
                <option value={5}>5장</option>
                <option value={7}>7장</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#52525b]">영상 길이</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value) as 3 | 5)}
                disabled={generating}
                className="w-full rounded-lg border border-[#e4e4e7] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#111111] disabled:opacity-50"
              >
                <option value={3}>3초</option>
                <option value={5}>5초</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />생성 중...</>
            ) : (
              <><Video className="h-4 w-4" />영상 카드뉴스 생성</>
            )}
          </button>

          {generating && progress && (
            <p className="text-center text-[11px] text-[#71717a]">{progress}</p>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Slide thumbnails */}
        {slides.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#52525b]">슬라이드 목록</p>
            {slides.map((s, i) => (
              <button
                key={s.slideNumber}
                type="button"
                onClick={() => setActiveSlide(i)}
                className={`w-full rounded-lg border p-3 text-left text-[11px] transition-all ${
                  i === activeSlide
                    ? 'border-[#111111] bg-white shadow-sm'
                    : 'border-[#e4e4e7] hover:border-[#d4d4d8]'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Video className="h-3 w-3 text-[#71717a] shrink-0" />
                  <span className="font-bold text-[#111111] truncate">{s.headline}</span>
                </div>
                <p className="text-[#71717a] line-clamp-2 leading-4">{s.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: preview — 은은한 하늘색 그라데이션 배경 */}
      <div
        className="flex-1 overflow-y-auto flex items-center justify-center p-8"
        style={{
          background: 'linear-gradient(135deg, #e8f4fd 0%, #dbeeff 30%, #eef6ff 60%, #f0f8ff 100%)',
        }}
      >
        {slides.length === 0 ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/60 shadow-sm backdrop-blur-sm">
              <Video className="h-8 w-8 text-[#7fb3d3]" />
            </div>
            <p className="text-sm font-medium text-[#4a7fa5]">주제를 입력하고 생성 버튼을 누르세요</p>
            <p className="text-[11px] text-[#7fb3d3] mt-1">상단 영상 + 하단 텍스트 · 9:16</p>
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
    if (playing) {
      videoRef.current.pause()
    } else {
      void videoRef.current.play()
    }
    setPlaying(!playing)
  }

  // 9:16 card: max height 600px → width = 600 * 9/16 = 337.5
  return (
    <div className="relative" style={{ width: 338, height: 600 }}>
      {/* 9:16 card */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl" style={{ width: 338, height: 600 }}>
        {/* Top half: video */}
        <div className="relative bg-black" style={{ height: 300 }}>
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
          {/* Play/pause overlay */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
          >
            {playing
              ? <Pause className="h-10 w-10 text-white drop-shadow-lg" />
              : <Play className="h-10 w-10 text-white drop-shadow-lg" />
            }
          </button>
        </div>

        {/* Bottom half: black background + text */}
        <div
          className="flex flex-col justify-center px-5 py-4"
          style={{ height: 300, background: '#0a0a0a' }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555555] mb-2">
            {slide.role.replace('-', ' ')} · {slide.durationSeconds}s
          </p>
          <h2 className="font-black tracking-tight text-white leading-tight mb-3"
            style={{ fontSize: 22, lineHeight: 1.15 }}>
            {slide.headline}
          </h2>
          <p className="text-[#b0b0b0] leading-relaxed" style={{ fontSize: 13 }}>
            {slide.body}
          </p>
        </div>
      </div>

      {/* Slide indicator */}
      <p className="mt-3 text-center text-[11px] text-[#555555]">
        슬라이드 {slide.slideNumber}
      </p>
    </div>
  )
}
