import fs from 'fs'
import path from 'path'

export async function uploadGeneratedAsset(params: {
  fileName: string
  content: string
  contentType: 'image/svg+xml'
}) {
  const directory = path.join(process.cwd(), 'public', 'generated', 'carousel')
  fs.mkdirSync(directory, { recursive: true })

  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  const filePath = path.join(directory, safeFileName)
  fs.writeFileSync(filePath, params.content, 'utf8')

  return `/generated/carousel/${safeFileName}`
}
