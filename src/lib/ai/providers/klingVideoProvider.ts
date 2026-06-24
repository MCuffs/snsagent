import { createHmac } from 'crypto'

const DEFAULT_KLING_BASE = 'https://api-singapore.klingai.com'
const KLING_BASE = normalizeBaseUrl(process.env.KLINGAI_BASE_URL || DEFAULT_KLING_BASE)
const KLING_MODEL = normalizeKlingModel(process.env.KLINGAI_VIDEO_MODEL)

export interface KlingVideoOptions {
  prompt: string
  duration?: 3 | 5 | 10
  aspectRatio?: '9:16' | '16:9' | '1:1'
  referenceImageUrls?: string[]
  signal?: AbortSignal
}

export interface KlingVideoResult {
  taskId: string
  videoUrl: string
  durationSeconds: number
}

export type KlingProgressEvent =
  | { type: 'submit_ok'; taskId: string }
  | { type: 'poll'; status: string; elapsed: number }
  | { type: 'done'; videoUrl: string }

const MAX_SUBMIT_ATTEMPTS = 2
const MAX_POLL_TRANSIENT_ERRORS = 4
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export class KlingVideoProvider {
  private apiKey?: string
  private accessKey?: string
  private secretKey?: string

  constructor(
    accessKey = process.env.KLINGAI_ACCESS_KEY,
    secretKey = process.env.KLINGAI_SECRET_KEY,
    apiKey = process.env.KLINGAI_API_KEY,
  ) {
    const cleanApiKey = sanitizeEnvValue(apiKey)
    const cleanAccessKey = sanitizeEnvValue(accessKey)
    const cleanSecretKey = sanitizeEnvValue(secretKey)
    if (!cleanApiKey && (!cleanAccessKey || !cleanSecretKey)) {
      throw new Error('KLINGAI_API_KEY or KLINGAI_ACCESS_KEY/KLINGAI_SECRET_KEY is not set.')
    }
    this.apiKey = cleanApiKey
    this.accessKey = cleanAccessKey
    this.secretKey = cleanSecretKey
  }

  async generateVideo(
    options: KlingVideoOptions,
    onProgress?: (event: KlingProgressEvent) => void,
  ): Promise<KlingVideoResult> {
    const { duration = 5, signal } = options
    const submitted = await this.submitWithRetry(options)
    const taskId = submitted.taskId
    onProgress?.({ type: 'submit_ok', taskId })

    const videoUrl = await this.pollUntilDone(submitted, 600_000, 5_000, onProgress, signal)
    onProgress?.({ type: 'done', videoUrl })
    return { taskId, videoUrl, durationSeconds: duration }
  }

  private async submitWithRetry(options: KlingVideoOptions): Promise<KlingSubmittedTask> {
    let lastError: Error | null = null
    const endpoint = options.referenceImageUrls?.length
      ? `/image-to-video/${KLING_MODEL}`
      : `/text-to-video/${KLING_MODEL}`
    const submitUrl = `${KLING_BASE}${endpoint}`

    for (let attempt = 0; attempt < MAX_SUBMIT_ATTEMPTS; attempt++) {
      options.signal?.throwIfAborted()
      if (attempt > 0) {
        await sleep(1000 * attempt, options.signal)
      }

      const reqBody = this.buildRequestBody(options)
      console.log(
        `[Kling] submit attempt ${attempt + 1} → ${submitUrl} model=${KLING_MODEL} refs=${options.referenceImageUrls?.length ?? 0}`,
        JSON.stringify(reqBody).slice(0, 300),
      )

      let res: Response
      try {
        res = await fetch(submitUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reqBody),
          signal: options.signal,
        })
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[Kling] submit network error attempt ${attempt + 1}:`, lastError.message)
        continue
      }

      const text = await res.text()
      console.log(`[Kling] submit ${res.status} content-type=${res.headers.get('content-type')} body=${text.slice(0, 400)}`)
      let data: KlingCreateTaskResponse
      try {
        data = JSON.parse(text) as KlingCreateTaskResponse
      } catch {
        lastError = new Error(`Kling submit returned invalid JSON (${res.status}): ${text.slice(0, 300)}`)
        continue
      }

      const code = data.code ?? data.error_code
      const message = data.message ?? data.error_message
      if (!res.ok || isErrorCode(code)) {
        lastError = new Error(`Kling API error (HTTP ${res.status}, code: ${code ?? 'none'}): ${message ?? 'unknown error'}`)
        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
          throw lastError
        }
        continue
      }

      const taskId = data.data?.task_id || data.task_id || data.id
        || data.data?.id
      if (!taskId) {
        lastError = new Error(`Kling submit returned no task ID. Response: ${text.slice(0, 240)}`)
        continue
      }
      return { taskId }
    }

    throw lastError ?? new Error('Kling: submit failed after retries')
  }

  private buildRequestBody(options: KlingVideoOptions) {
    const duration = options.duration ?? 5
    const aspectRatio = options.aspectRatio ?? '9:16'
    const firstReference = options.referenceImageUrls?.[0]
    if (!firstReference) {
      return {
        prompt: options.prompt.slice(0, 3072),
        settings: {
          duration,
          resolution: '720p',
          aspect_ratio: aspectRatio,
        },
        options: {
          watermark_info: { enabled: false },
        },
      }
    }

    return {
      contents: [
        { type: 'prompt', text: options.prompt.slice(0, 2500) },
        { type: 'first_frame', url: firstReference },
      ],
      settings: {
        duration,
        resolution: '720p',
        aspect_ratio: aspectRatio,
      },
      options: {
        watermark_info: { enabled: false },
      },
    }
  }

  private async pollUntilDone(
    submitted: KlingSubmittedTask,
    timeoutMs: number,
    intervalMs: number,
    onProgress?: (event: KlingProgressEvent) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const { taskId } = submitted
    const startAt = Date.now()
    const deadline = startAt + timeoutMs
    let transientErrorCount = 0

    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      const elapsed = Math.round((Date.now() - startAt) / 1000)

      let result: KlingPollResult
      try {
        result = await this.pollOnce(submitted, signal)
      } catch (err) {
        transientErrorCount++
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[Kling] poll transient error (${transientErrorCount}/${MAX_POLL_TRANSIENT_ERRORS}):`, msg)
        if (transientErrorCount > MAX_POLL_TRANSIENT_ERRORS) {
          throw new Error(`Kling: poll failed repeatedly → ${msg}`)
        }
        await sleep(intervalMs, signal)
        continue
      }

      transientErrorCount = 0
      onProgress?.({ type: 'poll', status: result.status ?? 'running', elapsed })
      if (result.done && result.videoUrl) return result.videoUrl
      if (result.terminalError) throw new Error(result.terminalError)
      await sleep(intervalMs, signal)
    }

    throw new Error(`Kling: task ${taskId} timed out after ${timeoutMs / 1000}s`)
  }

  private async pollOnce(submitted: KlingSubmittedTask, signal?: AbortSignal): Promise<KlingPollResult> {
    const pollUrl = `${KLING_BASE}/tasks?task_ids=${encodeURIComponent(submitted.taskId)}`
    const res = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${this.getAuthToken()}` },
      signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (RETRYABLE_STATUSES.has(res.status)) {
        throw new Error(`Kling poll HTTP ${res.status}: ${errText.slice(0, 120)}`)
      }
      throw new Error(`Kling poll failed (${res.status}): ${errText.slice(0, 200)}`)
    }

    const text = await res.text()
    let data: KlingQueryTaskResponse
    try {
      data = JSON.parse(text) as KlingQueryTaskResponse
    } catch {
      throw new Error(`Kling poll returned invalid JSON: ${text.slice(0, 180)}`)
    }

    if (isErrorCode(data.code ?? data.error_code)) {
      return { done: false, terminalError: data.message ?? data.error_message ?? 'Kling task query failed' }
    }

    const task = normalizeTaskData(data)
    const status = String(task.task_status ?? task.status ?? '').toLowerCase()
    const videoUrl = extractVideoUrl(task)

    if (videoUrl && ['succeed', 'succeeded', 'success', 'completed', 'complete'].includes(status)) {
      return { done: true, videoUrl, status }
    }
    if (videoUrl && !status) {
      return { done: true, videoUrl, status: 'completed' }
    }
    if (['failed', 'failure', 'cancelled', 'canceled'].includes(status)) {
      return { done: false, terminalError: task.task_status_msg || task.message || `Kling task ${status}`, status }
    }

    return { done: false, status: status || 'running' }
  }

  private getAuthToken() {
    return this.apiKey ?? this.createJwt()
  }

  private createJwt() {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('KLINGAI_ACCESS_KEY and KLINGAI_SECRET_KEY are required for JWT auth.')
    }
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      iss: this.accessKey,
      exp: now + 1800,
      nbf: now - 5,
    }
    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
    const signature = createHmac('sha256', this.secretKey).update(unsigned).digest()
    return `${unsigned}.${base64Url(signature)}`
  }
}

interface KlingCreateTaskResponse {
  code?: string | number
  message?: string
  error_code?: string | number
  error_message?: string
  data?: { task_id?: string; id?: string }
  task_id?: string
  id?: string
}

interface KlingSubmittedTask {
  taskId: string
}

interface KlingQueryTaskResponse {
  code?: string | number
  message?: string
  error_code?: string | number
  error_message?: string
  data?: KlingTaskData | KlingTaskData[] | { result?: KlingTaskData[] }
  task_status?: string
  status?: string
  task_result?: KlingTaskData['task_result']
  outputs?: KlingTaskOutput[]
}

interface KlingTaskData {
  task_status?: string
  status?: string
  task_status_msg?: string
  message?: string
  task_result?: {
    videos?: Array<{ url?: string; video_url?: string }>
    video?: { url?: string; video_url?: string }
    url?: string
    video_url?: string
  }
  outputs?: KlingTaskOutput[]
  videos?: Array<{ url?: string; video_url?: string }>
  video_url?: string
  url?: string
}

interface KlingTaskOutput {
  type?: string
  url?: string
  video_url?: string
  watermark_url?: string
  duration?: string
}

interface KlingPollResult {
  done: boolean
  videoUrl?: string
  terminalError?: string
  status?: string
}

export function canUseKling(): boolean {
  const apiKey = sanitizeEnvValue(process.env.KLINGAI_API_KEY)
  const accessKey = sanitizeEnvValue(process.env.KLINGAI_ACCESS_KEY)
  const secretKey = sanitizeEnvValue(process.env.KLINGAI_SECRET_KEY)
  return Boolean((apiKey && apiKey.length > 8) || (accessKey && secretKey && accessKey.length > 8 && secretKey.length > 8))
}

export function getKlingVideoModel(): string {
  return KLING_MODEL
}

function normalizeTaskData(response: KlingQueryTaskResponse): KlingTaskData {
  const data = response.data
  if (Array.isArray(data)) return data[0] ?? {}
  if (data && 'result' in data && Array.isArray(data.result)) return data.result[0] ?? {}
  return (data ?? response) as KlingTaskData
}

function extractVideoUrl(task: KlingTaskData) {
  return (
    task.outputs?.find(output => output.type === 'video')?.url ||
    task.outputs?.find(output => output.type === 'video')?.video_url ||
    task.task_result?.videos?.[0]?.url ||
    task.task_result?.videos?.[0]?.video_url ||
    task.task_result?.video?.url ||
    task.task_result?.video?.video_url ||
    task.task_result?.url ||
    task.task_result?.video_url ||
    task.videos?.[0]?.url ||
    task.videos?.[0]?.video_url ||
    task.video_url ||
    task.url
  )
}

function isErrorCode(code: string | number | undefined) {
  if (code === undefined || code === null) return false
  return !/^0+$/.test(String(code))
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

function normalizeBaseUrl(value: string) {
  const clean = sanitizeEnvValue(value) || ''
  return clean.replace(/\/+$/, '')
}

function normalizeKlingModel(value: string | undefined) {
  const clean = sanitizeEnvValue(value) || 'kling-3.0-turbo'
  const aliases: Record<string, string> = {
    'kling-v3-0': 'kling-3.0',
    'kling-v3.0': 'kling-3.0',
    'kling-v3-0-turbo': 'kling-3.0-turbo',
    'kling-v3.0-turbo': 'kling-3.0-turbo',
  }
  return aliases[clean.toLowerCase()] ?? clean
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      return
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
