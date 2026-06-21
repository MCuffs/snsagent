/**
 * ByteDance Volcano Ark — Seedance video generation provider
 *
 * API flow:
 *   POST  https://ark.ap-southeast.bytepluses.com/api/v3/videos/generations
 *   GET   https://ark.ap-southeast.bytepluses.com/api/v3/videos/generations/{id}  (poll until succeeded)
 */

const DEFAULT_ARK_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3'
const ARK_BASE = normalizeBaseUrl(
  process.env.BYTEDANCE_BASE_URL ||
  process.env.ARK_BASE_URL ||
  DEFAULT_ARK_BASE,
)
// BytePlus international model ID: bytedance-seedance-1.5-pro
// Volcengine (China) model ID: seedance-1-5-pro-250528
const SEEDANCE_MODEL = process.env.BYTEDANCE_VIDEO_MODEL || 'bytedance-seedance-1.5-pro'

export interface SeedanceVideoOptions {
  prompt: string
  duration?: 3 | 5          // seconds
  aspectRatio?: '9:16' | '16:9' | '1:1'
  resolution?: '480p' | '720p' | '1080p'
}

export interface SeedanceVideoResult {
  taskId: string
  videoUrl: string
  coverUrl?: string
  durationSeconds: number
}

export type SeedanceProgressEvent =
  | { type: 'submit_ok'; taskId: string }
  | { type: 'poll'; status: string; elapsed: number }
  | { type: 'done'; videoUrl: string }
  | { type: 'error'; message: string }

// Transient HTTP status codes that are safe to retry
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_SUBMIT_ATTEMPTS = 3
const MAX_POLL_TRANSIENT_ERRORS = 4

export class SeedanceVideoProvider {
  private apiKey: string

  constructor(apiKey = process.env.BYTEDANCE_API_KEY || process.env.ARK_API_KEY) {
    const normalizedKey = sanitizeEnvValue(apiKey)
    if (!normalizedKey) throw new Error('BYTEDANCE_API_KEY or ARK_API_KEY is not set.')
    this.apiKey = normalizedKey
  }

  async generateVideo(
    options: SeedanceVideoOptions,
    onProgress?: (event: SeedanceProgressEvent) => void,
  ): Promise<SeedanceVideoResult> {
    const { prompt, duration = 5, aspectRatio = '9:16', resolution = '720p' } = options

    const taskId = await this.submitWithRetry({ prompt, duration, aspectRatio, resolution })
    onProgress?.({ type: 'submit_ok', taskId })

    const videoUrl = await this.pollUntilDone(taskId, 270_000, 4_000, onProgress)
    onProgress?.({ type: 'done', videoUrl })
    return { taskId, videoUrl, durationSeconds: duration }
  }

  private buildRequestBody(params: {
    prompt: string
    duration: number
    aspectRatio: string
    resolution: string
  }) {
    // BytePlus ModelArk Seedance API
    // Ref: https://www.byteplus.com/en/docs/modelark/seedance
    // Primary format: content array with text type + parameters object
    // Fallback tested: prompt at root, size field
    return {
      model: SEEDANCE_MODEL,
      content: [{ type: 'text', text: params.prompt }],
      parameters: {
        duration: params.duration,
        size: aspectRatioToSize(params.aspectRatio, params.resolution),
      },
    }
  }

  private async submitWithRetry(
    params: {
      prompt: string
      duration: number
      aspectRatio: string
      resolution: string
    },
  ): Promise<string> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_SUBMIT_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(1000 * Math.pow(2, attempt - 1))
      }

      const reqBody = this.buildRequestBody(params)

      let res: Response
      try {
        res = await fetch(`${ARK_BASE}/videos/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reqBody),
        })
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[Seedance] submit network error (attempt ${attempt + 1}/${MAX_SUBMIT_ATTEMPTS}):`, lastError.message)
        continue
      }

      const text = await res.text()
      console.log(`[Seedance] submit ${res.status} (attempt ${attempt + 1}):`, text.slice(0, 400))

      let data: {
        id?: string
        task_id?: string
        request_id?: string
        error?: { message: string; code?: string | number }
        // some error formats
        message?: string
        code?: string | number
      }
      try {
        data = JSON.parse(text)
      } catch {
        lastError = new Error(`Seedance submit returned invalid JSON (${res.status}), content-type=${res.headers.get('content-type')}: ${text.slice(0, 300)}`)
        console.warn(`[Seedance] submit bad JSON attempt ${attempt + 1}, full response:`, text.slice(0, 500))
        continue
      }

      // Handle various error response shapes
      const errorMsg = data.error?.message || (typeof data.message === 'string' ? data.message : null)
      const errorCode = data.error?.code ?? data.code

      if (!res.ok || errorMsg) {
        let errorWithDiagnostics = `Seedance API error (HTTP ${res.status}, code: ${errorCode ?? 'none'}): ${errorMsg ?? 'unknown error'}`
        if (res.status === 401) {
          const maskedKey = this.apiKey ? `${this.apiKey.slice(0, 6)}...${this.apiKey.slice(-6)} (len: ${this.apiKey.length})` : 'empty'
          errorWithDiagnostics += ` (Endpoint: ${ARK_BASE}/videos/generations, API Key: ${maskedKey})`
        }
        lastError = new Error(errorWithDiagnostics)
        console.error(`[Seedance] submit error attempt ${attempt + 1}:`, { status: res.status, errorCode, errorMsg, body: text.slice(0, 300) })

        // Non-retryable client errors — fail immediately with full detail
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
          throw lastError
        }
        continue
      }

      const taskId = data.id || data.task_id
      if (!taskId) {
        lastError = new Error(`Seedance submit returned no task ID. Response: ${text.slice(0, 200)}`)
        console.warn(`[Seedance] submit missing task_id attempt ${attempt + 1}`)
        continue
      }

      console.log(`[Seedance] task submitted: ${taskId}`)
      return taskId
    }

    throw lastError ?? new Error('Seedance: submit failed after retries')
  }

  private async pollUntilDone(
    taskId: string,
    timeoutMs: number,
    intervalMs: number,
    onProgress?: (event: SeedanceProgressEvent) => void,
  ): Promise<string> {
    const startAt = Date.now()
    const deadline = startAt + timeoutMs
    let transientErrorCount = 0

    const firstResult = await this.pollOnce(taskId)
    if (firstResult.done) return firstResult.videoUrl!
    if (firstResult.terminalError) throw new Error(firstResult.terminalError)
    onProgress?.({ type: 'poll', status: firstResult.status ?? 'pending', elapsed: 0 })

    while (Date.now() < deadline) {
      await sleep(intervalMs)

      let result: PollResult
      try {
        result = await this.pollOnce(taskId)
      } catch (err) {
        transientErrorCount++
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[Seedance] poll transient error (${transientErrorCount}/${MAX_POLL_TRANSIENT_ERRORS}):`, msg)
        if (transientErrorCount > MAX_POLL_TRANSIENT_ERRORS) {
          throw new Error(`Seedance: poll failed repeatedly — ${msg}`)
        }
        continue
      }

      transientErrorCount = 0
      const elapsed = Math.round((Date.now() - startAt) / 1000)
      onProgress?.({ type: 'poll', status: result.status ?? 'running', elapsed })

      if (result.done) return result.videoUrl!
      if (result.terminalError) throw new Error(result.terminalError)
    }

    throw new Error(`Seedance: task ${taskId} timed out after ${timeoutMs / 1000}s`)
  }

  private async pollOnce(taskId: string): Promise<PollResult> {
    const res = await fetch(`${ARK_BASE}/videos/generations/${taskId}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    })

    if (!res.ok) {
      if (RETRYABLE_STATUSES.has(res.status)) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Seedance poll HTTP ${res.status}: ${errText.slice(0, 120)}`)
      }
      const errText = await res.text().catch(() => '')
      throw new Error(`Seedance poll failed (${res.status}): ${errText.slice(0, 200)}`)
    }

    const text = await res.text()
    let data: {
      status?: string
      output?: { video_url?: string; cover_image_url?: string } | string | null
      error?: { message: string }
      video_url?: string  // some versions return at top level
    }
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Seedance poll returned invalid JSON: ${text.slice(0, 180)}`)
    }

    if (data.error) {
      console.error(`[Seedance] poll task error for ${taskId}:`, data.error, text.slice(0, 300))
      return { done: false, terminalError: `Seedance task error: ${data.error.message}`, status: 'failed' }
    }

    const status = data.status ?? 'unknown'
    console.log(`[Seedance] poll ${taskId} status=${status}`)

    if (status === 'succeeded' || status === 'completed') {
      const url =
        (typeof data.output === 'object' && data.output !== null ? data.output.video_url : undefined) ||
        data.video_url
      if (!url) {
        console.error('[Seedance] task succeeded but no video_url. Full response:', text.slice(0, 500))
        return { done: false, terminalError: 'Seedance: task succeeded but video_url is missing in response', status }
      }
      return { done: true, videoUrl: url, status }
    }

    if (status === 'failed' || status === 'cancelled') {
      console.error(`[Seedance] task ${status} for ${taskId}. Response:`, text.slice(0, 500))
      return { done: false, terminalError: `Seedance task ${status}`, status }
    }

    return { done: false, status }
  }
}

interface PollResult {
  done: boolean
  videoUrl?: string
  terminalError?: string
  status?: string
}

export function canUseSeedance(): boolean {
  const key = process.env.BYTEDANCE_API_KEY || process.env.ARK_API_KEY
  const cleanKey = sanitizeEnvValue(key)
  return Boolean(cleanKey && cleanKey.length > 10)
}

function sanitizeEnvValue(val: string | undefined): string | undefined {
  if (!val) return val
  let clean = val.trim()
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.slice(1, -1).trim()
  } else if (clean.startsWith("'") && clean.endsWith("'")) {
    clean = clean.slice(1, -1).trim()
  }
  return clean
}

// BytePlus Seedance uses a "size" string like "720x1280" instead of separate
// aspect_ratio + resolution fields.
function aspectRatioToSize(aspectRatio: string, resolution: string): string {
  const height = resolution === '1080p' ? 1920 : resolution === '480p' ? 854 : 1280
  const shortSide = Math.round(height * 9 / 16)

  if (aspectRatio === '9:16') return `${shortSide}x${height}`
  if (aspectRatio === '16:9') return `${height}x${shortSide}`
  // 1:1
  return `${shortSide}x${shortSide}`
}

function normalizeBaseUrl(value: string) {
  const clean = sanitizeEnvValue(value) || ''
  return clean.replace(/\/+$/, '')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
