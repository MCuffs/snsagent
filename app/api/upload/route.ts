import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../lib/rateLimiter'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days local retention
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
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
    const allowedTypes = Object.keys(IMAGE_EXTENSIONS)
    let totalIncomingSize = 0

    for (const file of files) {
      // Normalize image/jpg → image/jpeg (some browsers/OS report the wrong subtype)
      const normalizedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
      console.log('[Upload] file.type:', file.type, '→ normalized:', normalizedType, 'size:', file.size)
      if (!allowedTypes.includes(normalizedType)) {
        console.error('[Upload] 400: 지원하지 않는 파일 형식:', file.type)
        return NextResponse.json({ error: `지원하지 않는 파일 형식: ${file.type}` }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        console.error('[Upload] 400: 파일 크기 초과', file.size)
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
      }
      totalIncomingSize += file.size
    }

    // 3. Upload files
    const urls: string[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const detectedType = detectImageMime(buffer)
      if (!detectedType) {
        console.error('[Upload] 400: magic bytes 불일치, file.type:', file.type, 'buffer head:', buffer.slice(0, 4).toString('hex'))
        return NextResponse.json({ error: 'File type verification failed.' }, { status: 400 })
      }

      const ext = IMAGE_EXTENSIONS[detectedType] || 'jpg'
      const fileName = `ref-${randomUUID()}.${ext}`

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        // Prefix by uploads/${user.id}/ for prefix isolated search/limit scans
        const blob = await put(`uploads/${user.id}/${fileName}`, buffer, {
          access: 'public',
          contentType: detectedType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })
        urls.push(blob.url)
      } else {
        // Local development fallback
        const dir = path.join(process.cwd(), 'public', 'uploads', user.id)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, fileName), buffer)
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
