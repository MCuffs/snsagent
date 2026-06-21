import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 90_000

export async function persistGeneratedVideo(params: {
  sourceUrl: string
  userId: string
  slideNumber: number
}): Promise<string> {
  const source = new URL(params.sourceUrl)
  if (!['http:', 'https:'].includes(source.protocol)) {
    throw new Error('생성 영상 URL 형식이 올바르지 않습니다.')
  }

  const response = await fetch(source, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    redirect: 'follow',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`생성 영상 다운로드 실패 (HTTP ${response.status})`)
  }

  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > MAX_VIDEO_BYTES) {
    throw new Error('생성 영상이 100MB 제한을 초과했습니다.')
  }

  const contentType = normalizeVideoContentType(response.headers.get('content-type'))
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error('생성 영상 파일 크기가 올바르지 않습니다.')
  }
  if (!looksLikeVideo(buffer)) {
    throw new Error(`생성 결과가 영상 파일이 아닙니다. (${contentType})`)
  }

  const fileName = `slide-${params.slideNumber}-${randomUUID()}.${contentType === 'video/webm' ? 'webm' : 'mp4'}`
  const pathname = `generated-videos/${params.userId}/${fileName}`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return blob.url
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('영상 영구 저장을 위한 BLOB_READ_WRITE_TOKEN이 설정되지 않았습니다.')
  }

  const localPath = path.join(process.cwd(), 'public', ...pathname.split('/'))
  await fs.mkdir(path.dirname(localPath), { recursive: true })
  await fs.writeFile(localPath, buffer)
  return `/${pathname.replaceAll('\\', '/')}`
}

function normalizeVideoContentType(value: string | null): 'video/mp4' | 'video/webm' {
  const mime = value?.split(';')[0].trim().toLowerCase()
  return mime === 'video/webm' ? 'video/webm' : 'video/mp4'
}

function looksLikeVideo(buffer: Buffer) {
  const isIsoMedia = buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp'
  const isWebm = buffer.length >= 4
    && buffer[0] === 0x1a
    && buffer[1] === 0x45
    && buffer[2] === 0xdf
    && buffer[3] === 0xa3
  return isIsoMedia || isWebm
}
