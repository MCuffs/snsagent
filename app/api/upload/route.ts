import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../lib/rateLimiter'

export const runtime = 'nodejs'

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024  // 10MB per image
const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024 // 100MB per video
const MAX_TOTAL_UPLOAD_SIZE = 24 * 1024 * 1024 // 24MB per request (images only)
const MAX_IMAGE_DIMENSION = 2400
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

function detectImageMime(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif'
  }
  return null
}

function detectVideoMime(buffer: Buffer): string | null {
  // MP4 / MOV: 4~7바이트에 'ftyp' 시그니처
  if (buffer.length >= 12 && buffer.slice(4, 8).toString('ascii') === 'ftyp') {
    return 'video/mp4'
  }
  // WebM: 0x1a 0x45 0xdf 0xa3 (EBML header)
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return 'video/webm'
  }
  return null
}

async function normalizeImageBuffer(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/gif') {
    return { buffer, mimeType }
  }

  const pipeline = sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })

  if (mimeType === 'image/jpeg') {
    return { buffer: await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer(), mimeType }
  }
  if (mimeType === 'image/png') {
    return { buffer: await pipeline.png({ compressionLevel: 9 }).toBuffer(), mimeType }
  }
  if (mimeType === 'image/webp') {
    return { buffer: await pipeline.webp({ quality: 86 }).toBuffer(), mimeType }
  }

  return { buffer, mimeType }
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 1. Rate Limiting Check
  const rateLimitResult = await checkRateLimit(`upload:${user.id}`, RATE_LIMIT_PRESETS.upload)
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 1분 후에 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      console.error('[Upload] 400: 파일 없음')
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    if (files.length > 4) {
      console.error('[Upload] 400: 파일 수 초과', files.length)
      return NextResponse.json({ error: '이미지는 한 번에 최대 4개까지 업로드할 수 있습니다.' }, { status: 400 })
    }

    // 2. Validate formats and individual sizes
    const allowedImageTypes = Object.keys(IMAGE_EXTENSIONS)
    const allowedVideoTypes = Object.keys(VIDEO_EXTENSIONS)
    let totalIncomingSize = 0
    const hasVideo = files.some(f => allowedVideoTypes.includes(f.type === 'video/mp4' ? 'video/mp4' : f.type))

    // 영상은 단일 파일만 허용
    if (hasVideo && files.length > 1) {
      return NextResponse.json({ error: '영상은 한 번에 1개만 업로드할 수 있습니다.' }, { status: 400 })
    }

    for (const file of files) {
      const normalizedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
      const isImage = allowedImageTypes.includes(normalizedType)
      const isVideo = allowedVideoTypes.includes(normalizedType)

      if (!isImage && !isVideo) {
        return NextResponse.json({ error: `지원하지 않는 파일 형식: ${file.type}` }, { status: 400 })
      }
      const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_IMAGE_FILE_SIZE
      if (file.size > maxSize) {
        return NextResponse.json({
          error: isVideo ? '영상 크기는 100MB 이하여야 합니다.' : '파일 크기는 10MB 이하여야 합니다.',
        }, { status: 400 })
      }
      if (isImage) totalIncomingSize += file.size
    }

    if (!hasVideo && totalIncomingSize > MAX_TOTAL_UPLOAD_SIZE) {
      return NextResponse.json({ error: 'Total upload size must be 24MB or less.' }, { status: 400 })
    }

    // 3. Upload files
    const urls: string[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      const detectedImageType = detectImageMime(buffer)
      const detectedVideoType = detectVideoMime(buffer)

      if (!detectedImageType && !detectedVideoType) {
        return NextResponse.json({ error: 'File type verification failed.' }, { status: 400 })
      }

      // ── 영상 처리 (sharp 없이 원본 그대로 업로드) ──
      if (detectedVideoType) {
        const normalizedType = file.type === 'video/quicktime' ? 'video/mp4' : (detectedVideoType as string)
        const ext = VIDEO_EXTENSIONS[normalizedType] || VIDEO_EXTENSIONS[file.type] || 'mp4'
        const fileName = `video-${randomUUID()}.${ext}`

        if (process.env.BLOB_READ_WRITE_TOKEN) {
          const { put } = await import('@vercel/blob')
          const blob = await put(`uploads/${user.id}/${fileName}`, buffer, {
            access: 'public',
            contentType: normalizedType,
            token: process.env.BLOB_READ_WRITE_TOKEN,
          })
          urls.push(blob.url)
        } else {
          const dir = path.join(process.cwd(), 'public', 'uploads', user.id)
          fs.mkdirSync(dir, { recursive: true })
          fs.writeFileSync(path.join(dir, fileName), buffer)
          urls.push(new URL(`/uploads/${user.id}/${fileName}`, request.url).toString())
        }
        continue
      }

      // ── 이미지 처리 (기존 로직) ──
      const normalized = await normalizeImageBuffer(buffer, detectedImageType!)
      const ext = IMAGE_EXTENSIONS[normalized.mimeType] || 'jpg'
      const fileName = `ref-${randomUUID()}.${ext}`

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        // Prefix by uploads/${user.id}/ for prefix isolated search/limit scans
        const blob = await put(`uploads/${user.id}/${fileName}`, normalized.buffer, {
          access: 'public',
          contentType: normalized.mimeType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })
        urls.push(blob.url)
      } else {
        // Local development fallback
        const dir = path.join(process.cwd(), 'public', 'uploads', user.id)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, fileName), normalized.buffer)
        urls.push(new URL(`/uploads/${user.id}/${fileName}`, request.url).toString())
      }
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('[Upload API]', error)
    const message = error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
