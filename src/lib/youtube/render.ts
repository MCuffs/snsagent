import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import OpenAI from 'openai'
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
  onProgress?: (progress: number, stage: string) => Promise<void>
  shouldCancel?: () => Promise<boolean>
}

export interface RenderQualityNote {
  type: 'generated_clip' | 'tts_probe_failed'
  sceneNumber?: number
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
const DOWNLOAD_CONCURRENCY = positiveInteger(process.env.YOUTUBE_RENDER_DOWNLOAD_CONCURRENCY, 1, 1, 3)
const TTS_CONCURRENCY = positiveInteger(process.env.YOUTUBE_RENDER_TTS_CONCURRENCY, 2, 1, 3)
const FFMPEG_CONCURRENCY = positiveInteger(process.env.YOUTUBE_RENDER_FFMPEG_CONCURRENCY, 2, 1, 2)
const TTS_MAX_CHARS = 3900

export async function renderYouTubeShortsFromStock(params: RenderYouTubeShortsParams): Promise<StoredRenderedAsset> {
  const usableClips = params.sourceClips.filter(clip => clip.videoUrl)
  if (usableClips.length === 0) {
    throw new Error('Pexels/Pixabay 영상 후보가 없습니다. API 키 또는 검색 키워드를 확인해 주세요.')
  }
  const workRoot = path.join(os.tmpdir(), 'shuffla-youtube-automation')
  await fs.mkdir(workRoot, { recursive: true })
  const workDir = await fs.mkdtemp(path.join(workRoot, `${params.dayId}-`))
  const deadlineAt = Date.now() + TOTAL_RENDER_TIMEOUT_MS
  const qualityNotes: RenderQualityNote[] = []
  const addQualityNote = (note: RenderQualityNote) => {
    if (!qualityNotes.some(existing => existing.type === note.type && existing.sceneNumber === note.sceneNumber)) {
      qualityNotes.push(note)
    }
  }

  try {
    logYouTubeAutomation('info', 'render_workdir_created', renderLogContext(params), {
      sceneCount: params.scenes.length,
      usableClipCount: usableClips.length,
      downloadConcurrency: DOWNLOAD_CONCURRENCY,
      ttsConcurrency: TTS_CONCURRENCY,
      ffmpegConcurrency: FFMPEG_CONCURRENCY,
    })
    await reportProgress(params, 31, '렌더링 준비 중')
    const fontsDir = path.join(workDir, 'fonts')
    await fs.mkdir(fontsDir, { recursive: true })
    await copyFontIfAvailable(fontsDir)

    // ── Step 1: Generate all TTS in parallel + pre-download all clips in parallel ──
    const ttsProvider = await getTtsProvider()
    await ensureNotCancelled(params)

    let completedTtsCount = 0
    let completedDownloadCount = 0
    const reportAssetPreparationProgress = async () => {
      const totalUnits = Math.max(1, params.scenes.length * 2)
      const doneUnits = completedTtsCount + completedDownloadCount
      await reportProgress(
        params,
        Math.min(44, 31 + Math.round((doneUnits / totalUnits) * 13)),
        `TTS/영상 소스 준비 중 (${completedTtsCount}/${params.scenes.length}, ${completedDownloadCount}/${params.scenes.length})`,
      )
    }
    logYouTubeAutomation('info', 'render_asset_prepare_start', renderLogContext(params), {
      sceneCount: params.scenes.length,
      ttsProvider,
    })
    const [ttsResults, rawClipPaths] = await Promise.all([
      mapWithConcurrency(params.scenes, TTS_CONCURRENCY, async (scene, index) => {
          const sceneStartedAt = Date.now()
          await ensureCanContinue(params, deadlineAt)
          const sceneSpeechPath = path.join(workDir, `tts-${index + 1}.mp3`)
          logYouTubeAutomation('info', 'render_tts_scene_start', renderLogContext(params), {
            sceneNumber: scene.sceneNumber,
            sceneIndex: index + 1,
            narrationLength: scene.narration.length,
          })
          try {
            await withTimeout(
              createSceneSpeechAudio(scene.narration, sceneSpeechPath, scene.durationSeconds, params.ttsVoice),
              boundedTimeout(deadlineAt, TTS_SCENE_TIMEOUT_MS),
              `씬 ${index + 1} TTS 생성이 ${Math.round(TTS_SCENE_TIMEOUT_MS / 1000)}초를 초과했습니다.`,
            )
            await ensureCanContinue(params, deadlineAt)
            const actualDuration = await probeAudioDuration(sceneSpeechPath, () => {
              addQualityNote({ type: 'tts_probe_failed', sceneNumber: scene.sceneNumber })
            })
            await ensureCanContinue(params, deadlineAt)
            completedTtsCount += 1
            logYouTubeAutomation('info', 'render_tts_scene_done', renderLogContext(params), {
              sceneNumber: scene.sceneNumber,
              sceneIndex: index + 1,
              actualDuration,
              durationMs: Date.now() - sceneStartedAt,
            })
            await reportAssetPreparationProgress()
            return { sceneSpeechPath, actualDuration }
          } catch (error) {
            logYouTubeAutomation('error', 'render_tts_scene_failed', renderLogContext(params), {
              sceneNumber: scene.sceneNumber,
              sceneIndex: index + 1,
              durationMs: Date.now() - sceneStartedAt,
              ...summarizeYouTubeAutomationError(error),
            })
            throw error
          }
        }),
      mapWithConcurrency(params.scenes, DOWNLOAD_CONCURRENCY, async (_, index) => {
          const sceneStartedAt = Date.now()
          await ensureCanContinue(params, deadlineAt)
          const scene = params.scenes[index]
          const sceneMatches = preferFastSourceClips(clipsForScene(scene, usableClips))
          const sceneClipKeys = new Set(sceneMatches.map(clip => `${clip.provider}:${clip.id}`))
          const fallbackClips = preferFastSourceClips(usableClips)
            .filter(clip => !sceneClipKeys.has(`${clip.provider}:${clip.id}`))
          const sceneClips = [...sceneMatches, ...fallbackClips]
          const attempts = Math.max(1, Math.min(CLIP_NORMALIZE_MAX_ATTEMPTS, sceneClips.length))
          let lastError: unknown
          try {
            for (let attempt = 0; attempt < attempts; attempt += 1) {
              const clip = sceneClips[attempt]
              if (!clip?.videoUrl) continue
              const attemptStartedAt = Date.now()
              const rawPath = path.join(workDir, `source-${index + 1}-${attempt + 1}.mp4`)
              logYouTubeAutomation('info', 'render_download_scene_start', renderLogContext(params), {
                sceneNumber: scene.sceneNumber,
                sceneIndex: index + 1,
                attempt: attempt + 1,
                provider: clip.provider,
                clipId: clip.id,
              })
              await reportProgress(
                params,
                Math.min(44, 31 + Math.round(((completedTtsCount + completedDownloadCount) / Math.max(1, params.scenes.length * 2)) * 13)),
                `TTS/source prep (${completedTtsCount}/${params.scenes.length}, ${completedDownloadCount}/${params.scenes.length}) - downloading scene ${index + 1}/${params.scenes.length}, attempt ${attempt + 1}/${attempts}`,
              )
              try {
                await downloadVideo(clip.videoUrl, rawPath, params.shouldCancel, boundedTimeout(deadlineAt, DOWNLOAD_TIMEOUT_MS))
                await ensureCanContinue(params, deadlineAt)
                completedDownloadCount += 1
                logYouTubeAutomation('info', 'render_download_scene_done', renderLogContext(params), {
                  sceneNumber: scene.sceneNumber,
                  sceneIndex: index + 1,
                  attempt: attempt + 1,
                  provider: clip.provider,
                  clipId: clip.id,
                  durationMs: Date.now() - attemptStartedAt,
                })
                await reportAssetPreparationProgress()
                return rawPath
              } catch (error) {
                if (error instanceof YouTubeRenderCancelledError) throw error
                lastError = error
                await fs.rm(rawPath, { force: true }).catch(() => undefined)
                logYouTubeAutomation(attempt + 1 >= attempts ? 'error' : 'warn', 'render_download_scene_attempt_failed', renderLogContext(params), {
                  sceneNumber: scene.sceneNumber,
                  sceneIndex: index + 1,
                  attempt: attempt + 1,
                  attempts,
                  provider: clip.provider,
                  clipId: clip.id,
                  durationMs: Date.now() - attemptStartedAt,
                  ...summarizeYouTubeAutomationError(error),
                })
                await reportProgress(
                  params,
                  Math.min(44, 31 + Math.round(((completedTtsCount + completedDownloadCount) / Math.max(1, params.scenes.length * 2)) * 13)),
                  `TTS/source prep (${completedTtsCount}/${params.scenes.length}, ${completedDownloadCount}/${params.scenes.length}) - retrying scene ${index + 1}/${params.scenes.length} after attempt ${attempt + 1}/${attempts}`,
                )
              }
            }
            const fallbackPath = path.join(workDir, `source-${index + 1}-generated.mp4`)
            logYouTubeAutomation('warn', 'render_download_scene_using_generated_fallback', renderLogContext(params), {
              sceneNumber: scene.sceneNumber,
              sceneIndex: index + 1,
              attempts,
              ...summarizeYouTubeAutomationError(lastError),
            })
            await createGeneratedSourceClip(
              fallbackPath,
              Math.max(2, scene.durationSeconds),
              params.shouldCancel,
              boundedTimeout(deadlineAt, NORMALIZE_TIMEOUT_MS),
            )
            addQualityNote({ type: 'generated_clip', sceneNumber: scene.sceneNumber })
            completedDownloadCount += 1
            await reportAssetPreparationProgress()
            return fallbackPath
          } catch (error) {
            logYouTubeAutomation('error', 'render_download_scene_failed', renderLogContext(params), {
              sceneNumber: scene.sceneNumber,
              sceneIndex: index + 1,
              durationMs: Date.now() - sceneStartedAt,
              ...summarizeYouTubeAutomationError(error),
            })
            throw error
          }
        }),
    ])
    logYouTubeAutomation('info', 'render_asset_prepare_done', renderLogContext(params), {
      ttsCount: ttsResults.length,
      downloadCount: rawClipPaths.length,
    })
    await reportProgress(params, 45, 'TTS 녹음 및 영상 소스 준비 완료')

    const sceneAudioPaths = ttsResults.map(r => r.sceneSpeechPath)
    const actualDurations = ttsResults.map(r => r.actualDuration)
    const totalDuration = actualDurations.reduce((sum, duration) => sum + duration, 0)

    // ── Step 2: Normalize each clip to actual TTS duration ──
    // FFmpeg is CPU-bound. On Vercel's small vCPU functions, running one per scene is
    // usually faster and more stable than spawning all scene encodes at once.
    await ensureCanContinue(params, deadlineAt)
    let normalizedCount = 0
    const normalizedClips = await mapWithConcurrency(
      params.scenes,
      FFMPEG_CONCURRENCY,
      async (scene, index) => {
        await ensureCanContinue(params, deadlineAt)
        const normalizedPath = path.join(workDir, `clip-${index + 1}.mp4`)
        await normalizeClipWithFallback({
          userId: params.userId,
          dayId: params.dayId,
          title: params.title,
          scene,
          sceneIndex: index,
          initialInputPath: rawClipPaths[index],
          outputPath: normalizedPath,
          durationSeconds: actualDurations[index],
          template: params.template,
          shouldCancel: params.shouldCancel,
          usableClips,
          workDir,
          deadlineAt,
          onGeneratedFallback: () => addQualityNote({ type: 'generated_clip', sceneNumber: scene.sceneNumber }),
        })
        normalizedCount += 1
        await reportProgress(
          params,
          Math.min(67, 45 + Math.round((normalizedCount / params.scenes.length) * 22)),
          `씬별 영상 렌더링 중 (${normalizedCount}/${params.scenes.length})`,
        )
        return normalizedPath
      },
    )
    await reportProgress(params, 68, '씬별 영상 컷 완료')

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

    return { mp4Url, thumbnailUrl, ttsAudioUrl, ttsProvider, subtitles, qualityNotes }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
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

async function normalizeClipWithFallback(params: {
  userId: string
  dayId: string
  title: string
  scene: YouTubeScenePlan
  sceneIndex: number
  initialInputPath: string
  outputPath: string
  durationSeconds: number
  template?: YouTubeShortsTemplateRecord
  shouldCancel?: () => Promise<boolean>
  usableClips: StockVideoCandidate[]
  workDir: string
  deadlineAt: number
  onGeneratedFallback?: () => void
}) {
  const sceneClips = preferFastSourceClips(clipsForScene(params.scene, params.usableClips))
  const attempts = Math.max(1, Math.min(CLIP_NORMALIZE_MAX_ATTEMPTS, sceneClips.length))
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (Date.now() >= params.deadlineAt) throw new YouTubeRenderTimeoutError()
    await params.shouldCancel?.().then(cancel => {
      if (cancel) throw new YouTubeRenderCancelledError()
    })

    try {
      const inputPath = attempt === 0
        ? params.initialInputPath
        : await downloadFallbackClip(params, sceneClips[attempt], attempt)

      await normalizeClip({
        inputPath,
        outputPath: params.outputPath,
        durationSeconds: params.durationSeconds,
        template: params.template,
        shouldCancel: params.shouldCancel,
        timeoutMs: boundedTimeout(params.deadlineAt, NORMALIZE_TIMEOUT_MS),
      })
      return
    } catch (error) {
      if (error instanceof YouTubeRenderCancelledError) throw error
      lastError = error
      console.warn(`[YouTubeRender] Scene ${params.sceneIndex + 1} normalize attempt ${attempt + 1} failed`, error)
    }
  }

  logYouTubeAutomation('warn', 'render_normalize_scene_using_generated_fallback', {
    userId: params.userId,
    dayId: params.dayId,
    title: params.title,
  }, {
    sceneIndex: params.sceneIndex + 1,
    attempts,
    ...summarizeYouTubeAutomationError(lastError),
  })
  params.onGeneratedFallback?.()
  await createGeneratedSourceClip(
    params.outputPath,
    Math.max(1, params.durationSeconds),
    params.shouldCancel,
    boundedTimeout(params.deadlineAt, NORMALIZE_TIMEOUT_MS),
  )
}

async function downloadFallbackClip(params: {
  sceneIndex: number
  workDir: string
  shouldCancel?: () => Promise<boolean>
  deadlineAt: number
}, clip: StockVideoCandidate, attempt: number) {
  if (!clip?.videoUrl) throw new Error('대체 영상 클립을 찾을 수 없습니다.')
  const rawPath = path.join(params.workDir, `source-${params.sceneIndex + 1}-fallback-${attempt}.mp4`)
  await downloadVideo(clip.videoUrl, rawPath, params.shouldCancel, boundedTimeout(params.deadlineAt, DOWNLOAD_TIMEOUT_MS))
  return rawPath
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
    super('전체 영상 렌더링 제한 시간을 초과했습니다.')
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
    const source = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', fileName)
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

  const directory = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'generated', 'youtube', params.userId)
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
