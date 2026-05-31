import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import { normalizePlan } from '../../../lib/limits-types'
import { list } from '@vercel/blob'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'

// Simple in-memory sliding window rate limiter
const rateLimitCache = new Map<string, number[]>()
const RATE_LIMIT_COUNT = 10
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitCache.get(userId) || []
  
  // Keep timestamps within the last 1 minute window
  const activeTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  
  if (activeTimestamps.length >= RATE_LIMIT_COUNT) {
    return true
  }
  
  activeTimestamps.push(now)
  rateLimitCache.set(userId, activeTimestamps)
  return false
}

// Storage quota definitions
const QUOTA_FREE = 20 * 1024 * 1024 // 20MB
const QUOTA_PAID = 100 * 1024 * 1024 // 100MB
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days local retention

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 1. Rate Limiting Check
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 1분 후에 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    if (files.length > 4) {
      return NextResponse.json({ error: '이미지는 한 번에 최대 4개까지 업로드할 수 있습니다.' }, { status: 400 })
    }

    // 2. Validate formats and individual sizes
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    let totalIncomingSize = 0

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `지원하지 않는 파일 형식: ${file.type}` }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
      }
      totalIncomingSize += file.size
    }

    // 3. Calculate current storage quota usage
    const userPlan = normalizePlan(user.plan)
    const quotaLimit = userPlan === 'FREE' ? QUOTA_FREE : QUOTA_PAID
    let currentUsage = 0

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Vercel Blob Storage quota calculation
      try {
        const prefix = `uploads/${user.id}/`
        const { blobs } = await list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN })
        currentUsage = blobs.reduce((sum, b) => sum + b.size, 0)
      } catch (listError) {
        console.error('[Upload Quota] Failed to list Vercel blobs:', listError)
        // Fail-closed fallback: assume zero but log warning
      }
    } else {
      // Local FS storage quota calculation
      const dir = path.join(process.cwd(), 'public', 'uploads', user.id)
      if (fs.existsSync(dir)) {
        try {
          const localFiles = fs.readdirSync(dir)
          const nowMs = Date.now()
          for (const localFile of localFiles) {
            const filePath = path.join(dir, localFile)
            const stat = fs.statSync(filePath)
            if (stat.isFile()) {
              // Auto-cleanup files older than 30 days
              if (nowMs - stat.mtimeMs > RETENTION_MS) {
                fs.unlinkSync(filePath)
              } else {
                currentUsage += stat.size
              }
            }
          }
        } catch (fsError) {
          console.error('[Upload Quota] Local directory read failed:', fsError)
        }
      }
    }

    // 4. Enforce quota limits
    if (currentUsage + totalIncomingSize > quotaLimit) {
      const limitMb = Math.round(quotaLimit / (1024 * 1024))
      const currentMb = (currentUsage / (1024 * 1024)).toFixed(2)
      return NextResponse.json(
        { error: `저장 용량이 부족합니다. (한도: ${limitMb}MB, 사용 중: ${currentMb}MB)` },
        { status: 400 }
      )
    }

    // 5. Upload files
    const urls: string[] = []

    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.type.split('/')[1] || 'jpg'
      const fileName = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        // Prefix by uploads/${user.id}/ for prefix isolated search/limit scans
        const blob = await put(`uploads/${user.id}/${fileName}`, buffer, {
          access: 'public',
          contentType: file.type,
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
