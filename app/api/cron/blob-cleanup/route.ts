import { NextRequest, NextResponse } from 'next/server'
import { list, del } from '@vercel/blob'
import prisma from '../../../../lib/db'
import { unauthorizedJson, verifyBearerSecret } from '../../../../lib/security'

export const dynamic = 'force-dynamic'
// 슬라이드 수가 많을 수 있으므로 maxDuration 확보
export const maxDuration = 60

export async function GET(request: NextRequest) {
  return handleBlobCleanup(request)
}

export async function POST(request: NextRequest) {
  return handleBlobCleanup(request)
}

async function handleBlobCleanup(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!verifyBearerSecret(request.headers.get('authorization'), secret)) {
    return unauthorizedJson()
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json({ success: true, skipped: true, reason: 'No BLOB_READ_WRITE_TOKEN' })
  }

  // 1. DB에서 모든 슬라이드가 참조 중인 uploads/ URL 수집
  const slides = await prisma.carouselSlide.findMany({
    select: { backgroundImageUrl: true, editorDocument: true },
  })

  const referencedUrls = new Set<string>()
  for (const slide of slides) {
    if (slide.backgroundImageUrl?.includes('/uploads/')) {
      referencedUrls.add(slide.backgroundImageUrl)
    }
    if (slide.editorDocument) {
      try {
        const doc = JSON.parse(slide.editorDocument) as { layers?: { imageUrl?: string }[] }
        for (const layer of doc.layers ?? []) {
          if (layer.imageUrl?.includes('/uploads/')) {
            referencedUrls.add(layer.imageUrl)
          }
        }
      } catch {
        // 파싱 실패한 문서는 무시
      }
    }
  }

  // 2. Blob uploads/ 전체 목록과 대조해 고아 파일만 삭제
  let cursor: string | undefined
  let deleted = 0
  let kept = 0
  const deletedFiles: string[] = []

  do {
    const result = await list({ prefix: 'uploads/', token, cursor, limit: 100 })
    for (const blob of result.blobs) {
      if (referencedUrls.has(blob.url)) {
        kept++
      } else {
        await del(blob.url, { token })
        deleted++
        deletedFiles.push(blob.pathname)
      }
    }
    cursor = result.cursor
    if (!result.hasMore) break
  } while (cursor)

  console.log(`[BlobCleanup] deleted=${deleted} kept=${kept}`)
  return NextResponse.json({ success: true, deleted, kept, deletedFiles })
}
