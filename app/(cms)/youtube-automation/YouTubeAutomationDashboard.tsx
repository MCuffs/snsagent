'use client'

import type React from 'react'
import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Download, ExternalLink, Loader2, Lock, Mic2, Play, Sparkles, Upload, Video } from 'lucide-react'

type ScenePlan = {
  sceneNumber: number
  narration: string
  searchKeyword: string
  durationSeconds: number
}

type SourceClip = {
  provider: 'pexels' | 'pixabay' | 'mock'
  id: string
  title: string
  videoUrl: string | null
  previewUrl: string | null
  sourceUrl: string | null
  keyword: string
}

type PlannerDay = {
  id: string
  dayNumber: number
  scheduledDate: string
  title: string
  status: string
  script?: string | null
  description?: string | null
  tags?: string[]
  pinnedComment?: string | null
  scenes?: ScenePlan[]
  sourceClips?: SourceClip[]
  ttsProvider?: string | null
  mp4Url?: string | null
  uploadedAt?: string | null
}

type Project = {
  id: string
  topic: string
  status: string
  currentOpenDay: number
  createdAt: string
  days: PlannerDay[]
}

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T

  try {
    return JSON.parse(text) as T
  } catch {
    return {
      error: res.ok
        ? '서버 응답을 읽을 수 없습니다.'
        : `요청이 실패했습니다. (${res.status})`,
    } as T
  }
}

export default function YouTubeAutomationDashboard() {
  const [topic, setTopic] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [selectedDay, setSelectedDay] = useState<PlannerDay | null>(null)
  const [viewMode, setViewMode] = useState<'planner' | 'studio'>('planner')
  const [loading, setLoading] = useState<'planner' | 'day' | 'render' | 'upload' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sortedDays = useMemo(
    () => [...(project?.days || [])].sort((a, b) => a.dayNumber - b.dayNumber),
    [project],
  )

  const createPlanner = async () => {
    const clean = topic.trim()
    if (!clean) {
      setError('주제를 입력해 주세요.')
      return
    }

    setLoading('planner')
    setError(null)
    try {
      const res = await fetch('/api/youtube-automation/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: clean }),
      })
      const data = await readApiJson<{ project?: Project; error?: string }>(res)
      if (!res.ok || !data.project) throw new Error(data.error || '30일 플래너를 만들지 못했습니다.')
      setProject(data.project)
      setSelectedDay(data.project.days.find(day => day.status === 'open') || data.project.days[0] || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '30일 플래너를 만들지 못했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const startDay = async (day: PlannerDay) => {
    if (day.status === 'locked') return
    setSelectedDay(day)
    if (day.script) {
      setViewMode('studio')
      return
    }

    setLoading('day')
    setError(null)
    try {
      const res = await fetch(`/api/youtube-automation/days/${day.id}/start`, { method: 'POST' })
      const data = await readApiJson<{ day?: Partial<PlannerDay>; error?: string }>(res)
      if (!res.ok || !data.day) throw new Error(data.error || '제작안을 만들지 못했습니다.')
      setSelectedDay({ ...day, ...data.day })
      applyDayUpdate(day.id, data.day)
      setViewMode('studio')
    } catch (err) {
      setError(err instanceof Error ? err.message : '제작안을 만들지 못했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const requestRender = async () => {
    if (!selectedDay) return
    setLoading('render')
    setError(null)
    try {
      const res = await fetch(`/api/youtube-automation/days/${selectedDay.id}/render`, { method: 'POST' })
      const data = await readApiJson<{ day?: Partial<PlannerDay>; message?: string; error?: string }>(res)
      if (!res.ok || !data.day) throw new Error(data.error || '렌더링을 완료하지 못했습니다.')
      applyDayUpdate(selectedDay.id, data.day)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '렌더링을 시작하지 못했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const markUploaded = async () => {
    if (!selectedDay || !project) return
    setLoading('upload')
    setError(null)
    try {
      const res = await fetch(`/api/youtube-automation/days/${selectedDay.id}/upload-check`, { method: 'PATCH' })
      const data = await readApiJson<{ currentOpenDay?: number; days?: Partial<PlannerDay>[]; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '업로드 체크를 저장하지 못했습니다.')
      const statusById = new Map((data.days || []).map(day => [day.id, day]))
      const updatedDays = project.days.map(day => ({ ...day, ...(statusById.get(day.id) || {}) }))
      setProject({ ...project, currentOpenDay: data.currentOpenDay || project.currentOpenDay, days: updatedDays })
      const updatedSelected = updatedDays.find(day => day.id === selectedDay.id) || selectedDay
      setSelectedDay(updatedSelected)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 체크를 저장하지 못했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const applyDayUpdate = (dayId: string, patch: Partial<PlannerDay>) => {
    setProject(prev => {
      if (!prev) return prev
      const days = prev.days.map(day => day.id === dayId ? { ...day, ...patch } : day)
      const next = { ...prev, days }
      setSelectedDay(days.find(day => day.id === dayId) || null)
      return next
    })
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-5 py-10">
        <div className="w-full max-w-[760px]">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white shadow-[0_16px_42px_rgba(15,23,42,0.22)]">
              <Video className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-[28px] font-black tracking-tight text-[#111827] md:text-[34px]">유튜브 자동화</h1>
            <p className="mx-auto mt-3 max-w-[560px] text-sm font-semibold leading-6 text-[#64748b]">
              주제 하나를 입력하면 30일치 쇼츠 제목 캘린더를 만들고, 하루에 하나씩 제작을 시작합니다.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_24px_80px_rgba(87,119,185,0.14)] backdrop-blur-xl sm:p-5">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#64748b]">Topic</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void createPlanner()
                }}
                placeholder="예: 건강, 명언, 역사, 경제, 중년 다이어트"
                className="min-h-12 flex-1 rounded-2xl border border-[#e5e7eb] bg-white px-4 text-[15px] font-bold text-[#111827] outline-none transition-colors placeholder:text-[#a1a1aa] focus:border-[#4252ff]"
              />
              <button
                type="button"
                onClick={createPlanner}
                disabled={loading === 'planner'}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 text-sm font-black text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading === 'planner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                30일 플래너 만들기
              </button>
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-[#dc2626]">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/60 bg-white/54 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4252ff]">YouTube Automation</p>
            <h1 className="mt-1 text-xl font-black text-[#111827]">{project.topic} 30일 플래너</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setProject(null)
              setSelectedDay(null)
              setViewMode('planner')
              setTopic('')
              setError(null)
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/70 bg-white/68 px-4 text-xs font-black text-[#64748b] transition-colors hover:bg-white hover:text-[#111827]"
          >
            새 주제 입력
          </button>
        </div>
      </div>

      {viewMode === 'studio' && selectedDay ? (
        <YouTubeProductionStudio
          day={selectedDay}
          busy={loading}
          error={error}
          onBack={() => setViewMode('planner')}
          onRender={requestRender}
          onUploaded={markUploaded}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedDays.map(day => {
              const locked = day.status === 'locked'
              const active = selectedDay?.id === day.id
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => void startDay(day)}
                  disabled={locked}
                  className={`min-h-[122px] rounded-2xl border p-4 text-left transition-all ${
                    active
                      ? 'border-[#4252ff] bg-white shadow-[0_18px_42px_rgba(66,82,255,0.14)]'
                      : locked
                        ? 'cursor-not-allowed border-white/54 bg-white/38 opacity-55'
                        : 'border-white/70 bg-white/68 shadow-[0_12px_30px_rgba(87,119,185,0.08)] hover:border-[#c7d2fe] hover:bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f6ff] px-2 py-1 text-[10px] font-black text-[#4252ff]">
                      <CalendarDays className="h-3 w-3" />
                      Day {day.dayNumber}
                    </span>
                    <StatusPill status={day.status} />
                  </div>
                  <p className="line-clamp-2 text-sm font-black leading-5 text-[#111827]">{day.title}</p>
                  <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#94a3b8]">
                    {locked ? <Lock className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {loading === 'day' && active ? '제작 화면 준비 중' : locked ? '하루에 하나씩 오픈됩니다' : '제목 클릭 시 제작 화면으로 이동'}
                  </p>
                </button>
              )
            })}
          </div>
          {error && <p className="mt-4 rounded-xl bg-[#fff7ed] p-3 text-xs font-bold leading-5 text-[#c2410c]">{error}</p>}
        </div>
      )}
    </div>
  )
}

function YouTubeProductionStudio({
  day,
  busy,
  error,
  onBack,
  onRender,
  onUploaded,
}: {
  day: PlannerDay
  busy: string | null
  error: string | null
  onBack: () => void
  onRender: () => void
  onUploaded: () => void
}) {
  const scenes = day.scenes || []
  const sourceClips = day.sourceClips || []
  const usableClips = sourceClips.filter(clip => clip.videoUrl)
  const firstClip = usableClips[0]
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc]">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/82 px-5 py-3 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#64748b] transition-colors hover:text-[#111827]"
              aria-label="플래너로 돌아가기"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4252ff]">Day {day.dayNumber} Production</p>
              <h2 className="truncate text-lg font-black text-[#111827]">{day.title}</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRender}
              disabled={!day.script || busy === 'render'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 text-xs font-black text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'render' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {day.mp4Url ? 'MP4 다시 렌더링' : 'MP4 렌더링'}
            </button>
            <button
              type="button"
              onClick={onUploaded}
              disabled={busy === 'upload'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dbe3ef] bg-white px-4 text-xs font-black text-[#334155] transition-colors hover:bg-[#f8fafc] disabled:opacity-60"
            >
              {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              업로드 완료
            </button>
          </div>
        </div>
      </div>

      {busy === 'day' && (
        <div className="flex min-h-[520px] items-center justify-center px-5">
          <ProgressBlock icon={Loader2} spinning title="제작 화면 준비 중" desc="스크립트, 자막 타임라인, 무료 영상 소스를 불러오고 있습니다." />
        </div>
      )}

      {day.script && busy !== 'day' && (
        <div className="grid gap-5 px-5 py-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-white/80 bg-[#111827] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="mx-auto aspect-[9/16] w-full max-w-[330px] overflow-hidden rounded-[28px] bg-black shadow-2xl">
              <div className="relative h-full w-full">
                {firstClip?.videoUrl ? (
                  <video
                    src={firstClip.videoUrl}
                    poster={firstClip.previewUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#172554] to-[#020617] px-8 text-center text-sm font-bold text-white/70">
                    무료 영상 소스를 찾는 중입니다
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/72 to-transparent p-5 pt-24">
                  <p className="text-center text-[22px] font-black leading-tight text-white drop-shadow">{day.title}</p>
                  <p className="mt-4 rounded-xl bg-black/54 px-3 py-2 text-center text-sm font-bold leading-5 text-white">
                    {scenes[0]?.narration || day.script.split('\n')[0]}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Metric label="Scenes" value={String(scenes.length)} />
              <Metric label="Clips" value={String(usableClips.length)} />
              <Metric label="Seconds" value={String(totalDuration || 0)} />
            </div>
            {day.mp4Url && (
              <a
                href={day.mp4Url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4252ff] px-4 text-xs font-black text-white transition-colors hover:bg-[#3443d4]"
              >
                <Download className="h-4 w-4" />
                완성 MP4 열기
              </a>
            )}
          </section>

          <div className="min-w-0 space-y-5">
            <Section title="장면별 영상과 자막" icon={Video}>
              <div className="grid gap-3 lg:grid-cols-2">
                {scenes.map((scene, index) => {
                  const clip = sourceClips.find(item => item.keyword === scene.searchKeyword) || sourceClips[index]
                  return (
                    <article key={scene.sceneNumber} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                      <div className="aspect-video bg-[#0f172a]">
                        {clip?.videoUrl ? (
                          <video src={clip.videoUrl} poster={clip.previewUrl || undefined} muted loop playsInline controls className="h-full w-full object-cover" />
                        ) : clip?.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={clip.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-bold text-white/54">영상 후보 없음</div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-[#111827]">Scene {scene.sceneNumber} · {scene.durationSeconds}s</p>
                          {clip?.sourceUrl && (
                            <a href={clip.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-black text-[#4252ff]">
                              원본 <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="rounded-xl bg-[#111827] px-3 py-2 text-sm font-bold leading-5 text-white">{scene.narration}</p>
                        <p className="mt-2 text-[11px] font-bold text-[#64748b]">{scene.searchKeyword}</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            </Section>

            <Section title="자막 타임라인" icon={Mic2}>
              <div className="space-y-2">
                {scenes.map((scene, index) => {
                  const start = scenes.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0)
                  return (
                    <div key={scene.sceneNumber} className="grid gap-3 rounded-xl bg-[#f8fafc] p-3 sm:grid-cols-[88px_minmax(0,1fr)]">
                      <p className="text-xs font-black text-[#4252ff]">{formatTime(start)} - {formatTime(start + scene.durationSeconds)}</p>
                      <p className="text-sm font-semibold leading-6 text-[#334155]">{scene.narration}</p>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section title="전체 스크립트와 메타데이터" icon={Sparkles}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-black text-[#64748b]">Script</p>
                  <p className="whitespace-pre-line rounded-xl bg-[#f8fafc] p-3 text-sm font-semibold leading-6 text-[#334155]">{day.script}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black text-[#64748b]">Upload metadata</p>
                  <p className="text-sm font-semibold leading-6 text-[#334155]">{day.description}</p>
                  <p className="mt-3 text-xs font-black text-[#4252ff]">{(day.tags || []).map(tag => `#${tag}`).join(' ')}</p>
                  {day.pinnedComment && <p className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-xs font-semibold leading-5 text-[#64748b]">{day.pinnedComment}</p>}
                </div>
              </div>
            </Section>

            {error && <p className="rounded-xl bg-[#fff7ed] p-3 text-xs font-bold leading-5 text-[#c2410c]">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  )
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${String(sec).padStart(2, '0')}`
}

function StatusPill({ status }: { status: string }) {
  const label = status === 'locked'
    ? '잠김'
    : status === 'open'
      ? '오픈'
      : status === 'ready'
        ? '준비됨'
        : status === 'uploaded'
          ? '업로드'
          : status === 'rendering'
            ? '렌더링'
            : '진행'
  const tone = status === 'locked'
    ? 'bg-[#f1f5f9] text-[#94a3b8]'
    : status === 'uploaded'
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-[#eef2ff] text-[#4252ff]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${tone}`}>
      {status === 'uploaded' && <Check className="h-3 w-3" />}
      {label}
    </span>
  )
}

function ProgressBlock({
  icon: Icon,
  spinning = false,
  title,
  desc,
}: {
  icon: typeof Play
  spinning?: boolean
  title: string
  desc: string
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/72 p-5 text-center shadow-[0_14px_34px_rgba(87,119,185,0.08)]">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f5f7ff] text-[#4252ff]">
        <Icon className={`h-5 w-5 ${spinning ? 'animate-spin' : ''}`} />
      </div>
      <p className="mt-4 text-sm font-black text-[#111827]">{title}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#64748b]">{desc}</p>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Sparkles
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-[0_14px_34px_rgba(87,119,185,0.08)]">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#4252ff]" />
        <h3 className="text-sm font-black text-[#111827]">{title}</h3>
      </div>
      {children}
    </section>
  )
}
