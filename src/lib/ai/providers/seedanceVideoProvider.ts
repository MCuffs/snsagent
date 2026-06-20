/**
 * ByteDance Volcano Ark — Seedance video generation provider
 *
 * API flow:
 *   POST  https://ark.cn-beijing.volces.com/api/v3/videos/generations
 *   GET   https://ark.cn-beijing.volces.com/api/v3/videos/generations/{id}  (poll until succeeded)
 */

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3'
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

export class SeedanceVideoProvider {
  private apiKey: string

  constructor(apiKey = process.env.BYTEDANCE_API_KEY) {
    if (!apiKey) throw new Error('BYTEDANCE_API_KEY is not set.')
    this.apiKey = apiKey
  }

  async generateVideo(options: SeedanceVideoOptions): Promise<SeedanceVideoResult> {
    const { prompt, duration = 5, aspectRatio = '9:16', resolution = '720p' } = options

    // Submit task
    const submitRes = await fetch(`${ARK_BASE}/videos/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SEEDANCE_MODEL,
        content: [
          {
            type: 'text',
            text: prompt,
          },
        ],
        parameters: {
          duration,
          resolution,
          aspect_ratio: aspectRatio,
          camera_fixed: options.cameraFixed ?? false,
        },
      }),
    })

    if (!submitRes.ok) {
      const err = await submitRes.text()
      throw new Error(`Seedance submit failed (${submitRes.status}): ${err}`)
    }

    const submitData = await submitRes.json() as { id?: string; task_id?: string; error?: { message: string } }
    if (submitData.error) throw new Error(`Seedance error: ${submitData.error.message}`)
    const taskId = submitData.id || submitData.task_id
    if (!taskId) throw new Error('Seedance: no task_id returned')

    // Poll until done (max 3 minutes, every 4 seconds)
    const videoUrl = await this.pollUntilDone(taskId, 180_000, 4_000)
    return { taskId, videoUrl, durationSeconds: duration }
  }

  private async pollUntilDone(taskId: string, timeoutMs: number, intervalMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, intervalMs))

      const res = await fetch(`${ARK_BASE}/videos/generations/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Seedance poll failed (${res.status}): ${err}`)
      }

      const data = await res.json() as {
        status?: string
        output?: { video_url?: string; cover_image_url?: string }
        error?: { message: string }
      }

      if (data.error) throw new Error(`Seedance task error: ${data.error.message}`)

      if (data.status === 'succeeded' || data.status === 'completed') {
        const url = data.output?.video_url
        if (!url) throw new Error('Seedance: task succeeded but no video_url')
        return url
      }

      if (data.status === 'failed' || data.status === 'cancelled') {
        throw new Error(`Seedance task ${data.status}`)
      }

      // status: 'pending' | 'running' — keep polling
    }

    throw new Error(`Seedance: task ${taskId} timed out after ${timeoutMs / 1000}s`)
  }
}

export function canUseSeedance(): boolean {
  const key = process.env.BYTEDANCE_API_KEY
  return Boolean(key && key.length > 10)
}
