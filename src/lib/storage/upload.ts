import fs from 'fs'
import path from 'path'

export async function uploadGeneratedAsset(params: {
  fileName: string
  content: string | Buffer
  contentType: 'image/svg+xml' | 'image/png' | 'image/jpeg'
}): Promise<string> {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`carousel/${safeFileName}`, params.content, {
      access: 'public',
      contentType: params.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return blob.url
  }

  // 로컬 개발: public/ 폴더에 저장
  const directory = path.join(process.cwd(), 'public', 'generated', 'carousel')
  fs.mkdirSync(directory, { recursive: true })
  const filePath = path.join(directory, safeFileName)
  fs.writeFileSync(filePath, params.content)
  return `/generated/carousel/${safeFileName}`
}
