import { NextResponse } from 'next/server'
import { getSessionUser } from '../../actions'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    const maxSize = 10 * 1024 * 1024 // 10MB

    const urls: string[] = []

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `지원하지 않는 파일 형식: ${file.type}` }, { status: 400 })
      }
      if (file.size > maxSize) {
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const ext = file.type.split('/')[1] || 'jpg'
      const fileName = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob')
        const blob = await put(`uploads/${fileName}`, buffer, {
          access: 'public',
          contentType: file.type,
        })
        urls.push(blob.url)
      } else {
        // Local development fallback
        const path = await import('path')
        const fs = await import('fs')
        const dir = path.join(process.cwd(), 'public', 'uploads')
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, fileName), buffer)
        urls.push(`/uploads/${fileName}`)
      }
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('[Upload API]', error)
    const message = error instanceof Error ? error.message : '업로드 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
