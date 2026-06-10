import fs from 'fs'
import path from 'path'

// uploads/ 경로의 파일을 렌더링 후 정리 — carousel/ 결과물은 유지
export async function deleteUploadedAsset(url: string): Promise<void> {
  if (!url || !url.includes('/uploads/')) return
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob')
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch (err) {
      console.warn('[deleteUploadedAsset] Failed to delete blob:', url, err)
    }
  }
}

export async function uploadGeneratedAsset(params: {
  fileName: string
  content: string | Buffer
  contentType: 'image/svg+xml' | 'image/png' | 'image/jpeg'
}): Promise<string> {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import('@vercel/blob')
      const blob = await put(`carousel/${safeFileName}`, params.content, {
        access: 'public',
        addRandomSuffix: true,
        contentType: params.contentType,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      return blob.url
    } catch (error) {
      if (process.env.NODE_ENV === 'production') throw error
      console.warn('[uploadGeneratedAsset] Blob upload failed; using local file fallback.', error)
    }
  }

  // 로컬 개발: public/ 폴더에 저장
  const directory = path.join(process.cwd(), 'public', 'generated', 'carousel')
  fs.mkdirSync(directory, { recursive: true })
  const filePath = path.join(directory, safeFileName)
  fs.writeFileSync(filePath, params.content)
  return `/generated/carousel/${safeFileName}`
}
