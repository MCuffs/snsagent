'use client'

import Image from 'next/image'
import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Clapperboard,
  Download,
  FileVideo2,
  MonitorUp,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { FIXTURE_CATEGORIES } from './fixtures'
import {
  formatDuration,
  formatViews,
  generateClips,
  isLongform,
  isReusable,
} from './pipeline'
import type { TrendingResult } from './trending'
import type {
  CommentSource,
  PipelineEvent,
  ShortClip,
  TrendingVideo,
} from './types'

const MONTHLY_QUOTA_MIN = 60
const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_SOURCE_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const BROWSER_CAPTURE_SEC = 35
// 재생 시작 후 유튜브 임베드 오버레이(제목·로고·컨트롤)가 사라질 때까지 기다리는 시간
const OVERLAY_SETTLE_MS = 3800

const COMMENT_SOURCE_LABEL: Record<CommentSource, string> = {
  'youtube-api': '유튜브 인기 댓글 반영',
  fixture: '댓글 조회 실패로 제목·음성 중심 분석',
  none: '제목·음성 중심 분석',
}

export default function ShortsLab({
  initial,
  userId,
  embedded = false,
}: {
  initial: TrendingResult
  userId: string
  embedded?: boolean
}) {
  const [trending, setTrending] = useState(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [category, setCategory] = useState('전체')
  const [onlyReusable, setOnlyReusable] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  const [resultVideo, setResultVideo] = useState<TrendingVideo | null>(null)
  const [resultClip, setResultClip] = useState<ShortClip | null>(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [engine, setEngine] = useState('')
  const [commentSource, setCommentSource] = useState<CommentSource | null>(null)
  const [commentNotice, setCommentNotice] = useState<string | null>(null)
  const [spentMinutes, setSpentMinutes] = useState(0)
  const [requiresSourceUpload, setRequiresSourceUpload] = useState(false)
  const [uploadingSource, setUploadingSource] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureState, setCaptureState] = useState<'idle' | 'requesting' | 'recording'>('idle')
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [captureStartSec, setCaptureStartSec] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const captureFrameRef = useRef<HTMLIFrameElement | null>(null)

  const { videos, mode, notice, fetchedAtLabel, criteriaLabel } = trending

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setListError(null)
    try {
      const response = await fetch('/api/shorts-lab/trending', { cache: 'no-store' })
      if (!response.ok) throw new Error(`목록 로딩 실패 (${response.status})`)
      setTrending((await response.json()) as TrendingResult)
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      setRefreshing(false)
    }
  }, [])

  const categories = useMemo(() => {
    if (mode === 'fixture') return [...FIXTURE_CATEGORIES]
    return ['전체', ...[...new Set(videos.map(video => video.category))].sort()]
  }, [mode, videos])

  const filtered = useMemo(
    () =>
      videos.filter(video => {
        if (category !== '전체' && video.category !== category) return false
        if (onlyLongform && !isLongform(video)) return false
        if (onlyReusable && !isReusable(video)) return false
        return true
      }),
    [videos, category, onlyLongform, onlyReusable],
  )
  const reusableCount = useMemo(() => videos.filter(isReusable).length, [videos])
  const longformCount = useMemo(() => videos.filter(isLongform).length, [videos])
  const selected = useMemo(
    () => filtered.find(video => video.id === selectedId) ?? null,
    [filtered, selectedId],
  )
  const canGenerate =
    Boolean(selected) &&
    selected?.source === 'youtube-api' &&
    isReusable(selected) &&
    isLongform(selected) &&
    selected.embeddable &&
    !selected.regionBlocked &&
    !generating &&
    !uploadingSource &&
    !captureOpen

  const selectVideo = useCallback((id: string) => {
    setSelectedId(id)
    setGenError(null)
    setResultVideo(null)
    setResultClip(null)
    setDownloadUrl('')
    setRequiresSourceUpload(false)
    setUploadProgress(0)
    setUploadError(null)
    setCaptureOpen(false)
    setCaptureState('idle')
    setCaptureError(null)
  }, [])

  const generate = useCallback(async (sourceUrl?: string, sourceKind?: 'capture' | 'file') => {
    if (!selected) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setProgressLabel('제목과 댓글을 읽고 있어요')
    setGenError(null)
    setResultVideo(null)
    setResultClip(null)
    setDownloadUrl('')

    const handle = (event: PipelineEvent) => {
      if (event.type === 'stage') {
        setProgressLabel(event.label)
      } else if (event.type === 'result') {
        setResultVideo(event.video)
        setResultClip(event.clips[0] ?? null)
        setDownloadUrl(event.downloadUrl)
        setFileName(event.fileName)
        setEngine(event.engine)
        setCommentSource(event.commentSource)
        setCommentNotice(event.commentNotice)
        setSpentMinutes(previous => Math.round((previous + event.usedMinutes) * 10) / 10)
        setRequiresSourceUpload(false)
      } else {
        setGenError(event.message)
        if (event.code === 'SOURCE_BLOCKED') {
          setRequiresSourceUpload(true)
        }
      }
    }

    try {
      const response = await fetch('/api/shorts-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: selected,
          ...(sourceUrl ? { sourceUrl, sourceKind: sourceKind ?? 'file' } : {}),
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? `생성 실패 (${response.status})`)
      }
      if (!response.body) throw new Error('생성 결과를 읽을 수 없습니다.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim()) handle(JSON.parse(line) as PipelineEvent)
        }
      }
      if (buffer.trim()) handle(JSON.parse(buffer) as PipelineEvent)
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        setGenError(error instanceof Error ? error.message : String(error))
      }
    } finally {
      setGenerating(false)
    }
  }, [selected])

  const uploadSourceAndGenerate = useCallback(async (
    file: File,
    sourceKind: 'capture' | 'file' = 'file',
  ) => {
    if (!selected) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowedByExtension = extension && ['mp4', 'mov', 'webm'].includes(extension)
    if (!ALLOWED_SOURCE_TYPES.has(file.type) && !allowedByExtension) {
      setUploadError('MP4, MOV 또는 WebM 영상만 올릴 수 있습니다.')
      return
    }
    if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
      setUploadError('원본 영상은 2GB 이하여야 합니다.')
      return
    }

    setUploadingSource(true)
    setUploadProgress(0)
    setUploadError(null)
    setGenError(null)

    try {
      const { upload } = await import('@vercel/blob/client')
      const safeName = file.name
        .normalize('NFKC')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .slice(-100)
      const pathname = `uploads/shorts-lab/${userId}/${crypto.randomUUID()}-${safeName}`
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/shorts-lab/source-upload',
        multipart: true,
        contentType: file.type || (extension === 'webm' ? 'video/webm' : 'video/mp4'),
        onUploadProgress: progress => setUploadProgress(Math.round(progress.percentage)),
      })

      setUploadingSource(false)
      await generate(blob.url, sourceKind)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '원본 업로드에 실패했습니다.')
      setUploadingSource(false)
    }
  }, [generate, selected, userId])

  const openBrowserCapture = useCallback(() => {
    if (!selected) return
    const suggested = generateClips(selected, [])[0]
    setCaptureStartSec(suggested?.startSec ?? Math.round(selected.durationSec * 0.08))
    setCaptureError(null)
    setCaptureState('idle')
    setCaptureOpen(true)
  }, [selected])

  const startBrowserCapture = useCallback(async () => {
    if (!selected || !captureFrameRef.current) return
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      setCaptureError('이 브라우저는 탭 캡처를 지원하지 않습니다. 최신 Chrome에서 다시 시도해 주세요.')
      return
    }

    setCaptureState('requesting')
    setCaptureError(null)
    let stream: MediaStream | null = null
    try {
      const options = {
        video: { displaySurface: 'browser', frameRate: 30 },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
      } as DisplayMediaStreamOptions
      stream = await navigator.mediaDevices.getDisplayMedia(options)
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(track => track.stop())
        throw new Error('탭 오디오가 선택되지 않았습니다. “탭 오디오 공유”를 켜고 다시 시도해 주세요.')
      }

      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) ?? ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      const stopped = new Promise<void>((resolve, reject) => {
        recorder.onstop = () => resolve()
        recorder.onerror = () => reject(new Error('브라우저 녹화 중 오류가 발생했습니다.'))
      })

      const waitOnStream = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, ms)
          const videoTrack = stream?.getVideoTracks()[0]
          videoTrack?.addEventListener('ended', () => {
            window.clearTimeout(timer)
            reject(new Error('탭 공유가 중간에 종료되었습니다. 다시 시도해 주세요.'))
          }, { once: true })
        })

      setCaptureState('recording')
      captureFrameRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [captureStartSec, true] }),
        'https://www.youtube.com',
      )
      captureFrameRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        'https://www.youtube.com',
      )

      // 재생 시작 직후에는 유튜브 임베드의 제목·로고·컨트롤 오버레이가 영상 위에
      // 몇 초간 떠 있으므로, 오버레이가 사라진 뒤에 녹화를 시작합니다.
      await waitOnStream(OVERLAY_SETTLE_MS)
      recorder.start(1000)
      await waitOnStream(BROWSER_CAPTURE_SEC * 1000)
      recorder.stop()
      await stopped
      stream.getTracks().forEach(track => track.stop())
      stream = null

      const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
      if (blob.size === 0) throw new Error('캡처된 영상이 비어 있습니다. 다시 시도해 주세요.')
      const file = new File(
        [blob],
        `shuffla-capture-${selected.id}-${captureStartSec}.webm`,
        { type: 'video/webm' },
      )
      setCaptureOpen(false)
      setCaptureState('idle')
      await uploadSourceAndGenerate(file, 'capture')
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      setCaptureState('idle')
      setCaptureError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '탭 공유가 취소되었습니다. 현재 Shuffla 탭을 선택해 주세요.'
          : error instanceof Error
            ? error.message
            : '브라우저 캡처에 실패했습니다.',
      )
    }
  }, [captureStartSec, selected, uploadSourceAndGenerate])

  const quotaPct = Math.min(100, (spentMinutes / MONTHLY_QUOTA_MIN) * 100)

  return (
    <div className={`sl-root ${embedded ? 'is-embedded' : ''}`}>
      <div className="sl-ambient" aria-hidden="true" />
      <header className="sl-header">
        <div className="sl-header-left">
          <span className="sl-logo">
            <span className="sl-logo-mark"><Clapperboard aria-hidden="true" /></span>
            <span>Shorts Lab</span>
            <span className="sl-beta">BETA</span>
          </span>
          <span className={`sl-mode sl-mode-${mode}`}>
            {mode === 'youtube-api' ? 'LIVE · YouTube Data API' : 'DEMO · 픽스처 데이터'}
          </span>
        </div>
        <div className="sl-header-right">
          <div className="sl-quota">
            <div className="sl-quota-label">
              <span>원본 처리시간 사용량</span>
              <strong>{spentMinutes} / {MONTHLY_QUOTA_MIN}분</strong>
            </div>
            <div className="sl-quota-track">
              <div className="sl-quota-fill" style={{ width: `${quotaPct}%` }} />
            </div>
          </div>
          <button
            type="button"
            className="sl-btn-ghost"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw className={refreshing ? 'is-spinning' : undefined} aria-hidden="true" />
            {refreshing ? '불러오는 중…' : '목록 새로고침'}
          </button>
        </div>
      </header>

      {notice && <div className="sl-notice">{notice}</div>}

      <div className="sl-intro">
        <span className="sl-kicker"><Sparkles aria-hidden="true" />AI SHORTS MAKER</span>
        <h1>영상 하나만 고르면, 업로드할 쇼츠가 완성됩니다.</h1>
        <p>Shuffla가 원본 제목·인기 댓글·음성을 분석해 후킹 구간과 제목을 자동으로 만듭니다.</p>
      </div>

      <div className="sl-grid sl-simple-grid">
        <section className="sl-panel sl-source-panel">
          <div className="sl-panel-head">
            <div>
              <span className="sl-panel-kicker">1 · PICK A VIDEO</span>
              <h2>재사용 가능한 인기 롱폼</h2>
            </div>
            <span className="sl-muted-xs">{fetchedAtLabel}</span>
          </div>

          <div className="sl-filters">
            <label className="sl-check">
              <input
                type="checkbox"
                checked={onlyReusable}
                onChange={event => setOnlyReusable(event.target.checked)}
              />
              <span>재사용 허용만 (CC)<b>{reusableCount}개</b></span>
            </label>
            <label className="sl-check">
              <input
                type="checkbox"
                checked={onlyLongform}
                onChange={event => setOnlyLongform(event.target.checked)}
              />
              <span>롱폼만 (3~60분)<b>{longformCount}개</b></span>
            </label>
            <select
              className="sl-select"
              value={category}
              onChange={event => setCategory(event.target.value)}
            >
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="sl-count">
            <span>{filtered.length}개 / 전체 {videos.length}개</span>
            <em>{criteriaLabel}</em>
          </div>
          {listError && <div className="sl-error">{listError}</div>}

          <ul className="sl-list">
            {filtered.map(video => (
              <li key={video.id}>
                <button
                  type="button"
                  className={`sl-item ${video.id === selectedId ? 'is-active' : ''}`}
                  onClick={() => selectVideo(video.id)}
                >
                  <span className="sl-item-thumb">
                    {video.thumbnailUrl ? (
                      <Image
                        src={video.thumbnailUrl}
                        alt=""
                        fill
                        sizes="176px"
                        unoptimized
                      />
                    ) : (
                      <span className="sl-item-thumb-fallback" aria-hidden="true">
                        <Clapperboard />
                      </span>
                    )}
                    <span className="sl-item-dur">{formatDuration(video.durationSec)}</span>
                  </span>
                  <span className="sl-item-copy">
                    <span className="sl-item-top">
                      {isReusable(video) && <span className="sl-badge-cc">재사용 허용</span>}
                      <span className="sl-item-category">{video.category}</span>
                    </span>
                    <span className="sl-item-title">{video.title}</span>
                    <span className="sl-item-meta">
                      {video.channelTitle} · 조회수 {formatViews(video.viewCount)} · {video.publishedLabel}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="sl-empty">조건에 맞는 영상이 없습니다. 필터를 완화해 보세요.</li>
            )}
          </ul>
        </section>

        <section className="sl-panel sl-maker-panel">
          <div className="sl-panel-head">
            <div>
              <span className="sl-panel-kicker">2 · MAKE A SHORT</span>
              <h2>AI 숏폼 만들기</h2>
            </div>
          </div>

          {!selected ? (
            <div className="sl-simple-empty">
              <span className="sl-ai-avatar"><Sparkles aria-hidden="true" /></span>
              <strong>왼쪽에서 영상 하나를 골라주세요</strong>
              <p>나머지는 Shuffla가 알아서 완성합니다.</p>
            </div>
          ) : (
            <>
              <div className="sl-selected sl-selected-simple">
                <span className="sl-message-label">선택한 원본</span>
                <p className="sl-selected-title">{selected.title}</p>
                <p className="sl-item-meta">
                  {selected.channelTitle} · {formatDuration(selected.durationSec)}
                </p>
                <div className="sl-ready-row">
                  <span className={isReusable(selected) ? 'is-ready' : 'is-blocked'}>
                    {isReusable(selected) ? '✓ 재사용 허용 확인' : '재사용이 허용되지 않은 영상'}
                  </span>
                  <span>제목 + 댓글 + 음성 분석</span>
                </div>
              </div>

              {!downloadUrl && (
                <div className="sl-one-click">
                  <div className="sl-one-click-copy">
                    <span className="sl-free-pill">무료 · 설치 없음</span>
                    <strong>원본 파일 없이 브라우저에서 만들기</strong>
                    <p>
                      현재 탭의 추천 구간만 35초 캡처합니다. 외부 영상 API 비용 없이
                      제목·댓글 분석과 9:16 MP4 제작을 이어갑니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sl-btn-primary sl-btn-create"
                    disabled={!canGenerate}
                    onClick={openBrowserCapture}
                  >
                    {uploadingSource ? (
                      <><RefreshCw className="is-spinning" aria-hidden="true" />캡처 전송 중 {uploadProgress}%</>
                    ) : generating ? (
                      <><RefreshCw className="is-spinning" aria-hidden="true" />숏폼 만드는 중…</>
                    ) : (
                      <><MonitorUp aria-hidden="true" />브라우저로 무료 만들기</>
                    )}
                  </button>
                  {canGenerate && (
                    <button
                      type="button"
                      className="sl-btn-auto-source"
                      disabled={generating || uploadingSource}
                      onClick={() => void generate()}
                    >
                      YouTube 자동 가져오기 시도
                    </button>
                  )}
                  {!isReusable(selected) && (
                    <p className="sl-rights-note">Creative Commons 재사용 허용 영상만 만들 수 있습니다.</p>
                  )}
                </div>
              )}

              {generating && (
                <div className="sl-compact-progress" role="status">
                  <span className="sl-progress-orbit"><Sparkles aria-hidden="true" /></span>
                  <div>
                    <strong>{progressLabel}</strong>
                    <p>완성되면 바로 미리보기와 다운로드 버튼이 나타납니다.</p>
                  </div>
                </div>
              )}

              {uploadingSource && (
                <div className="sl-compact-progress sl-upload-progress" role="status">
                  <span className="sl-progress-orbit"><UploadCloud aria-hidden="true" /></span>
                  <div className="sl-progress-copy">
                    <strong>캡처가 끝났어요 · 영상 전송 중 {uploadProgress}%</strong>
                    <p>전송이 끝나면 제목·댓글·음성 분석과 숏폼 제작이 자동으로 시작됩니다.</p>
                    <div className="sl-source-upload-track" aria-hidden="true">
                      <span style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {genError && <div className="sl-error">{genError}</div>}
              {uploadError && !requiresSourceUpload && (
                <div className="sl-error">
                  캡처 영상 전송 실패: {uploadError}
                </div>
              )}

              {requiresSourceUpload && !downloadUrl && (
                <div className="sl-source-fallback">
                  <span className="sl-source-fallback-icon"><FileVideo2 aria-hidden="true" /></span>
                  <div className="sl-source-fallback-copy">
                    <strong>원본 파일로 바로 이어서 만들 수 있어요</strong>
                    <p>
                      YouTube가 서버 다운로드만 차단했습니다. 보유한 원본 MP4를 올리면
                      제목·댓글 분석 결과는 그대로 사용해 자동 제작을 계속합니다.
                    </p>
                  </div>
                  <label className={`sl-source-upload ${uploadingSource || generating ? 'is-disabled' : ''}`}>
                    <UploadCloud aria-hidden="true" />
                    <span>
                      {uploadingSource
                        ? `원본 업로드 중 ${uploadProgress}%`
                        : generating
                          ? '숏폼 만드는 중…'
                          : '원본 영상 선택'}
                    </span>
                    <input
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                      disabled={uploadingSource || generating}
                      onChange={event => {
                        const file = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (file) void uploadSourceAndGenerate(file)
                      }}
                    />
                  </label>
                  {(uploadingSource || generating) && (
                    <div className="sl-source-upload-track">
                      <span style={{ width: `${uploadingSource ? uploadProgress : 100}%` }} />
                    </div>
                  )}
                  <small>MP4·MOV·WebM · 최대 2GB · 브라우저에서 저장소로 직접 전송</small>
                  {uploadError && <div className="sl-error">{uploadError}</div>}
                </div>
              )}

              {downloadUrl && resultVideo && resultClip && (
                <div className="sl-finished">
                  <div className="sl-finished-head">
                    <span><CheckCircle2 aria-hidden="true" />숏폼이 완성됐어요</span>
                    <button type="button" onClick={() => void generate()}>다시 만들기</button>
                  </div>
                  <div className="sl-video-result">
                    <video controls playsInline preload="metadata" src={downloadUrl}>
                      브라우저가 영상 재생을 지원하지 않습니다.
                    </video>
                  </div>
                  <div className="sl-hook-result">
                    <span>생성된 후킹 제목</span>
                    <h3>{resultClip.hookTitle}</h3>
                    <p>
                      {formatDuration(resultClip.startSec)}–{formatDuration(resultClip.endSec)}
                      {' · '}{resultClip.reason}
                    </p>
                  </div>
                  <a className="sl-download-btn" href={downloadUrl} download={fileName}>
                    <Download aria-hidden="true" />MP4 다운로드
                  </a>
                  <div className="sl-result-foot">
                    <span>{commentSource ? COMMENT_SOURCE_LABEL[commentSource] : 'AI 분석 완료'}</span>
                    <span>{engine}</span>
                    {commentNotice && <em>{commentNotice}</em>}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* CMS 탭 패널은 transform-gpu 조상이라 position:fixed가 패널에 갇힙니다.
          탭 캡처가 항상 화면 전체를 덮도록 body로 포털합니다. */}
      {captureOpen && selected && createPortal(
        <div className={`sl-capture-stage ${captureState === 'recording' ? 'is-recording' : ''}`}>
          <iframe
            ref={captureFrameRef}
            src={`https://www.youtube.com/embed/${encodeURIComponent(selected.id)}?enablejsapi=1&playsinline=1&controls=0&rel=0&iv_load_policy=3&start=${captureStartSec}`}
            title={`${selected.title} 캡처 미리보기`}
            allow="autoplay; encrypted-media; picture-in-picture"
          />
          {captureState !== 'recording' && (
            <div className="sl-capture-card">
              <button
                type="button"
                className="sl-capture-close"
                onClick={() => setCaptureOpen(false)}
                aria-label="닫기"
              >
                <X aria-hidden="true" />
              </button>
              <span className="sl-free-pill">브라우저 무료 캡처</span>
              <h2>{formatDuration(captureStartSec)}부터 {BROWSER_CAPTURE_SEC}초만 가져옵니다</h2>
              <p>
                다음 창에서 <b>현재 Shuffla 탭</b>을 선택하고 <b>탭 오디오 공유</b>를 켜주세요.
                캡처가 끝나면 숏폼 제작이 자동으로 시작됩니다.
              </p>
              <button
                type="button"
                className="sl-btn-primary sl-capture-start"
                disabled={captureState === 'requesting'}
                onClick={() => void startBrowserCapture()}
              >
                {captureState === 'requesting' ? (
                  <><RefreshCw className="is-spinning" aria-hidden="true" />공유 창 여는 중…</>
                ) : (
                  <><MonitorUp aria-hidden="true" />현재 탭 캡처 시작</>
                )}
              </button>
              {captureError && <div className="sl-error">{captureError}</div>}
              <small>Chrome 권장 · Creative Commons 영상에만 제공</small>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
