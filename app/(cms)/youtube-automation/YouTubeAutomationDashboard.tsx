'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, Check, Clock, Download, Folder, FolderOpen,
  Info, Loader2, Lock, Mic2, Play, Sparkles, Trash2, Upload, Video, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  ttsAudioUrl?: string | null
  mp4Url?: string | null
  thumbnailUrl?: string | null
  renderProgress?: number
  renderStage?: string | null
  renderCancelRequested?: boolean
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

type ModalPhase = 'planning' | 'rendering' | 'done' | 'error'

// localStorage key for completed-day timestamps
const LS_COMPLETED = 'yt-completed-days'
const MAX_HISTORY_FOLDERS = 3
const LOCK_HOURS = 24

// ─── Utils ────────────────────────────────────────────────────────────────────

async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return {} as T
  try { return JSON.parse(text) as T }
  catch { return { error: res.ok ? '서버 응답을 읽을 수 없습니다.' : `요청이 실패했습니다. (${res.status})` } as T }
}

function getCompletedTimes(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_COMPLETED) || '{}') }
  catch { return {} }
}

function saveCompletedTime(dayId: string) {
  const map = getCompletedTimes()
  map[dayId] = Date.now()
  try { localStorage.setItem(LS_COMPLETED, JSON.stringify(map)) } catch {}
}

function msToHHMM(ms: number) {
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}분`
  return `${h}시간 ${m}분`
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function YouTubeAutomationDashboard() {
  const [topic, setTopic] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [modalDay, setModalDay] = useState<PlannerDay | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Project[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [cancellingDayId, setCancellingDayId] = useState<string | null>(null)

  // Completed-day timestamps for 24h countdown
  const [completedTimes, setCompletedTimes] = useState<Record<string, number>>({})

  useEffect(() => {
    setCompletedTimes(getCompletedTimes())
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube-automation/projects', { cache: 'no-store' })
      const data = await readApiJson<{ projects?: Project[]; error?: string }>(res)
      if (!data.projects) return
      const projects = data.projects.slice(0, MAX_HISTORY_FOLDERS)
      setHistory(projects)
      setProject(current => current ? projects.find(item => item.id === current.id) || current : current)
      setModalDay(current => {
        if (!current) return current
        return projects.flatMap(item => item.days).find(day => day.id === current.id) || current
      })
    } catch {}
  }, [])

  // Load history on mount.
  useEffect(() => {
    void refreshProjects().finally(() => setHistoryLoading(false))
  }, [refreshProjects])

  const hasActiveRender = useMemo(
    () => [project, ...history].some(item => item?.days.some(day => day.status === 'rendering')),
    [project, history],
  )

  // Rendering runs on the server; polling keeps progress visible even after the modal closes.
  useEffect(() => {
    if (!hasActiveRender) return
    const interval = setInterval(() => { void refreshProjects() }, 2000)
    return () => clearInterval(interval)
  }, [hasActiveRender, refreshProjects])

  const sortedDays = useMemo(
    () => [...(project?.days || [])].sort((a, b) => a.dayNumber - b.dayNumber),
    [project],
  )

  const createPlanner = async () => {
    const clean = topic.trim()
    if (!clean) { setError('주제를 입력해 주세요.'); return }
    setCreating(true)
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
      setHistory(prev => [data.project!, ...prev].slice(0, MAX_HISTORY_FOLDERS))
      setTopic('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '30일 플래너를 만들지 못했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const handleDayClick = (day: PlannerDay, effectiveLocked: boolean) => {
    if (effectiveLocked) return
    setModalDay(day)
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('이 작업 히스토리를 삭제할까요?')) return
    setDeletingProjectId(projectId)
    setError(null)
    try {
      const res = await fetch('/api/youtube-automation/projects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await readApiJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '작업 히스토리를 삭제하지 못했습니다.')
      setHistory(prev => prev.filter(p => p.id !== projectId))
      setOpenFolderId(prev => (prev === projectId ? null : prev))
      setProject(prev => (prev?.id === projectId ? null : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 히스토리를 삭제하지 못했습니다.')
    } finally {
      setDeletingProjectId(null)
    }
  }

  const handleModalDone = useCallback((updatedDay: Partial<PlannerDay>) => {
    if (!project) return
    const days = project.days.map(d => d.id === updatedDay.id ? { ...d, ...updatedDay } : d)
    setProject({ ...project, days })
    setModalDay(prev => prev ? { ...prev, ...updatedDay } : prev)
    // Persist completion time for 24h countdown
    if (updatedDay.id) {
      saveCompletedTime(updatedDay.id)
      setCompletedTimes(getCompletedTimes())
    }
  }, [project])

  const handleCancelRender = async (day: PlannerDay) => {
    setCancellingDayId(day.id)
    try {
      const res = await fetch(`/api/youtube-automation/days/${day.id}/render`, { method: 'DELETE' })
      const data = await readApiJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '영상 제작을 중단하지 못했습니다.')
      await refreshProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 제작을 중단하지 못했습니다.')
    } finally {
      setCancellingDayId(null)
    }
  }

  const handleMarkUploaded = async (day: PlannerDay) => {
    if (!project) return
    try {
      const res = await fetch(`/api/youtube-automation/days/${day.id}/upload-check`, { method: 'PATCH' })
      const data = await readApiJson<{ currentOpenDay?: number; days?: Partial<PlannerDay>[]; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || '업로드 체크를 저장하지 못했습니다.')
      const statusById = new Map((data.days || []).map(d => [d.id, d]))
      const updatedDays = project.days.map(d => ({ ...d, ...(statusById.get(d.id) || {}) }))
      const updatedProject = { ...project, currentOpenDay: data.currentOpenDay || project.currentOpenDay, days: updatedDays }
      setProject(updatedProject)
      setHistory(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p))
      setModalDay(prev => {
        if (!prev) return prev
        const updated = updatedDays.find(d => d.id === prev.id)
        return updated ? { ...prev, ...updated } : prev
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Find the most recent completed day (mp4Url set) to calculate countdown
  const lastCompletedDayId = useMemo(() => {
    if (!project) return null
    const done = sortedDays.filter(d => d.mp4Url && completedTimes[d.id])
    if (!done.length) return null
    return done.reduce((a, b) => (completedTimes[a.id] > completedTimes[b.id] ? a : b)).id
  }, [project, sortedDays, completedTimes])

  const lastCompletedAt = lastCompletedDayId ? completedTimes[lastCompletedDayId] : null
  const unlockAt = lastCompletedAt ? lastCompletedAt + LOCK_HOURS * 3_600_000 : null
  const now = Date.now()
  const msUntilUnlock = unlockAt && unlockAt > now ? unlockAt - now : 0

  // Determine which day is "next after last completed"
  const nextAfterCompletedDayNumber = useMemo(() => {
    if (!lastCompletedDayId) return null
    const last = sortedDays.find(d => d.id === lastCompletedDayId)
    return last ? last.dayNumber + 1 : null
  }, [lastCompletedDayId, sortedDays])

  // ── Welcome screen ─────────────────────────────────────────────────────────
  if (!project) {
    return (
      <div
        className="flex h-full flex-col overflow-y-auto px-5 pt-10"
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-[760px]">
          {/* Hero */}
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white shadow-[0_16px_42px_rgba(15,23,42,0.22)]">
              <Video className="h-5 w-5" />
            </div>
            <h1 className="mt-5 text-[22px] font-black tracking-tight text-[#111827] sm:text-[28px] md:text-[34px]">유튜브 자동화</h1>
            <p className="mx-auto mt-3 max-w-[560px] text-sm font-semibold leading-6 text-[#64748b]">
              주제 하나를 입력하면 30일치 쇼츠 제목 캘린더를 만들고, 하루에 하나씩 제작을 시작합니다.
            </p>
          </div>

          {/* Input */}
          <div className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_24px_80px_rgba(87,119,185,0.14)] backdrop-blur-xl sm:p-5">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#64748b]">Topic</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void createPlanner() }}
                placeholder="예: 건강, 명언, 역사, 경제, 중년 다이어트"
                className="min-h-12 flex-1 rounded-2xl border border-[#e5e7eb] bg-white px-4 text-[15px] font-bold text-[#111827] outline-none transition-colors placeholder:text-[#a1a1aa] focus:border-[#4252ff]"
                style={{ fontSize: 16 }}
              />
              <button
                type="button"
                onClick={createPlanner}
                disabled={creating}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 text-sm font-black text-white transition-colors hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ touchAction: 'manipulation' }}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                30일 플래너 만들기
              </button>
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-[#dc2626]">{error}</p>}
          </div>

          {/* Work History */}
          <div className="mt-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[#94a3b8]">작업 히스토리</p>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-[#c4cdd8]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 불러오는 중...
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs font-semibold text-[#c4cdd8]">플래너를 생성하세요!</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {history.map(p => {
                  const isOpen = openFolderId === p.id
                  const completedCount = p.days.filter(d => d.mp4Url || d.status === 'uploaded').length
                  return (
                    <div key={p.id} className="overflow-hidden rounded-2xl border border-white/70 bg-white/72 shadow-[0_8px_24px_rgba(87,119,185,0.07)]">
                      <div className="flex items-center gap-2 px-4 py-3 hover:bg-[#f8fafc] transition-colors">
                      <button
                        type="button"
                        onClick={() => setOpenFolderId(isOpen ? null : p.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {isOpen
                          ? <FolderOpen className="h-4 w-4 shrink-0 text-[#4252ff]" />
                          : <Folder className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                        }
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#111827]">{p.topic}</p>
                          <p className="text-[10px] font-semibold text-[#94a3b8]">
                            {completedCount}/{p.days.length}일 완성 · {new Date(p.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProject(p.id)}
                        disabled={deletingProjectId === p.id}
                        aria-label="작업 히스토리 삭제"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#94a3b8] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingProjectId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-[#f1f5f9] p-3">
                          <button
                            type="button"
                            onClick={() => { setProject(p); setOpenFolderId(null) }}
                            className="w-full rounded-xl bg-[#4252ff] px-3 py-2 text-xs font-black text-white hover:bg-[#3443d4] transition-colors"
                          >
                            이 플래너 열기
                          </button>
                          <div className="mt-2 max-h-[140px] overflow-y-auto space-y-1">
                            {p.days.slice(0, 5).map(d => (
                              <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-1">
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${d.mp4Url ? 'bg-emerald-400' : d.status === 'open' ? 'bg-[#4252ff]' : 'bg-[#e2e8f0]'}`} />
                                <p className="truncate text-[11px] font-semibold text-[#64748b]">Day {d.dayNumber} · {d.title}</p>
                              </div>
                            ))}
                            {p.days.length > 5 && (
                              <p className="px-2 text-[10px] font-semibold text-[#c4cdd8]">+{p.days.length - 5}일 더...</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Planner view ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/60 bg-white/54 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4252ff]">YouTube Automation</p>
            <h1 className="mt-0.5 truncate text-base font-black text-[#111827] sm:text-xl">{project.topic} 30일 플래너</h1>
          </div>
          <button
            type="button"
            onClick={() => { setProject(null); setError(null) }}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/68 px-4 text-xs font-black text-[#64748b] transition-colors hover:bg-white hover:text-[#111827]"
            style={{ touchAction: 'manipulation' }}
          >
            목록으로
          </button>
        </div>
      </div>

      {/* Day Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {/* 24h info banner — shown when a video was just completed */}
        {msUntilUnlock > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs font-semibold leading-5 text-amber-700">
              <span className="font-black">다음 영상까지 {msToHHMM(msUntilUnlock)} 남았습니다.</span>{' '}
              유튜브 알고리즘은 하루에 하나씩 꾸준히 올릴 때 채널을 더 잘 성장시켜 줍니다.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedDays.map(day => {
            const dbLocked = day.status === 'locked'
            const isNextAfterCompleted = day.dayNumber === nextAfterCompletedDayNumber
            const timeLocked = isNextAfterCompleted && msUntilUnlock > 0
            const effectiveLocked = dbLocked || timeLocked

            return (
              <DayCard
                key={day.id}
                day={day}
                effectiveLocked={effectiveLocked}
                timeLocked={timeLocked}
                msUntilUnlock={timeLocked ? msUntilUnlock : 0}
                onClick={() => handleDayClick(day, effectiveLocked)}
                onCancel={() => void handleCancelRender(day)}
                cancelling={cancellingDayId === day.id}
              />
            )
          })}
        </div>
        {error && <p className="mt-4 rounded-xl bg-[#fff7ed] p-3 text-xs font-bold leading-5 text-[#c2410c]">{error}</p>}
      </div>

      {/* Production Modal */}
      {modalDay && (
        <DayProductionModal
          key={`${modalDay.id}-${modalDay.status}-${modalDay.renderProgress ?? 0}`}
          day={modalDay}
          onClose={() => setModalDay(null)}
          onDone={handleModalDone}
          onUploaded={() => handleMarkUploaded(modalDay)}
        />
      )}
    </div>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  effectiveLocked,
  timeLocked,
  msUntilUnlock,
  onClick,
  onCancel,
  cancelling,
}: {
  day: PlannerDay
  effectiveLocked: boolean
  timeLocked: boolean
  msUntilUnlock: number
  onClick: () => void
  onCancel: () => void
  cancelling: boolean
}) {
  const [showInfo, setShowInfo] = useState(false)
  const [remaining, setRemaining] = useState(msUntilUnlock)

  // Tick countdown while info is visible
  useEffect(() => {
    if (!timeLocked || !showInfo) return
    setRemaining(msUntilUnlock)
    const id = setInterval(() => setRemaining(prev => Math.max(0, prev - 1000)), 1000)
    return () => clearInterval(id)
  }, [timeLocked, showInfo, msUntilUnlock])

  return (
    <div
      className="relative"
      onMouseEnter={() => timeLocked && setShowInfo(true)}
      onMouseLeave={() => setShowInfo(false)}
    >
      <div
        role="button"
        tabIndex={effectiveLocked && !timeLocked ? -1 : 0}
        onClick={timeLocked ? () => setShowInfo(v => !v) : onClick}
        onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && !(effectiveLocked && !timeLocked)) {
            event.preventDefault()
            if (timeLocked) setShowInfo(value => !value)
            else onClick()
          }
        }}
        aria-disabled={effectiveLocked && !timeLocked}
        className={`min-h-[110px] w-full rounded-2xl border p-4 text-left transition-all ${
          effectiveLocked
            ? 'cursor-not-allowed border-white/54 bg-white/38 opacity-55'
            : 'border-white/70 bg-white/68 shadow-[0_12px_30px_rgba(87,119,185,0.08)] hover:border-[#c7d2fe] hover:bg-white active:scale-[0.98]'
        }`}
        style={{ touchAction: 'manipulation' }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f6ff] px-2 py-1 text-[10px] font-black text-[#4252ff]">
            <CalendarDays className="h-3 w-3" />
            Day {day.dayNumber}
          </span>
          <StatusPill status={day.status} hasMp4={!!day.mp4Url} />
        </div>
        <p className="line-clamp-2 text-sm font-black leading-5 text-[#111827]">{day.title}</p>
        {day.status === 'rendering' && (
          <div className="mt-3" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-black text-[#4252ff]">
                영상 제작 중 {day.renderProgress ?? 1}% · {day.renderStage || '준비 중'}
              </span>
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling || day.renderCancelRequested}
                className="shrink-0 rounded-lg bg-[#fff1f0] px-2 py-1 text-[10px] font-black text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-50"
              >
                {cancelling || day.renderCancelRequested ? '중단 중' : '중단'}
              </button>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
              <div
                className="h-full rounded-full bg-[#4252ff] transition-[width] duration-500"
                style={{ width: `${Math.max(1, Math.min(100, day.renderProgress ?? 1))}%` }}
              />
            </div>
          </div>
        )}
        <p className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#94a3b8]">
          {effectiveLocked ? <Lock className="h-3 w-3" /> : day.mp4Url ? <Video className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {timeLocked
            ? <><Clock className="h-3 w-3 ml-0.5" />{msToHHMM(remaining)} 후 오픈</>
            : effectiveLocked ? '하루에 하나씩 오픈됩니다'
            : day.mp4Url ? '영상 완성 — 클릭해서 보기'
            : '클릭해서 영상 제작 시작'}
        </p>
      </div>

      {/* Countdown tooltip — hover on desktop, tap-toggle on mobile */}
      {timeLocked && showInfo && (
        <div className="pointer-events-none absolute inset-x-0 top-full z-30 mt-2">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2 text-amber-700">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <p className="text-xs font-black">{msToHHMM(remaining)} 후 오픈</p>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-amber-600">
              유튜브 알고리즘 특성상 하루에 여러 개를 올리면 노출에 불리합니다. 하루 1편을 꾸준히 올리는 게 가장 효과적입니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Day Production Modal ─────────────────────────────────────────────────────

const STEPS = [
  { id: 'script', label: '스크립트 생성', pct: 20 },
  { id: 'clips', label: '영상 소스 검색', pct: 30 },
  { id: 'tts', label: 'TTS 음성 녹음', pct: 45 },
  { id: 'render', label: '씬별 영상 렌더링', pct: 90 },
  { id: 'save', label: '저장 및 완료', pct: 100 },
]

function DayProductionModal({
  day,
  onClose,
  onDone,
  onUploaded,
}: {
  day: PlannerDay
  onClose: () => void
  onDone: (updated: Partial<PlannerDay>) => void
  onUploaded: () => void
}) {
  const [phase, setPhase] = useState<ModalPhase>(() => day.mp4Url ? 'done' : day.status === 'rendering' ? 'rendering' : 'planning')
  const [pct, setPct] = useState(() => day.mp4Url ? 100 : day.renderProgress ?? 0)
  const [stepLabel, setStepLabel] = useState('준비 중...')
  const [resultDay, setResultDay] = useState<PlannerDay>(day)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [downloadPct, setDownloadPct] = useState<number | null>(null)
  const [uploadedDone, setUploadedDone] = useState(day.status === 'uploaded')

  const renderStartedAt = useRef<number | null>(null)
  const pctRef = useRef(pct)
  pctRef.current = pct

  // Smooth progress ticker during rendering
  useEffect(() => {
    if (phase !== 'rendering') return
    const sceneCount = resultDay.scenes?.length || 6
    const estimatedMs = sceneCount * 28_000

    const interval = setInterval(() => {
      const elapsed = renderStartedAt.current ? Date.now() - renderStartedAt.current : 0
      const renderPct = Math.min(88, (elapsed / estimatedMs) * 65)
      const total = 30 + renderPct
      if (pctRef.current < total) setPct(Math.min(Math.floor(total), 88))
    }, 600)
    return () => clearInterval(interval)
  }, [phase, resultDay.scenes?.length])

  useEffect(() => {
    if (day.mp4Url) { setResultDay(day); setPhase('done'); setPct(100); return }
    if (day.status === 'rendering') return
    void runPipeline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runPipeline = async () => {
    try {
      if (!day.script) {
        setPhase('planning')
        setStepLabel('스크립트 생성 중...')
        setPct(5)
        const planTicker = setInterval(() => { setPct(prev => prev < 24 ? prev + 1 : prev) }, 400)
        const res = await fetch(`/api/youtube-automation/days/${day.id}/start`, { method: 'POST' })
        clearInterval(planTicker)
        const data = await readApiJson<{ day?: Partial<PlannerDay>; error?: string }>(res)
        if (!res.ok || !data.day) throw new Error(data.error || '제작안을 만들지 못했습니다.')
        const planned = { ...day, ...data.day } as PlannerDay
        setResultDay(planned)
        setStepLabel('영상 소스 검색 완료')
        setPct(30)
        await sleep(400)
        await runRender(planned)
      } else {
        setResultDay(day)
        setPct(30)
        await runRender(day)
      }
    } catch (err) {
      setPhase('error')
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const runRender = async (dayData: PlannerDay) => {
    setPhase('rendering')
    renderStartedAt.current = Date.now()
    const sceneCount = dayData.scenes?.length || 6

    let labelTimer: ReturnType<typeof setTimeout> | undefined
    const labelSteps = [
      { delay: 200, label: 'TTS 음성 녹음 중...' },
      ...Array.from({ length: sceneCount }, (_, i) => ({
        delay: 800 + i * Math.round(28_000 / sceneCount),
        label: `Scene ${i + 1}/${sceneCount} 렌더링 중...`,
      })),
      { delay: 0, label: '저장 중...' },
    ]
    const scheduleLabels = (steps: typeof labelSteps) => {
      if (steps.length === 0) return
      const [head, ...tail] = steps
      labelTimer = setTimeout(() => { setStepLabel(head.label); scheduleLabels(tail) }, head.delay)
    }
    scheduleLabels(labelSteps)

    try {
      const res = await fetch(`/api/youtube-automation/days/${dayData.id}/render`, { method: 'POST' })
      clearTimeout(labelTimer)
      const data = await readApiJson<{ day?: Partial<PlannerDay>; error?: string }>(res)
      if (!res.ok || !data.day) throw new Error(data.error || '렌더링을 완료하지 못했습니다.')

      const queued = { ...dayData, ...data.day } as PlannerDay
      setResultDay(queued)
      onDone(queued)
      setStepLabel('완료!')
      setPct(queued.renderProgress ?? 1)
    } catch (err) {
      clearTimeout(labelTimer)
      throw err
    }
  }

  const handleDownload = async () => {
    if (!resultDay.mp4Url) return
    try {
      setDownloadPct(0)
      const res = await fetch(resultDay.mp4Url)
      const contentLength = Number(res.headers.get('content-length') || 0)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('스트림을 열 수 없습니다.')

      const chunks: Uint8Array<ArrayBuffer>[] = []
      let received = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (contentLength > 0) {
          setDownloadPct(Math.min(99, Math.round((received / contentLength) * 100)))
        } else {
          setDownloadPct(prev => (prev === null ? 30 : prev < 70 ? prev + 2 : 30))
        }
      }
      setDownloadPct(100)
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' })
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `${resultDay.title.replace(/\s+/g, '-').slice(0, 40)}-day${resultDay.dayNumber}.mp4`
      a.click()
      URL.revokeObjectURL(objUrl)
      await sleep(600)
      setDownloadPct(null)
    } catch { setDownloadPct(null) }
  }

  const handleUploaded = async () => {
    await onUploaded()
    setUploadedDone(true)
  }

  const providers = useMemo(() => {
    const set = new Set((resultDay.sourceClips || []).map(c => c.provider).filter(p => p !== 'mock'))
    return Array.from(set)
  }, [resultDay.sourceClips])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_32px_90px_rgba(15,23,42,0.32)] sm:rounded-[28px]">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4252ff]">Day {resultDay.dayNumber}</p>
            <h2 className="truncate text-base font-black text-[#111827]">{resultDay.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* In-progress */}
          {(phase === 'planning' || phase === 'rendering') && (
            <div className="flex flex-col items-center px-4 py-8 sm:px-6 sm:py-10">
              <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="44" fill="none" stroke="#4252ff" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                </svg>
                <span className="text-2xl font-black text-[#111827]">{pct}%</span>
              </div>
              <p className="mt-4 text-sm font-black text-[#111827]">{stepLabel}</p>
              <p className="mt-1 px-4 text-center text-xs font-semibold text-[#94a3b8]">
                {phase === 'planning' ? '스크립트와 영상 소스를 준비하고 있습니다' : `TTS 녹음 및 씬별 영상을 렌더링합니다 (${resultDay.scenes?.length || 6}개 씬)`}
              </p>
              {/* Step tracker — horizontally scrollable on very small screens */}
              <div className="mt-6 w-full overflow-x-auto px-2 pb-1">
                <div className="flex min-w-max items-center mx-auto w-fit">
                  {STEPS.map((step, i) => {
                    const done = pct >= step.pct
                    const active = !done && (i === 0 || pct >= STEPS[i - 1].pct)
                    return (
                      <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-black transition-all duration-300 ${
                            done ? 'border-[#4252ff] bg-[#4252ff] text-white'
                              : active ? 'border-[#4252ff] bg-white text-[#4252ff]'
                              : 'border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]'
                          }`}>
                            {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{i + 1}</span>}
                          </div>
                          <p className={`w-[62px] text-center text-[9px] font-bold leading-3 ${done || active ? 'text-[#4252ff]' : 'text-[#c4cdd8]'}`}>
                            {step.label}
                          </p>
                        </div>
                        {i < STEPS.length - 1 && (
                          <div className={`mb-4 h-0.5 w-5 shrink-0 transition-all duration-300 ${pct >= step.pct ? 'bg-[#4252ff]' : 'bg-[#e2e8f0]'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff1f0] text-[#dc2626]">
                <X className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-black text-[#111827]">제작에 실패했습니다</p>
              <p className="mt-2 max-w-[380px] text-xs font-semibold leading-5 text-[#64748b]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => { setPhase('planning'); setPct(0); setErrorMsg(null); void runPipeline() }}
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-[#111827] px-5 text-xs font-black text-white hover:bg-[#1f2937]"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && resultDay.mp4Url && (
            <div
              className="px-4 pb-6 pt-5 sm:px-5"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
              <div className="overflow-hidden rounded-2xl bg-black shadow-[0_16px_42px_rgba(15,23,42,0.22)]">
                <video
                  src={resultDay.mp4Url}
                  poster={resultDay.thumbnailUrl || undefined}
                  controls
                  playsInline
                  className="mx-auto block w-full"
                  style={{ maxHeight: '48dvh', maxWidth: 360 }}
                />
              </div>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloadPct !== null}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#4252ff] text-sm font-black text-white transition-colors hover:bg-[#3443d4] disabled:opacity-70"
                style={{ touchAction: 'manipulation' }}
              >
                {downloadPct !== null ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />다운로드 {downloadPct}%</>
                ) : (
                  <><Download className="h-4 w-4" />MP4 다운로드</>
                )}
              </button>

              <button
                type="button"
                onClick={handleUploaded}
                disabled={uploadedDone}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white text-xs font-black text-[#334155] transition-colors hover:bg-[#f8fafc] disabled:opacity-60"
                style={{ touchAction: 'manipulation' }}
              >
                {uploadedDone
                  ? <><Check className="h-3.5 w-3.5 text-emerald-500" />업로드 완료됨</>
                  : <><Upload className="h-3.5 w-3.5" />유튜브에 업로드 완료</>}
              </button>

              {resultDay.script && (
                <details className="mt-4 rounded-2xl border border-[#e5e7eb] bg-[#f8fafc]">
                  <summary
                    className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-black text-[#334155]"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Mic2 className="h-3.5 w-3.5 text-[#4252ff]" />
                    스크립트 및 업로드 메타데이터
                  </summary>
                  <div className="space-y-3 border-t border-[#e5e7eb] px-4 py-3">
                    <p className="whitespace-pre-line text-xs font-semibold leading-5 text-[#334155]">{resultDay.script}</p>
                    {resultDay.description && <p className="text-xs font-semibold leading-5 text-[#64748b]">{resultDay.description}</p>}
                    {(resultDay.tags || []).length > 0 && (
                      <p className="text-xs font-black text-[#4252ff]">{(resultDay.tags || []).map(t => `#${t}`).join(' ')}</p>
                    )}
                    {resultDay.pinnedComment && (
                      <p className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#64748b]">
                        📌 {resultDay.pinnedComment}
                      </p>
                    )}
                  </div>
                </details>
              )}

              {providers.length > 0 && (
                <p className="mt-4 text-center text-[10px] font-semibold text-[#c4cdd8]">
                  영상 출처: {providers.map(p => p === 'pexels' ? 'Pexels' : 'Pixabay').join(', ')}
                </p>
              )}
            </div>
          )}

          {phase === 'done' && !resultDay.mp4Url && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <p className="text-sm font-bold text-[#64748b]">영상이 아직 준비되지 않았습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusPill({ status, hasMp4 }: { status: string; hasMp4: boolean }) {
  if (hasMp4 && status !== 'uploaded') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-600"><Check className="h-3 w-3" />완성</span>
  }
  const map: Record<string, { label: string; tone: string }> = {
    locked:    { label: '잠김',    tone: 'bg-[#f1f5f9] text-[#94a3b8]' },
    open:      { label: '오픈',    tone: 'bg-[#eef2ff] text-[#4252ff]' },
    planning:  { label: '생성중',  tone: 'bg-amber-50 text-amber-600' },
    rendering: { label: '렌더링', tone: 'bg-violet-50 text-violet-600' },
    ready:     { label: '준비됨',  tone: 'bg-[#eef2ff] text-[#4252ff]' },
    completed: { label: '완성',    tone: 'bg-emerald-50 text-emerald-600' },
    uploaded:  { label: '업로드',  tone: 'bg-emerald-50 text-emerald-600' },
    failed:    { label: '실패',    tone: 'bg-red-50 text-red-500' },
  }
  const { label, tone } = map[status] || { label: status, tone: 'bg-[#f1f5f9] text-[#94a3b8]' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${tone}`}>
      {(status === 'uploaded' || status === 'completed') && <Check className="h-3 w-3" />}
      {label}
    </span>
  )
}
