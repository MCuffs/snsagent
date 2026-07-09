import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import OpenAI from 'openai'
// @ffmpeg-installer/ffmpeg has no bundled type declarations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ffmpegInstaller = (await import('@ffmpeg-installer/ffmpeg' as any)).default as { path: string; version: string }
import type { StockVideoCandidate, YouTubeScenePlan } from './automation'
import type { YouTubeShortsTemplateRecord } from '../../../lib/youtube-shorts-templates/types'
import { fitHookText, renderHookOverlay } from './hookRenderer'
import { logYouTubeAutomation, summarizeYouTubeAutomationError } from './logging'
import type { YouTubeTtsVoice } from './ttsVoice'

interface RenderYouTubeShortsParams {
  userId: string
  dayId: string
  title: string
  script: string
  scenes: YouTubeScenePlan[]
  sourceClips: StockVideoCandidate[]
  template?: YouTubeShortsTemplateRecord
  ttsVoice?: YouTubeTtsVoice
  // Absolute wall-clock deadline (ms epoch) the render must finish by — typically the
  // function invocation budget minus a margin. Without it, the platform kills the
  // invocation silently and the day freezes at the last written progress instead of failing cleanly.
  deadlineAt?: number
  checkpoint?: RenderCheckpoint
  onCheckpoint?: (checkpoint: RenderCheckpoint) => Promise<void>
  onProgress?: (progress: number, stage: string) => Promise<void>
  shouldCancel?: () => Promise<boolean>
}

export interface RenderQualityNote {
  type: 'generated_clip' | 'tts_probe_failed' | 'tts_failed'
  sceneNumber?: number
}

// Durable per-scene render progress. Completed TTS/clip assets are uploaded to storage and
// recorded here, so the next invocation resumes from the last finished scene instead of
// restarting from scratch when a run gets requeued or its invocation dies.
export interface RenderSceneCheckpoint {
  sceneNumber: number
  ttsUrl?: string
  ttsDuration?: number
  ttsFailedAttempts?: number
  ttsSilentFallback?: boolean
  ttsProbeFallback?: boolean
  clipUrl?: string
  clipFailedAttempts?: number
  generatedFallback?: boolean
}

export interface RenderCheckpoint {
  version: 1
  ttsProvider?: string
  requeueCount?: number
  scenes: RenderSceneCheckpoint[]
}

// Thrown when the remaining invocation budget cannot fit the next step. The caller requeues
// the day so a fresh invocation continues from the checkpoint — this is progress, not failure.
export class YouTubeRenderRequeueError extends Error {
  constructor() {
    super('함수 실행 시간이 부족해 다음 실행에서 이어서 진행합니다.')
    this.name = 'YouTubeRenderRequeueError'
  }
}

interface StoredRenderedAsset {
  mp4Url: string
  thumbnailUrl: string | null
  ttsAudioUrl: string | null
  ttsProvider: string
  // Actual subtitle timings derived from real TTS audio durations (replaces plan-based estimate)
  subtitles: Array<{ start: number; end: number; text: string }>
  // Degradations that occurred while rendering (e.g. a scene fell back to a generated placeholder clip)
  qualityNotes: RenderQualityNote[]
}

const MAX_SOURCE_VIDEO_BYTES = 100 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_DOWNLOAD_TIMEOUT_MS || 12_000)
const DOWNLOAD_IDLE_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_DOWNLOAD_IDLE_TIMEOUT_MS || 6_000)
const TTS_SCENE_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_TTS_SCENE_TIMEOUT_MS || 75_000)
const NORMALIZE_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_NORMALIZE_TIMEOUT_MS || 45_000)
const FINAL_RENDER_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_FINAL_TIMEOUT_MS || 240_000)
const TOTAL_RENDER_TIMEOUT_MS = Number(process.env.YOUTUBE_RENDER_TOTAL_TIMEOUT_MS || 8 * 60_000)
const CLIP_NORMALIZE_MAX_ATTEMPTS = Number(process.env.YOUTUBE_RENDER_CLIP_ATTEMPTS || 3)
const TTS_CONCURRENCY = positiveInteger(process.env.YOUTUBE_RENDER_TTS_CONCURRENCY, 2, 1, 3)
const FFMPEG_CONCURRENCY = positiveInteger(process.env.YOUTUBE_RENDER_FFMPEG_CONCURRENCY, 2, 1, 2)
// Worst-case wall-clock cost of one unit of work. A step only starts when this much budget
// remains; otherwise the render requeues itself and a fresh invocation continues.
const TTS_STEP_COST_MS = TTS_SCENE_TIMEOUT_MS + 20_000
const CLIP_STEP_COST_MS = DOWNLOAD_TIMEOUT_MS * 2 + NORMALIZE_TIMEOUT_MS + 30_000
const FINAL_STEP_COST_MS = FINAL_RENDER_TIMEOUT_MS + 120_000
const TTS_MAX_ATTEMPTS = 3
const TTS_MAX_CHARS = 3900
const PUBLIC_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), 'public')

export async function renderYouTubeShortsFromStock(params: RenderYouTubeShortsParams): Promise<StoredRenderedAsset> {
  const usableClips = params.sourceClips.filter(clip => clip.videoUrl)
  if (usableClips.length === 0) {
    throw new Error('Pexels/Pixabay 영상 후보가 없습니다. API 키 또는 검색 키워드를 확인해 주세요.')
  }
  const checkpoint = normalizeRenderCheckpoint(params.checkpoint, params.scenes)
  const sceneCp = (sceneNumber: number) => {
    let entry = checkpoint.scenes.find(scene => scene.sceneNumber === sceneNumber)
    if (!entry) {
      entry = { sceneNumber }
      checkpoint.scenes.push(entry)
    }
    return entry
  }
  // Checkpoint writes are serialized so a later snapshot never loses to an earlier slow write
  let checkpointChain: Promise<void> = Promise.resolve()
  const saveCheckpoint = () => {
    const snapshot = JSON.parse(JSON.stringify(checkpoint)) as RenderCheckpoint
    checkpointChain = checkpointChain.then(() => params.onCheckpoint?.(snapshot) ?? undefined)
    return checkpointChain
  }
  const workRoot = path.join(os.tmpdir(), 'shuffla-youtube-automation')
  await fs.mkdir(workRoot, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(workRoot, `${params.dayId}-`))
  const deadlineAt = Math.min(Date.now() + TOTAL_RENDER_TIMEOUT_MS, params.deadlineAt ?? Number.POSITIVE_INFINITY)
  const remainingMs = () => deadlineAt - Date.now()

  try {
    logYouTubeAutomation('info', 'render_workdir_created', renderLogContext(params), {
      sceneCount: params.scenes.length,
      usableClipCount: usableClips.length,
      resumedTtsCount: checkpoint.scenes.filter(scene => scene.ttsUrl).length,
      resumedClipCount: checkpoint.scenes.filter(scene => scene.clipUrl).length,
      requeueCount: checkpoint.requeueCount ?? 0,
      ttsConcurrency: TTS_CONCURRENCY,
      ffmpegConcurrency: FFMPEG_CONCURRENCY,
    })
    await reportProgress(params, 31, '렌더링 준비 중')
    const fontsDir = path.join(workDir, 'fonts')
    await fs.mkdir(fontsDir, { recursive: true })
    await copyFontIfAvailable(fontsDir)

    // ── Phase 1: per-scene TTS → durable storage (skips scenes already checkpointed) ──
    const ttsProvider = await getTtsProvider()
    checkpoint.ttsProvider = ttsProvider
    await ensureNotCancelled(params)

    const pendingTtsScenes = () => params.scenes.filter(scene => !sceneCp(scene.sceneNumber).ttsUrl)
    if (pendingTtsScenes().length > 0) {
      let ttsBudgetExhausted = false
      await mapWithConcurrency(params.scenes, TTS_CONCURRENCY, async (scene, index) => {
        const cpScene = sceneCp(scene.sceneNumber)
        if (cpScene.ttsUrl) return
        if (ttsBudgetExhausted || remainingMs() < TTS_STEP_COST_MS) {
          ttsBudgetExhausted = true
          return
        }
        await ensureNotCancelled(params)
        const sceneStartedAt = Date.now()
        const sceneSpeechPath = path.join(workDir, `tts-${index + 1}.mp3`)
        try {
          await withTimeout(
            createSceneSpeechAudio(scene.narration, sceneSpeechPath, scene.durationSeconds, params.ttsVoice),
            boundedTimeout(deadlineAt, TTS_SCENE_TIMEOUT_MS),
            `씬 ${index + 1} TTS 생성이 ${Math.round(TTS_SCENE_TIMEOUT_MS / 1000)}초를 초과했습니다.`,
          )
          const actualDuration = await probeAudioDuration(sceneSpeechPath, () => {
            cpScene.ttsProbeFallback = true
          })
          cpScene.ttsUrl = await storeAsset({
            userId: params.userId,
            fileName: `work-${params.dayId}-tts-${scene.sceneNumber}.mp3`,
            contentType: 'audio/mpeg',
            buffer: await fs.readFile(sceneSpeechPath),
          })
          cpScene.ttsDuration = actualDuration
          await saveCheckpoint()
          logYouTubeAutomation('info', 'render_tts_scene_done', renderLogContext(params), {
            sceneNumber: scene.sceneNumber,
            actualDuration,
            durationMs: Date.now() - sceneStartedAt,
          })
          const ttsDone = params.scenes.length - pendingTtsScenes().length
          await reportProgress(
            params,
            Math.min(45, 31 + Math.round((ttsDone / params.scenes.length) * 14)),
            `TTS 음성 생성 중 (${ttsDone}/${params.scenes.length})`,
          )
        } catch (error) {
          if (error instanceof YouTubeRenderCancelledError) throw error
          cpScene.ttsFailedAttempts = (cpScene.ttsFailedAttempts ?? 0) + 1
          logYouTubeAutomation('warn', 'render_tts_scene_failed', renderLogContext(params), {
            sceneNumber: scene.sceneNumber,
            attempts: cpScene.ttsFailedAttempts,
            durationMs: Date.now() - sceneStartedAt,
            ...summarizeYouTubeAutomationError(error),
          })
          if (cpScene.ttsFailedAttempts >= TTS_MAX_ATTEMPTS) {
            // Guarantee forward progress: this scene ships with silent narration + a quality note
            await createSilentAudio(sceneSpeechPath, scene.durationSeconds)
            cpScene.ttsUrl = await storeAsset({
              userId: params.userId,
              fileName: `work-${params.dayId}-tts-${scene.sceneNumber}.mp3`,
              contentType: 'audio/mpeg',
              buffer: await fs.readFile(sceneSpeechPath),
            })
            cpScene.ttsDuration = scene.durationSeconds
            cpScene.ttsSilentFallback = true
          }
          await saveCheckpoint()
        }
      })
      if (pendingTtsScenes().length > 0) throw new YouTubeRenderRequeueError()
    }

    // ── Phase 2: per-scene download + normalize → durable storage ──
    const pendingClipScenes = () => params.scenes.filter(scene => !sceneCp(scene.sceneNumber).clipUrl)
    if (pendingClipScenes().length > 0) {
      let clipBudgetExhausted = false
      await mapWithConcurrency(params.scenes, FFMPEG_CONCURRENCY, async (scene, index) => {
        const cpScene = sceneCp(scene.sceneNumber)
        if (cpScene.clipUrl) return
        if (clipBudgetExhausted || remainingMs() < CLIP_STEP_COST_MS) {
          clipBudgetExhausted = true
          return
        }
        await ensureNotCancelled(params)
        const sceneStartedAt = Date.now()
        const normalizedPath = path.join(workDir, `clip-${index + 1}.mp4`)
        try {
          const usedGeneratedFallback = await buildNormalizedSceneClip({
            scene,
            sceneIndex: index,
            usableClips,
            workDir,
            outputPath: normalizedPath,
            durationSeconds: cpScene.ttsDuration ?? scene.durationSeconds,
            deadlineAt,
            template: params.template,
            shouldCancel: params.shouldCancel,
            logContext: renderLogContext(params),
          })
          if (usedGeneratedFallback) cpScene.generatedFallback = true
          cpScene.clipUrl = await storeAsset({
            userId: params.userId,
            fileName: `work-${params.dayId}-clip-${scene.sceneNumber}.mp4`,
            contentType: 'video/mp4',
            buffer: await fs.readFile(normalizedPath),
          })
          await saveCheckpoint()
          logYouTubeAutomation('info', 'render_clip_scene_done', renderLogContext(params), {
            sceneNumber: scene.sceneNumber,
            usedGeneratedFallback,
            durationMs: Date.now() - sceneStartedAt,
          })
          const clipsDone = params.scenes.length - pendingClipScenes().length
          await reportProgress(
            params,
            Math.min(67, 45 + Math.round((clipsDone / params.scenes.length) * 22)),
            `씬별 영상 렌더링 중 (${clipsDone}/${params.scenes.length})`,
          )
        } catch (error) {
          if (error instanceof YouTubeRenderCancelledError) throw error
          cpScene.clipFailedAttempts = (cpScene.clipFailedAttempts ?? 0) + 1
          await saveCheckpoint()
          logYouTubeAutomation('warn', 'render_clip_scene_failed', renderLogContext(params), {
            sceneNumber: scene.sceneNumber,
            attempts: cpScene.clipFailedAttempts,
            durationMs: Date.now() - sceneStartedAt,
            ...summarizeYouTubeAutomationError(error),
          })
        }
      })
      if (pendingClipScenes().length > 0) throw new YouTubeRenderRequeueError()
    }

    // ── Phase 3: final assembly — needs one uninterrupted window, otherwise continue next run ──
    if (remainingMs() < FINAL_STEP_COST_MS) throw new YouTubeRenderRequeueError()
    await ensureNotCancelled(params)
    await reportProgress(params, 68, '씬별 영상 컷 완료')

    const sceneAudioPaths: string[] = []
    const normalizedClips: string[] = []
    const actualDurations: number[] = []
    for (const [index, scene] of params.scenes.entries()) {
      const cpScene = sceneCp(scene.sceneNumber)
      const audioPath = path.join(workDir, `final-tts-${index + 1}.mp3`)
      const clipPath = path.join(workDir, `final-clip-${index + 1}.mp4`)
      try {
        await materializeWorkAsset(cpScene.ttsUrl as string, audioPath)
      } catch (error) {
        // Checkpointed asset is gone (e.g. deleted from storage) — regenerate it next run
        cpScene.ttsUrl = undefined
        await saveCheckpoint()
        logYouTubeAutomation('warn', 'render_checkpoint_tts_asset_lost', renderLogContext(params), {
          sceneNumber: scene.sceneNumber,
          ...summarizeYouTubeAutomationError(error),
        })
        throw new YouTubeRenderRequeueError()
      }
      try {
        await materializeWorkAsset(cpScene.clipUrl as string, clipPath)
      } catch (error) {
        cpScene.clipUrl = undefined
        await saveCheckpoint()
        logYouTubeAutomation('warn', 'render_checkpoint_clip_asset_lost', renderLogContext(params), {
          sceneNumber: scene.sceneNumber,
          ...summarizeYouTubeAutomationError(error),
        })
        throw new YouTubeRenderRequeueError()
      }
      sceneAudioPaths.push(audioPath)
      normalizedClips.push(clipPath)
      actualDurations.push(cpScene.ttsDuration ?? scene.durationSeconds)
    }
    const totalDuration = actualDurations.reduce((sum, duration) => sum + duration, 0)

    // ── Step 3: Concatenate per-scene TTS audio into one track ──
    const speechPath = path.join(workDir, 'speech.mp3')
    await concatenateAudio(sceneAudioPaths, speechPath, workDir, params.shouldCancel)
    await reportProgress(params, 70, '음성과 장면 결합 중')

    // ── Step 4: Build subtitles timed to actual TTS durations ──
    const subtitlePath = path.join(workDir, 'subtitles.ass')
    await fs.writeFile(
      subtitlePath,
      buildAssSubtitlesWithDurations(params.scenes, actualDurations, params.title, params.template),
      'utf8',
    )
    await reportProgress(params, 76, '자막과 제목 적용 중')
    const hookOverlayPath = params.template
      ? await renderHookOverlay({
        title: params.title,
        template: params.template,
        outputPath: path.join(workDir, 'hook-overlay.png'),
      })
      : null

    // ── Step 5: Concatenate video clips ──
    const concatPath = path.join(workDir, 'concat.txt')
    await fs.writeFile(
      concatPath,
      normalizedClips.map(filePath => `file '${filePath.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'),
      'utf8',
    )

    // ── Step 6: Merge video + audio + subtitles ──
    const outputPath = path.join(workDir, 'output.mp4')
    const renderArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-i', speechPath,
      ...(hookOverlayPath ? ['-loop', '1', '-i', hookOverlayPath] : []),
      ...(hookOverlayPath
        ? ['-filter_complex', '[0:v][2:v]overlay=0:0:format=auto[decorated];[decorated]subtitles=subtitles.ass:fontsdir=fonts[v]']
        : ['-vf', 'subtitles=subtitles.ass:fontsdir=fonts']),
      '-t', String(totalDuration),
      '-map', hookOverlayPath ? '[v]' : '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'libx264',
      '-preset', process.env.YOUTUBE_RENDER_FFMPEG_PRESET || 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-af', 'apad',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]
    await ensureNotCancelled(params)
    await reportProgress(params, 82, '최종 영상 렌더링 중')
    await runFfmpeg(renderArgs, workDir, params.shouldCancel, boundedTimeout(deadlineAt, FINAL_RENDER_TIMEOUT_MS))
    await ensureCanContinue(params, deadlineAt)
    await reportProgress(params, 94, '미리보기 생성 중')

    const thumbnailPath = path.join(workDir, 'thumbnail.jpg')
    await runFfmpeg([
      '-y',
      '-ss', '00:00:01',
      '-i', outputPath,
      '-frames:v', '1',
      '-q:v', '3',
      thumbnailPath,
    ], workDir, params.shouldCancel).catch(error => {
      if (error instanceof YouTubeRenderCancelledError) throw error
      return undefined
    })

    const [mp4Url, thumbnailUrl, ttsAudioUrl] = await Promise.all([
      storeAsset({
        userId: params.userId,
        fileName: `youtube-short-${safeFilePart(params.title)}-${randomUUID()}.mp4`,
        contentType: 'video/mp4',
        buffer: await fs.readFile(outputPath),
      }),
      readIfExists(thumbnailPath).then(buffer => buffer
        ? storeAsset({
          userId: params.userId,
          fileName: `youtube-short-${safeFilePart(params.title)}-${randomUUID()}.jpg`,
          contentType: 'image/jpeg',
          buffer,
        })
        : null),
      storeAsset({
        userId: params.userId,
        fileName: `youtube-short-tts-${randomUUID()}.mp3`,
        contentType: 'audio/mpeg',
        buffer: await fs.readFile(speechPath),
      }).catch(() => null),
    ])
    await reportProgress(params, 99, '영상 저장 중')

    // Build accurate subtitle timings from actual TTS durations for the API response
    let subtitleCursor = 0
    const subtitles = params.scenes.map((scene, index) => {
      const duration = actualDurations[index] ?? scene.durationSeconds
      const start = subtitleCursor
      subtitleCursor += duration
      return { start, end: subtitleCursor, text: scene.narration }
    })

    // Best-effort removal of intermediate work assets now that the final video is stored
    await cleanupWorkAssets(checkpoint).catch(() => undefined)

    return { mp4Url, thumbnailUrl, ttsAudioUrl, ttsProvider, subtitles, qualityNotes: qualityNotesFromCheckpoint(checkpoint) }
  } finally {
    await checkpointChain.catch(() => undefined)
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

function normalizeRenderCheckpoint(value: RenderCheckpoint | undefined, scenes: YouTubeScenePlan[]): RenderCheckpoint {
  const sceneNumbers = new Set(scenes.map(scene => scene.sceneNumber))
  const entries = Array.isArray(value?.scenes)
    ? value.scenes.filter(scene => scene && sceneNumbers.has(scene.sceneNumber))
    : []
  return { version: 1, ttsProvider: value?.ttsProvider, requeueCount: value?.requeueCount ?? 0, scenes: entries }
}

function qualityNotesFromCheckpoint(checkpoint: RenderCheckpoint): RenderQualityNote[] {
  const notes: RenderQualityNote[] = []
  for (const scene of checkpoint.scenes) {
    if (scene.generatedFallback) notes.push({ type: 'generated_clip', sceneNumber: scene.sceneNumber })
    if (scene.ttsSilentFallback) {
      notes.push({ type: 'tts_failed', sceneNumber: scene.sceneNumber })
    } else if (scene.ttsProbeFallback) {
      notes.push({ type: 'tts_probe_failed', sceneNumber: scene.sceneNumber })
    }
  }
  return notes
}

// Bring a checkpointed work asset (Blob URL in production, /public path in local dev) into the workdir.
async function materializeWorkAsset(url: string, destPath: string) {
  if (/^https?:\/\//.test(url)) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`작업 파일 다운로드 실패 (HTTP ${response.status})`)
    await fs.writeFile(destPath, Buffer.from(await response.arrayBuffer()))
    return
  }
  const source = path.join(PUBLIC_DIR, ...url.replace(/^\//, '').split('/'))
  await fs.copyFile(source, destPath)
}

async function cleanupWorkAssets(checkpoint: RenderCheckpoint) {
  const urls = checkpoint.scenes
    .flatMap(scene => [scene.ttsUrl, scene.clipUrl])
    .filter((url): url is string => Boolean(url))
  const blobUrls = urls.filter(url => /^https?:\/\//.test(url))
  if (blobUrls.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import('@vercel/blob')
    await del(blobUrls, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined)
  }
  await Promise.all(
    urls
      .filter(url => url.startsWith('/'))
      .map(url => fs.rm(path.join(PUBLIC_DIR, ...url.replace(/^\//, '').split('/')), { force: true }).catch(() => undefined)),
  )
}

async function downloadVideo(
  url: string,
  outputPath: string,
  shouldCancel?: () => Promise<boolean>,
  timeoutMs = DOWNLOAD_TIMEOUT_MS,
) {
  if (await shouldCancel?.()) throw new YouTubeRenderCancelledError()
  const controller = new AbortController()
  let timedOut = false
  let idleTimedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const cancelPoll = shouldCancel
    ? setInterval(() => {
      void shouldCancel().then(cancel => {
        if (cancel) controller.abort()
      }).catch(() => undefined)
    }, 1000)
    : undefined
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (await shouldCancel?.()) throw new YouTubeRenderCancelledError()
    if (!response.ok) throw new Error(`무료 영상 다운로드 실패: HTTP ${response.status}`)
    const declaredSize = Number(response.headers.get('content-length') || 0)
    if (declaredSize > MAX_SOURCE_VIDEO_BYTES) throw new Error('무료 영상 파일이 너무 큽니다.')
    if (!response.body) throw new Error('무료 영상 다운로드 응답이 비어 있습니다.')
    const reader = response.body.getReader()
    const file = await fs.open(outputPath, 'w')
    let received = 0
    try {
      while (true) {
        if (await shouldCancel?.()) {
          await reader.cancel()
          throw new YouTubeRenderCancelledError()
        }
        const { done, value } = await readStreamChunk(reader, DOWNLOAD_IDLE_TIMEOUT_MS).catch(async error => {
          idleTimedOut = true
          controller.abort()
          await reader.cancel().catch(() => undefined)
          throw error
        })
        if (done) break
        received += value.byteLength
        if (received > MAX_SOURCE_VIDEO_BYTES) {
          await reader.cancel()
          throw new Error('무료 영상 파일이 너무 큽니다.')
        }
        await file.write(value)
      }
    } finally {
      await file.close()
    }
    if (received === 0) {
      await fs.rm(outputPath, { force: true }).catch(() => undefined)
      throw new Error('무료 영상 파일 크기가 올바르지 않습니다.')
    }
  } catch (error) {
    if (error instanceof YouTubeRenderCancelledError) throw error
    await fs.rm(outputPath, { force: true }).catch(() => undefined)
    if (controller.signal.aborted) {
      if (idleTimedOut) throw new Error(`무료 영상 다운로드 응답이 ${DOWNLOAD_IDLE_TIMEOUT_MS / 1000}초 동안 멈췄습니다.`)
      if (timedOut) throw new Error(`무료 영상 다운로드가 ${timeoutMs / 1000}초를 초과했습니다.`)
      throw new YouTubeRenderCancelledError()
    }
    throw error
  } finally {
    clearTimeout(timeout)
    if (cancelPoll) clearInterval(cancelPoll)
  }
}

async function normalizeClip(params: {
  inputPath: string
  outputPath: string
  durationSeconds: number
  template?: YouTubeShortsTemplateRecord
  shouldCancel?: () => Promise<boolean>
  timeoutMs?: number
}) {
  const layout = params.template?.config.layout
  const headerHeight = layout?.headerEnabled ? layout.headerHeight : 0
  const footerHeight = layout?.footerEnabled ? layout.footerHeight : 0
  const videoHeightPercent = Math.min(layout?.videoAreaHeight ?? 100, 100 - headerHeight - footerHeight)
  const videoHeight = Math.max(2, Math.floor((1920 * videoHeightPercent / 100) / 2) * 2)
  const top = Math.max(0, Math.floor(1920 * headerHeight / 100))
  const background = (layout?.backgroundColor ?? '#000000').replace('#', '0x')
  const filter = [
    `scale=1080:${videoHeight}:force_original_aspect_ratio=increase`,
    `crop=1080:${videoHeight}`,
    'fps=30',
    'format=yuv420p',
    `pad=1080:1920:0:${top}:${background}`,
  ].join(',')
  await runFfmpeg([
    '-y',
    '-stream_loop', '-1',
    '-i', params.inputPath,
    '-t', String(params.durationSeconds),
    '-vf', filter,
    '-an',
    '-c:v', 'libx264',
    '-preset', process.env.YOUTUBE_RENDER_FFMPEG_PRESET || 'ultrafast',
    '-pix_fmt', 'yuv420p',
    params.outputPath,
  ], undefined, params.shouldCancel, params.timeoutMs ?? NORMALIZE_TIMEOUT_MS)
}

async function createGeneratedSourceClip(
  outputPath: string,
  durationSeconds: number,
  shouldCancel?: () => Promise<boolean>,
  timeoutMs = NORMALIZE_TIMEOUT_MS,
) {
  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=0x101828:s=1080x1920:r=30',
    '-t', String(Math.max(1, durationSeconds)),
    '-c:v', 'libx264',
    '-preset', process.env.YOUTUBE_RENDER_FFMPEG_PRESET || 'ultrafast',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ], undefined, shouldCancel, timeoutMs)
}

function preferFastSourceClips(clips: StockVideoCandidate[]) {
  const fastClips = clips.filter(clip => {
    const url = clip.videoUrl || ''
    return !isKnownSlowSourceVideo(url)
  })
  return fastClips.length > 0 ? fastClips : clips
}

function isKnownSlowSourceVideo(url: string) {
  return /[_-]1080_20\d{2}[_-]/.test(url) || /[_-]1440_/.test(url) || /[_-]2160_/.test(url)
}

// Download a stock clip for the scene (with per-clip retries) and normalize it to the target
// duration/layout. Falls back to a generated solid-color clip so the scene always resolves.
// Returns true when the generated fallback was used.
async function buildNormalizedSceneClip(params: {
  scene: YouTubeScenePlan
  sceneIndex: number
  usableClips: StockVideoCandidate[]
  workDir: string
  outputPath: string
  durationSeconds: number
  deadlineAt: number
  template?: YouTubeShortsTemplateRecord
  shouldCancel?: () => Promise<boolean>
  logContext: { userId: string; dayId: string; title: string }
}): Promise<boolean> {
  const sceneMatches = preferFastSourceClips(clipsForScene(params.scene, params.usableClips))
  const sceneClipKeys = new Set(sceneMatches.map(clip => `${clip.provider}:${clip.id}`))
  const fallbackClips = preferFastSourceClips(params.usableClips)
    .filter(clip => !sceneClipKeys.has(`${clip.provider}:${clip.id}`))
  const candidates = [...sceneMatches, ...fallbackClips].filter(clip => clip.videoUrl)
  const attempts = Math.max(1, Math.min(CLIP_NORMALIZE_MAX_ATTEMPTS, candidates.length))
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (Date.now() >= params.deadlineAt) throw new YouTubeRenderTimeoutError()
    if (await params.shouldCancel?.()) throw new YouTubeRenderCancelledError()
    const clip = candidates[attempt]
    const rawPath = path.join(params.workDir, `source-${params.sceneIndex + 1}-${attempt + 1}.mp4`)
    try {
      await downloadVideo(clip.videoUrl as string, rawPath, params.shouldCancel, boundedTimeout(params.deadlineAt, DOWNLOAD_TIMEOUT_MS))
      await normalizeClip({
        inputPath: rawPath,
        outputPath: params.outputPath,
        durationSeconds: params.durationSeconds,
        template: params.template,
        shouldCancel: params.shouldCancel,
        timeoutMs: boundedTimeout(params.deadlineAt, NORMALIZE_TIMEOUT_MS),
      })
      return false
    } catch (error) {
      if (error instanceof YouTubeRenderCancelledError) throw error
      lastError = error
      await fs.rm(rawPath, { force: true }).catch(() => undefined)
      logYouTubeAutomation(attempt + 1 >= attempts ? 'error' : 'warn', 'render_clip_scene_attempt_failed', params.logContext, {
        sceneNumber: params.scene.sceneNumber,
        attempt: attempt + 1,
        attempts,
        provider: clip.provider,
        clipId: clip.id,
        ...summarizeYouTubeAutomationError(error),
      })
    }
  }

  logYouTubeAutomation('warn', 'render_normalize_scene_using_generated_fallback', params.logContext, {
    sceneIndex: params.sceneIndex + 1,
    attempts,
    ...summarizeYouTubeAutomationError(lastError),
  })
  await createGeneratedSourceClip(
    params.outputPath,
    Math.max(1, params.durationSeconds),
    params.shouldCancel,
    boundedTimeout(params.deadlineAt, NORMALIZE_TIMEOUT_MS),
  )
  return true
}

async function getTtsProvider(): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.length < 10) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TTS 생성을 위한 OPENAI_API_KEY 또는 NVIDIA_API_KEY가 설정되어 있지 않습니다.')
    }
    return 'silent-dev'
  }
  return process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
}

// Generate TTS for a single scene narration with OpenAI.
async function createSceneSpeechAudio(narration: string, outputPath: string, fallbackDurationSeconds: number, voice?: YouTubeTtsVoice) {
  const input = narration.length > TTS_MAX_CHARS
    ? (console.warn(`[TTS] 씬 나레이션이 ${TTS_MAX_CHARS}자를 초과해 잘립니다.`), narration.slice(0, TTS_MAX_CHARS))
    : narration

  // OpenAI TTS
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.length < 10) {
    await createSilentAudio(outputPath, fallbackDurationSeconds)
    return
  }

  const openai = new OpenAI({
    apiKey,
    timeout: 60_000,
    maxRetries: 2,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  })
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: voice ?? (process.env.OPENAI_TTS_VOICE || 'alloy') as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
    input,
    response_format: 'mp3',
  })
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
}

// Probe the actual duration of an audio file using ffmpeg.
// This is the source of truth for sync: TTS determines scene length.
async function probeAudioDuration(filePath: string, onFallback?: () => void): Promise<number> {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path
  return new Promise((resolve, reject) => {
    let stderr = ''
    const child = spawn(ffmpegPath, ['-i', filePath, '-f', 'null', '-'], { windowsHide: true })
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('TTS 길이 확인 시간이 초과되었습니다.'))
    }, 15_000)
    child.stderr.on('data', (chunk: Buffer) => { stderr += String(chunk) })
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', () => {
      clearTimeout(timeout)
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      if (match) {
        const duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3])
        resolve(duration)
      } else {
        console.warn('[YouTubeRender] Could not probe audio duration, using 5s fallback')
        onFallback?.()
        resolve(5)
      }
    })
  })
}

// Concatenate multiple MP3 files into one using ffmpeg concat demuxer.
async function concatenateAudio(
  inputPaths: string[],
  outputPath: string,
  workDir: string,
  shouldCancel?: () => Promise<boolean>,
) {
  if (inputPaths.length === 1) {
    await fs.copyFile(inputPaths[0], outputPath)
    return
  }
  const listPath = path.join(workDir, 'audio-concat.txt')
  await fs.writeFile(
    listPath,
    inputPaths.map(p => `file '${p.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'),
    'utf8',
  )
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ], workDir, shouldCancel)
}

async function createSilentAudio(outputPath: string, durationSeconds: number) {
  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', String(Math.max(1, durationSeconds)),
    '-q:a', '9',
    '-acodec', 'libmp3lame',
    outputPath,
  ])
}

// Build ASS subtitles using actual per-scene TTS durations (not LLM-planned durationSeconds).
// Each subtitle window is trimmed slightly at the end so text clears before the next scene starts.
function buildAssSubtitlesWithDurations(
  scenes: YouTubeScenePlan[],
  actualDurations: number[],
  title: string,
  template?: YouTubeShortsTemplateRecord,
) {
  const caption = template?.config.captionStyle
  const header = template?.config.headerStyle
  const hook = template?.config.hookDesign
  const layout = template?.config.layout
  const captionAlignment = caption?.captionPosition === 'top' ? 8 : caption?.captionPosition === 'center' ? 5 : 2
  const captionMargin = caption?.captionPosition === 'bottom'
    ? Math.round(1920 * ((layout?.footerEnabled ? layout.footerHeight : 0) / 100)) + 80
    : 100
  const primary = assColor(caption?.captionColor ?? '#ffffff')
  const outline = assColor(caption?.captionStrokeColor ?? '#000000')
  const back = assColor(caption?.captionBackgroundColor ?? '#000000', caption?.captionBackgroundEnabled ? '88' : '00')
  const borderStyle = caption?.captionBackgroundEnabled ? 3 : 1
  const fontWeight = (caption?.captionFontWeight ?? 800) >= 600 ? -1 : 0
  let cursor = 0
  // One Dialogue per short phrase (not per scene): scene duration is distributed across
  // phrases proportionally to character count so captions track the narration.
  const events = scenes.flatMap((scene, index) => {
    const duration = actualDurations[index] ?? scene.durationSeconds
    const sceneStart = cursor
    cursor += duration
    const phrases = splitNarrationIntoPhrases(scene.narration)
    if (phrases.length === 0) return []
    const totalChars = phrases.reduce((sum, phrase) => sum + phrase.length, 0)
    let phraseCursor = sceneStart
    return phrases.map((phrase, phraseIndex) => {
      const start = phraseCursor
      const isLastPhrase = phraseIndex === phrases.length - 1
      const rawEnd = isLastPhrase
        ? sceneStart + duration
        : phraseCursor + duration * (phrase.length / totalChars)
      phraseCursor = rawEnd
      // Trim slightly so a line clears before the next one appears
      const end = Math.max(start + 0.2, rawEnd - 0.08)
      return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${escapeAssText(phrase)}`
    })
  })
  const totalDuration = actualDurations.reduce((sum, duration) => sum + duration, 0)
  const hookLayout = hook
    ? fitHookText(title, {
      maxLines: hook.maxLines,
      fontSize: hook.fontSize,
      paddingX: hook.paddingX,
      minFontSize: 48,
      maxCharacters: 42,
    })
    : { lines: [title], fontSize: header?.headerFontSize ?? 52, truncated: false }
  const hookLines = hookLayout.lines
  const hookText = hookLines.map((line, index) => {
    const color = index === hookLines.length - 1 && hookLines.length > 1 ? hook?.emphasisColor : hook?.textColor
    return `{\\1c${assOverrideColor(color ?? header?.headerTextColor ?? '#111111')}}${escapeAssText(line)}`
  }).join('\\N')
  const headerEvent = layout?.headerEnabled
    ? [`Dialogue: 1,0:00:00.00,${formatAssTime(totalDuration)},Header,,0,0,0,,${hookText}`]
    : []
  const hookAlignment = hook?.textAlign === 'left' ? 7 : hook?.textAlign === 'right' ? 9 : 8
  const hookMarginV = hook && layout
    ? Math.max(20, Math.round((1920 * layout.headerHeight / 100 - hookLines.length * hookLayout.fontSize * hook.lineHeight) / 2))
    : 55

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${caption?.captionFontFamily ?? 'Pretendard'},${caption?.captionFontSize ?? 72},${primary},&H000000FF,${outline},${back},${fontWeight},0,0,0,100,100,0,0,${borderStyle},5,2,${captionAlignment},72,72,${captionMargin},1`,
    `Style: Header,Pretendard,${hookLayout.fontSize},${assColor(hook?.textColor ?? header?.headerTextColor ?? '#111111')},&H000000FF,${assColor(hook?.strokeColor ?? '#000000')},&H00000000,${(hook?.fontWeight ?? header?.headerFontWeight ?? 800) >= 600 ? -1 : 0},0,0,0,100,100,${hook?.letterSpacing ?? 0},0,1,${hook?.strokeEnabled ? hook.strokeWidth : 0},${hook?.shadowEnabled ? Math.max(1, hook.shadowBlur / 3) : 0},${hookAlignment},${hook?.paddingX ?? 70},${hook?.paddingX ?? 70},${hookMarginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...headerEvent,
    ...events,
  ].join('\n')
}

export class YouTubeRenderCancelledError extends Error {
  constructor() {
    super('영상 제작이 중단되었습니다.')
    this.name = 'YouTubeRenderCancelledError'
  }
}

class YouTubeRenderTimeoutError extends Error {
  constructor() {
    super('렌더링 시간이 초과되었습니다. 다시 제작하면 저장된 제작안부터 이어서 진행되어 더 빠르게 완료됩니다.')
    this.name = 'YouTubeRenderTimeoutError'
  }
}

async function ensureNotCancelled(params: RenderYouTubeShortsParams) {
  if (await params.shouldCancel?.()) throw new YouTubeRenderCancelledError()
}

async function ensureCanContinue(params: RenderYouTubeShortsParams, deadlineAt: number) {
  if (Date.now() >= deadlineAt) throw new YouTubeRenderTimeoutError()
  await ensureNotCancelled(params)
}

async function reportProgress(params: RenderYouTubeShortsParams, progress: number, stage: string) {
  await params.onProgress?.(progress, stage)
}

function assColor(hex: string, alpha = '00') {
  const clean = hex.replace('#', '').padEnd(6, '0')
  const r = clean.slice(0, 2)
  const g = clean.slice(2, 4)
  const b = clean.slice(4, 6)
  return `&H${alpha}${b}${g}${r}`
}

function assOverrideColor(hex: string) {
  const clean = hex.replace('#', '').padEnd(6, '0')
  return `&H${clean.slice(4, 6)}${clean.slice(2, 4)}${clean.slice(0, 2)}&`
}

function formatAssTime(totalSeconds: number) {
  const centiseconds = Math.round(totalSeconds * 100)
  const cs = centiseconds % 100
  const total = Math.floor(centiseconds / 100)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function escapeAssText(text: string) {
  return text
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, '\\N')
}

const SUBTITLE_PHRASE_MAX_CHARS = 18

// Split narration into short caption-sized phrases: first on sentence/comma boundaries,
// then long segments on word boundaries.
function splitNarrationIntoPhrases(narration: string): string[] {
  const clean = narration.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const segments = clean.split(/(?<=[.!?…,])\s*/).map(segment => segment.trim()).filter(Boolean)
  const phrases: string[] = []
  for (const segment of segments) {
    if (segment.length <= SUBTITLE_PHRASE_MAX_CHARS) {
      phrases.push(segment)
      continue
    }
    let current = ''
    for (const word of segment.split(' ')) {
      if (current && current.length + 1 + word.length > SUBTITLE_PHRASE_MAX_CHARS) {
        phrases.push(current)
        current = word
      } else {
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) phrases.push(current)
  }
  // Captions read cleaner without trailing commas/periods (question/exclamation marks stay)
  return phrases.map(phrase => phrase.replace(/[,.]+$/, '').trim()).filter(Boolean)
}

async function copyFontIfAvailable(fontsDir: string) {
  for (const fileName of ['Pretendard-Bold.otf', 'Pretendard-ExtraBold.otf', 'Pretendard-Black.otf']) {
    const source = path.join(PUBLIC_DIR, 'fonts', fileName)
    try {
      await fs.copyFile(source, path.join(fontsDir, fileName))
    } catch {
      // FFmpeg will fall back to a system font when a bundled font is unavailable.
    }
  }
}

async function runFfmpeg(
  args: string[],
  cwd?: string,
  shouldCancel?: () => Promise<boolean>,
  timeoutMs = NORMALIZE_TIMEOUT_MS,
) {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegInstaller.path
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { cwd, windowsHide: true })
    let stderr = ''
    let cancelled = false
    let timedOut = false
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined
    const timeoutTimer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 2000)
      }, timeoutMs)
    const cancelPoll = shouldCancel
      ? setInterval(() => {
        void shouldCancel().then(cancel => {
          if (!cancel || cancelled) return
          cancelled = true
          child.kill('SIGTERM')
          forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 2000)
        }).catch(() => undefined)
      }, 1000)
      : undefined
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', error => {
      if (cancelPoll) clearInterval(cancelPoll)
      clearTimeout(timeoutTimer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      reject(error)
    })
    child.on('close', code => {
      if (cancelPoll) clearInterval(cancelPoll)
      clearTimeout(timeoutTimer)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      if (cancelled) {
        reject(new YouTubeRenderCancelledError())
        return
      }
      if (timedOut) {
        reject(new Error(`ffmpeg timed out after ${Math.round(timeoutMs / 1000)}s`))
        return
      }
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.slice(-1200) || `ffmpeg exited with code ${code}`))
    })
  })
}

async function storeAsset(params: {
  userId: string
  fileName: string
  contentType: 'video/mp4' | 'image/jpeg' | 'audio/mpeg'
  buffer: Buffer
}) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`generated/youtube/${params.userId}/${params.fileName}`, params.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: params.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return blob.url
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('렌더링 결과 저장을 위한 BLOB_READ_WRITE_TOKEN이 설정되어 있지 않습니다.')
  }

  const directory = path.join(PUBLIC_DIR, 'generated', 'youtube', params.userId)
  await fs.mkdir(directory, { recursive: true })
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  await fs.writeFile(path.join(directory, safeName), params.buffer)
  return `/generated/youtube/${params.userId}/${safeName}`
}

async function readIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

function clipsForScene(scene: YouTubeScenePlan, clips: StockVideoCandidate[]) {
  const bySceneNumber = clips.filter(clip => clip.sceneNumber === scene.sceneNumber)
  if (bySceneNumber.length > 0) return bySceneNumber
  const byKeyword = clips.filter(clip => clip.keyword === scene.searchKeyword)
  if (byKeyword.length > 0) return byKeyword
  return clips
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )
  return results
}

function positiveInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function boundedTimeout(deadlineAt: number, preferredMs: number) {
  const remaining = deadlineAt - Date.now()
  if (remaining <= 0) throw new YouTubeRenderTimeoutError()
  return Math.max(1_000, Math.min(preferredMs, remaining))
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function safeFilePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'shorts'
}

function renderLogContext(params: RenderYouTubeShortsParams) {
  return {
    userId: params.userId,
    dayId: params.dayId,
    title: params.title,
  }
}

async function readStreamChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`stream idle timeout after ${idleTimeoutMs}ms`)), idleTimeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
