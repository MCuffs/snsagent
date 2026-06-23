'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Play, Pause, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface VideoTrimResult {
  file: File
  startSec: number
  durationSec: number
}

interface Props {
  file: File
  onConfirm: (result: VideoTrimResult) => void
  onCancel: () => void
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export default function VideoTrimModal({ file, onConfirm, onCancel }: Props) {
  const t = useTranslations('campaign')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [duration, setDuration] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [durationSec, setDurationSec] = useState(3)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const objectUrl = useRef<string>('')

  useEffect(() => {
    objectUrl.current = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(objectUrl.current)
  }, [file])

  const handleLoaded = () => {
    const v = videoRef.current
    if (!v) return
    setDuration(v.duration)
    v.currentTime = 0
  }

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCurrentTime(v.currentTime)
    // 미리보기 루프: 선택 구간 끝에서 시작점으로
    if (v.currentTime >= startSec + durationSec) {
      v.currentTime = startSec
    }
  }, [startSec, durationSec])

  // 시작점 변경 시 영상 위치 동기화
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (v.currentTime < startSec || v.currentTime > startSec + durationSec) {
      v.currentTime = startSec
    }
  }, [startSec, durationSec])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) { v.pause(); setPlaying(false) }
    else { v.currentTime = startSec; v.play().catch(() => null); setPlaying(true) }
  }

  // 시작점 슬라이더 — 끝점이 총 영상 길이를 넘지 않도록
  const maxStart = Math.max(0, duration - durationSec)

  const handleConfirm = () => {
    videoRef.current?.pause()
    onConfirm({ file, startSec, durationSec })
  }

  const endSec = Math.min(startSec + durationSec, duration)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1e] border border-white/10 shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <p className="text-sm font-bold text-white">{t('trim_title')}</p>
          <button type="button" onClick={onCancel} className="text-white/50 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 영상 미리보기 */}
        <div className="relative bg-black aspect-[4/5] mx-5 mt-4 rounded-xl overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={objectUrl.current}
            className="absolute inset-0 h-full w-full object-cover"
            onLoadedMetadata={handleLoaded}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            playsInline
            muted
          />
          {/* 재생 버튼 오버레이 */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              {playing
                ? <Pause className="h-5 w-5 text-white fill-white" />
                : <Play className="h-5 w-5 text-white fill-white ml-0.5" />}
            </div>
          </button>
          {/* 현재 시간 표시 */}
          <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/80">
            {fmt(currentTime)}
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="px-5 py-4 space-y-4">
          {/* 구간 표시 */}
          <div className="flex items-center justify-between text-xs font-semibold text-white/50">
            <span>{t('trim_start')} <span className="text-white font-bold">{fmt(startSec)}</span></span>
            <span className="text-white/30">→</span>
            <span>{t('trim_end')} <span className="text-white font-bold">{fmt(endSec)}</span></span>
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
              {t('trim_seconds', { duration: durationSec })}
            </span>
          </div>

          {/* 시작점 슬라이더 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-white/40 uppercase tracking-widest">{t('trim_start_point')}</label>
            <input
              type="range"
              min={0}
              max={maxStart > 0 ? maxStart : 0}
              step={0.1}
              value={startSec}
              onChange={e => setStartSec(Number(e.target.value))}
              disabled={duration === 0}
              className="w-full accent-[#0066ff]"
            />
          </div>

          {/* 재생 길이 슬라이더 3~5초 */}
          <div>
            <label className="mb-1.5 block text-[11px] font-bold text-white/40 uppercase tracking-widest">{t('trim_duration')}</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={3}
                max={5}
                step={1}
                value={durationSec}
                onChange={e => {
                  const d = Number(e.target.value)
                  setDurationSec(d)
                  // 시작점이 범위를 벗어나면 조정
                  if (startSec + d > duration) setStartSec(Math.max(0, duration - d))
                }}
                disabled={duration < 3}
                className="flex-1 accent-[#0066ff]"
              />
              <span className="w-8 text-right text-sm font-bold text-white">{durationSec}s</span>
            </div>
          </div>

          {duration > 0 && duration < 3 && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-[11px] font-bold text-red-400">
              {t('trim_too_short')}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              {t('trim_cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={duration < 3}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066ff] py-2.5 text-xs font-bold text-white hover:bg-[#0052cc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              {t('trim_apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
