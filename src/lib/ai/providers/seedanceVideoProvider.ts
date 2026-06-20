/**
 * ByteDance Volcano Ark — Seedance video generation provider
 *
 * API flow:
 *   POST  https://ark.cn-beijing.volces.com/api/v3/videos/generations
 *   GET   https://ark.cn-beijing.volces.com/api/v3/videos/generations/{id}  (poll until succeeded)
 */

const DEFAULT_ARK_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3'
const ARK_BASE = normalizeBaseUrl(
  process.env.BYTEDANCE_BASE_URL ||
  process.env.ARK_BASE_URL ||
  DEFAULT_ARK_BASE,
)
const SEEDANCE_MODEL = process.env.BYTEDANCE_VIDEO_MODEL || 'seedance-1-5-pro-250528'

export interface SeedanceVideoOptions {
  prompt: string
  duration?: 3 | 5          // seconds
  aspectRatio?: '9:16' | '16:9' | '1:1'
  resolution?: '480p' | '720p' | '1080p'
  cameraFixed?: boolean      // lock camera — more stable, less dynamic
}

export interface SeedanceVideoResult {
  taskId: string
  videoUrl: string
  coverUrl?: string
  durationSeconds: number
}

// Transient HTTP status codes that are safe to retry
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_SUBMIT_ATTEMPTS = 3
const MAX_POLL_TRANSIENT_ERRORS = 4

export class SeedanceVideoProvider {
  private apiKey: string

  constructor(apiKey = process.env.BYTEDANCE_API_KEY || process.env.ARK_API_KEY) {
    const normalizedKey = apiKey?.trim()
    if (!normalizedKey) throw new Error('BYTEDANCE_API_KEY or ARK_API_KEY is not set.')
    this.apiKey = normalizedKey
  }

  async generateVideo(options: SeedanceVideoOptions): Promise<SeedanceVideoResult> {
    const { prompt, duration = 5, aspectRatio = '9:16', resolution = '720p' } = options

    const taskId = await this.submitWithRetry({
      prompt,
      duration,
      aspectRatio,
      resolution,
      cameraFixed: options.cameraFixed,
    })

    const videoUrl = await this.pollUntilDone(taskId, 240_000, 3_000)
    return { taskId, videoUrl, durationSeconds: duration }
  }

  private async submitWithRetry(
    params: {
      prompt: string
      duration: number
      aspectRatio: string
      resolution: string
      cameraFixed?: boolean
    },
  ): Promise<string> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_SUBMIT_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s
        await sleep(1000 * Math.pow(2, attempt - 1))
      }

      let res: Response
      try {
        res = await fetch(`${ARK_BASE}/videos/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: SEEDANCE_MODEL,
            content: [{ type: 'text', text: params.prompt }],
            parameters: {
              duration: params.duration,
              resolution: params.resolution,
              aspect_ratio: params.aspectRatio,
              camera_fixed: params.cameraFixed ?? false,
            },
          }),
        })
      } catch (err) {
        // Network-level failure (DNS, connection reset, etc.) — retry
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[Seedance] submit network error (attempt ${attempt + 1}/${MAX_SUBMIT_ATTEMPTS}):`, lastError.message)
        continue
      }

      const text = await res.text()
      let data: { id?: string; task_id?: string; error?: { message: string; code?: string } }
      try {
        data = JSON.parse(text)
      } catch {
        lastError = new Error(`Seedance submit returned invalid JSON response: ${text.slice(0, 180)}`)
        console.warn(`[Seedance] submit bad JSON (attempt ${attempt + 1}/${MAX_SUBMIT_ATTEMPTS})`)
        continue
      }

      if (data.error) {
        // Server-side errors may be transient (rate limit / overload) — retry
        lastError = new Error(`Seedance error: ${data.error.message}`)
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
          // Non-retryable client errors
          throw lastError
        }
        console.warn(`[Seedance] submit error ${res.status} (attempt ${attempt + 1}/${MAX_SUBMIT_ATTEMPTS}):`, data.error.message)
        continue
      }

      const taskId = data.id || data.task_id
      if (!taskId) {
        lastError = new Error('Seedance: no task_id returned')
        console.warn(`[Seedance] submit missing task_id (attempt ${attempt + 1}/${MAX_SUBMIT_ATTEMPTS})`)
        continue
      }

      return taskId
    }

    throw lastError ?? new Error('Seedance: submit failed after retries')
  }

  private async pollUntilDone(taskId: string, timeoutMs: number, intervalMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs
    let transientErrorCount = 0

    // Check immediately — some providers finish quickly
    const firstResult = await this.pollOnce(taskId)
    if (firstResult.done) return firstResult.videoUrl!
    // If the task already failed/cancelled, fail fast
    if (firstResult.terminalError) throw new Error(firstResult.terminalError)

    while (Date.now() < deadline) {
      await sleep(intervalMs)

      let result: PollResult
      try {
        result = await this.pollOnce(taskId)
      } catch (err) {
        // Network-level failure during poll — don't throw, keep trying
        transientErrorCount++
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[Seedance] poll transient error (${transientErrorCount}/${MAX_POLL_TRANSIENT_ERRORS}):`, msg)
        if (transientErrorCount > MAX_POLL_TRANSIENT_ERRORS) {
          throw new Error(`Seedance: poll failed repeatedly — ${msg}`)
        }
        continue
      }

      // Successful poll resets transient counter
      transientErrorCount = 0

      if (result.done) return result.videoUrl!
      if (result.terminalError) throw new Error(result.terminalError)
      // otherwise pending/running — continue
    }

    throw new Error(`Seedance: task ${taskId} timed out after ${timeoutMs / 1000}s`)
  }

  private async pollOnce(taskId: string): Promise<PollResult> {
    const res = await fetch(`${ARK_BASE}/videos/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    })

    if (!res.ok) {
      // Retryable HTTP error on poll — surface as transient
      if (RETRYABLE_STATUSES.has(res.status)) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Seedance poll HTTP ${res.status}: ${errText.slice(0, 120)}`)
      }
      // Non-retryable (auth/not-found) — fail fast
      const errText = await res.text().catch(() => '')
      throw new Error(`Seedance poll failed (${res.status}): ${errText}`)
    }

    const text = await res.text()
    let data: {
      status?: string
      output?: { video_url?: string; cover_image_url?: string }
      error?: { message: string }
    }
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Seedance poll returned invalid JSON: ${text.slice(0, 180)}`)
    }

    if (data.error) {
      return { done: false, terminalError: `Seedance task error: ${data.error.message}` }
    }

    if (data.status === 'succeeded' || data.status === 'completed') {
      const url = data.output?.video_url
      if (!url) return { done: false, terminalError: 'Seedance: task succeeded but no video_url' }
      return { done: true, videoUrl: url }
    }

    if (data.status === 'failed' || data.status === 'cancelled') {
      return { done: false, terminalError: `Seedance task ${data.status}` }
    }

    // pending / running / queued
    return { done: false }
  }
}

interface PollResult {
  done: boolean
  videoUrl?: string
  terminalError?: string
}

export function canUseSeedance(): boolean {
  const key = process.env.BYTEDANCE_API_KEY || process.env.ARK_API_KEY
  return Boolean(key?.trim() && key.trim().length > 10)
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
