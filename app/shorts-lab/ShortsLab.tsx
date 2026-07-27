'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import ShortPreview, { TEMPLATES } from './ShortPreview'
import { FIXTURE_CATEGORIES } from './fixtures'
import {
  checkEligibility,
  formatDuration,
  formatViews,
  isLongform,
  isReusable,
  plannedClipCount,
} from './pipeline'
import type { TrendingResult } from './trending'
import type {
  CommentSource,
  PipelineEvent,
  ShortClip,
  StageEvent,
  TemplateId,
  TrendingVideo,
} from './types'

const COMMENT_SOURCE_LABEL: Record<CommentSource, string> = {
  'youtube-api': '실제 유튜브 인기 댓글',
  fixture: '데모 댓글 (폴백)',
  none: '댓글 없음',
}

/** 월 제공량 데모 기준값 — 사용량이 "원본 처리시간"으로 차감되는 걸 보여주기 위한 값 */
const MONTHLY_QUOTA_MIN = 60

export default function ShortsLab({ initial }: { initial: TrendingResult }) {
  const [trending, setTrending] = useState<TrendingResult>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [category, setCategory] = useState('전체')
  // 인기 차트에서 CC 라이선스 영상은 보통 50개 중 0~3개뿐입니다.
  // 기본값을 켜두면 목록이 비어 보이므로 꺼둔 채 개수만 알려줍니다.
  const [onlyReusable, setOnlyReusable] = useState(false)
  const [onlyLongform, setOnlyLongform] = useState(true)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplateId>('comment-capture')
  const [withCommentCapture, setWithCommentCapture] = useState(true)
  const [acknowledgedRights, setAcknowledgedRights] = useState(false)

  const [stages, setStages] = useState<StageEvent[]>([])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [clips, setClips] = useState<ShortClip[]>([])
  const [resultVideo, setResultVideo] = useState<TrendingVideo | null>(null)
  const [activeClip, setActiveClip] = useState(0)
  const [engine, setEngine] = useState('')
  const [commentSource, setCommentSource] = useState<CommentSource | null>(null)
  const [commentNotice, setCommentNotice] = useState<string | null>(null)
  const [spentMinutes, setSpentMinutes] = useState(0)

  const abortRef = useRef<AbortController | null>(null)

  const { videos, mode, notice, fetchedAtLabel } = trending

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setListError(null)
    try {
      const res = await fetch('/api/shorts-lab/trending', { cache: 'no-store' })
      if (!res.ok) throw new Error(`목록 로딩 실패 (${res.status})`)
      setTrending((await res.json()) as TrendingResult)
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error))
    } finally {
      setRefreshing(false)
    }
  }, [])

  const categories = useMemo(() => {
    if (mode === 'fixture') return [...FIXTURE_CATEGORIES]
    return ['전체', ...[...new Set(videos.map(v => v.category))].sort()]
  }, [mode, videos])

  // ── 2단계: 재사용 가능 여부로 필터링 ──────────────────────
  const filtered = useMemo(
    () =>
      videos.filter(v => {
        if (category !== '전체' && v.category !== category) return false
        if (onlyLongform && !isLongform(v)) return false
        if (onlyReusable && !isReusable(v)) return false
        return true
      }),
    [videos, category, onlyLongform, onlyReusable],
  )

  const reusableCount = useMemo(() => videos.filter(isReusable).length, [videos])
  const longformCount = useMemo(() => videos.filter(isLongform).length, [videos])

  // 선택 항목은 파생 값입니다. 필터가 바뀌어 목록에서 빠지면 자동으로 null 이 됩니다.
  const selected = useMemo(
    () => filtered.find(v => v.id === selectedId) ?? null,
    [filtered, selectedId],
  )

  const checks = useMemo(
    () => (selected ? checkEligibility(selected) : []),
    [selected],
  )
  const hardBlocked = checks.some(c => !c.ok && !c.overridable)
  const needsAck = checks.some(c => !c.ok && c.overridable)
  const canGenerate =
    Boolean(selected) && !hardBlocked && (!needsAck || acknowledgedRights) && !generating

  const selectVideo = useCallback((id: string) => {
    setSelectedId(id)
    setAcknowledgedRights(false)
  }, [])

  // ── 3~4단계: 생성 + 스트리밍 진행 ─────────────────────────
  const generate = useCallback(async () => {
    if (!selected) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    setGenError(null)
    setStages([])
    setClips([])
    setResultVideo(null)
    setActiveClip(0)
    setCommentSource(null)
    setCommentNotice(null)

    const handle = (event: PipelineEvent) => {
      if (event.type === 'stage') {
        setStages(prev => {
          const at = prev.findIndex(s => s.id === event.id)
          if (at < 0) return [...prev, event]
          const next = [...prev]
          next[at] = event
          return next
        })
      } else if (event.type === 'result') {
        setClips(event.clips)
        setResultVideo(event.video)
        setEngine(event.engine)
        setCommentSource(event.commentSource)
        setCommentNotice(event.commentNotice)
        setSpentMinutes(prev => Math.round((prev + event.usedMinutes) * 10) / 10)
      } else {
        setGenError(event.message)
      }
    }

    try {
      const res = await fetch('/api/shorts-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video: selected, withCommentCapture, acknowledgedRights }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? `생성 실패 (${res.status})`)
      }
      if (!res.body) throw new Error('스트림을 읽을 수 없습니다')

      const reader = res.body.getReader()
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
  }, [selected, withCommentCapture, acknowledgedRights])

  const previewClip = clips[activeClip] ?? null
  const quotaPct = Math.min(100, (spentMinutes / MONTHLY_QUOTA_MIN) * 100)

  return (
    <div className="sl-root">
      <header className="sl-header">
        <div className="sl-header-left">
          <span className="sl-logo">Shorts Lab</span>
          <span className={`sl-mode sl-mode-${mode}`}>
            {mode === 'youtube-api' ? 'LIVE · YouTube Data API' : 'DEMO · 픽스처 데이터'}
          </span>
        </div>
        <div className="sl-header-right">
          <div className="sl-quota">
            <div className="sl-quota-label">
              <span>원본 처리시간 사용량</span>
              <strong>
                {spentMinutes} / {MONTHLY_QUOTA_MIN}분
              </strong>
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
            {refreshing ? '불러오는 중…' : '목록 새로고침'}
          </button>
        </div>
      </header>

      {notice && <div className="sl-notice">{notice}</div>}

      <div className="sl-grid">
        {/* ── 1·2단계: 인기 영상 + 재사용 필터 ───────────── */}
        <section className="sl-panel">
          <div className="sl-panel-head">
            <h2>
              <span className="sl-step">1</span> 실시간 인기 롱폼
            </h2>
            <span className="sl-muted-xs">{fetchedAtLabel}</span>
          </div>

          <div className="sl-filters">
            <label className="sl-check">
              <input
                type="checkbox"
                checked={onlyReusable}
                onChange={e => setOnlyReusable(e.target.checked)}
              />
              <span>
                재사용 허용만 (CC)
                <b className={reusableCount <= 3 ? 'is-scarce' : undefined}>
                  {reusableCount}개
                </b>
              </span>
            </label>
            <label className="sl-check">
              <input
                type="checkbox"
                checked={onlyLongform}
                onChange={e => setOnlyLongform(e.target.checked)}
              />
              <span>
                롱폼만 (3~60분)
                <b>{longformCount}개</b>
              </span>
            </label>
            <select
              className="sl-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sl-count">
            {filtered.length}개 / 전체 {videos.length}개
          </div>

          {listError && <div className="sl-error">{listError}</div>}

          <ul className="sl-list">
            {filtered.map(v => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`sl-item ${v.id === selectedId ? 'is-active' : ''}`}
                  onClick={() => selectVideo(v.id)}
                >
                  <div className="sl-item-top">
                    <span className="sl-item-dur">{formatDuration(v.durationSec)}</span>
                    {isReusable(v) && <span className="sl-badge-cc">재사용 허용</span>}
                  </div>
                  <p className="sl-item-title">{v.title}</p>
                  <p className="sl-item-meta">
                    {v.channelTitle} · 조회수 {formatViews(v.viewCount)} · {v.publishedLabel}
                  </p>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="sl-empty">조건에 맞는 영상이 없습니다. 필터를 완화해 보세요.</li>
            )}
          </ul>
        </section>

        {/* ── 권리 확인 + 옵션 + 진행 ───────────────────── */}
        <section className="sl-panel">
          <div className="sl-panel-head">
            <h2>
              <span className="sl-step">2</span> 권리 확인 · 생성
            </h2>
          </div>

          {!selected ? (
            <p className="sl-placeholder">왼쪽에서 영상을 선택하세요.</p>
          ) : (
            <>
              <div className="sl-selected">
                <p className="sl-selected-title">{selected.title}</p>
                <p className="sl-item-meta">
                  {selected.channelTitle} · {formatDuration(selected.durationSec)} ·{' '}
                  {selected.category}
                </p>
              </div>

              <ul className="sl-checks">
                {checks.map(c => (
                  <li key={c.id} className={c.ok ? 'is-ok' : 'is-bad'}>
                    <span className="sl-check-icon">{c.ok ? '✓' : '✕'}</span>
                    <div>
                      <strong>{c.label}</strong>
                      <span>{c.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {needsAck && !hardBlocked && (
                <label className="sl-ack">
                  <input
                    type="checkbox"
                    checked={acknowledgedRights}
                    onChange={e => setAcknowledgedRights(e.target.checked)}
                  />
                  <span>
                    이 영상에 대한 적법한 이용 권리를 직접 보유하고 있음을 확인합니다.
                    <em>
                      실제 서비스라면 이 체크가 책임을 이용자에게 넘기는 지점입니다. 확인만으로
                      플랫폼 약관 위반이 해소되지는 않습니다.
                    </em>
                  </span>
                </label>
              )}

              {hardBlocked && (
                <div className="sl-error">
                  이 영상은 구조적으로 처리 대상이 아닙니다 (길이·퍼가기·지역 제한).
                </div>
              )}

              <div className="sl-options">
                <p className="sl-options-label">템플릿</p>
                <div className="sl-tpl-grid">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`sl-tpl-btn ${template === t.id ? 'is-active' : ''}`}
                      onClick={() => setTemplate(t.id)}
                      title={t.hint}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <label className="sl-check sl-check-lg">
                  <input
                    type="checkbox"
                    checked={withCommentCapture}
                    onChange={e => setWithCommentCapture(e.target.checked)}
                  />
                  <span>
                    댓글 캡처 포함
                    <em>인기 댓글을 쇼츠 화면 안에 얹습니다</em>
                  </span>
                </label>

                <p className="sl-estimate">
                  예상 결과 {plannedClipCount(selected.durationSec)}개 · 차감{' '}
                  {Math.round((selected.durationSec / 60) * 10) / 10}분
                  <em>사용량은 결과물 길이가 아니라 투입한 원본 길이로 차감됩니다.</em>
                </p>

                <button
                  type="button"
                  className="sl-btn-primary"
                  disabled={!canGenerate}
                  onClick={() => void generate()}
                >
                  {generating ? '생성 중…' : '숏폼 만들기'}
                </button>
              </div>

              {stages.length > 0 && (
                <ol className="sl-stages">
                  {stages.map(s => (
                    <li key={s.id} className={`is-${s.status}`}>
                      <span className="sl-stage-dot" />
                      <div>
                        <strong>{s.label}</strong>
                        <span>{s.detail}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {genError && <div className="sl-error">{genError}</div>}
            </>
          )}
        </section>

        {/* ── 결과 + 9:16 프리뷰 ────────────────────────── */}
        <section className="sl-panel">
          <div className="sl-panel-head">
            <h2>
              <span className="sl-step">3</span> 결과
            </h2>
            {clips.length > 0 && <span className="sl-muted-xs">{clips.length}개 생성</span>}
          </div>

          {!resultVideo || !previewClip ? (
            <p className="sl-placeholder">생성하면 여기에 9:16 결과가 나옵니다.</p>
          ) : (
            <>
              <div className="sl-preview-wrap">
                {/* 클립·템플릿이 바뀌면 플레이어 상태를 초기화 */}
                <ShortPreview
                  key={`${previewClip.id}-${template}`}
                  video={resultVideo}
                  clip={previewClip}
                  template={template}
                />
              </div>

              {resultVideo.source === 'youtube-api' && (
                <a
                  className="sl-verify-link"
                  href={`https://www.youtube.com/watch?v=${resultVideo.id}&t=${previewClip.startSec}s`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  유튜브 원본에서 {formatDuration(previewClip.startSec)} 지점 열기 ↗
                </a>
              )}

              <div className="sl-clip-meta">
                <div>
                  <strong>훅 점수 {previewClip.score}</strong>
                  <span>
                    {formatDuration(previewClip.startSec)} – {formatDuration(previewClip.endSec)} (
                    {previewClip.endSec - previewClip.startSec}초)
                  </span>
                </div>
                <p className="sl-clip-reason">{previewClip.reason}</p>
                {previewClip.subtitleLines.length > 0 && (
                  <ul className="sl-subs-draft">
                    {previewClip.subtitleLines.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {commentSource && (
                  <p className={`sl-comment-source is-${commentSource}`}>
                    댓글 출처: {COMMENT_SOURCE_LABEL[commentSource]}
                    {commentNotice && <em>{commentNotice}</em>}
                  </p>
                )}
              </div>

              <div className="sl-clip-tabs">
                {clips.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`sl-clip-tab ${i === activeClip ? 'is-active' : ''}`}
                    onClick={() => setActiveClip(i)}
                  >
                    <span className="sl-clip-tab-idx">#{c.index}</span>
                    <span className="sl-clip-tab-score">{c.score}</span>
                  </button>
                ))}
              </div>

              <p className="sl-engine">
                생성 엔진: {engine}
                <em>
                  이 프리뷰는 합성 미리보기입니다. 실제 mp4 렌더는 원본 다운로드가 필요해 이
                  데모에 포함하지 않았습니다.
                </em>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
