import { uploadGeneratedAsset } from '../storage/upload'
import sharp from 'sharp'
import type { BrandProfile, SlideCopy, SlideDesignPrompt } from './types'
import fs from 'fs'
import path from 'path'

export async function renderSlide(params: {
  campaignKey: string
  brand: BrandProfile
  copy: SlideCopy
  design: SlideDesignPrompt
  backgroundImageUrl: string
  showSlideNumber?: boolean
}) {
  const y = params.design.textPosition === 'top' ? 250 : params.design.textPosition === 'bottom' ? 700 : 500
  const escapedHeadline = escapeXml(params.copy.headline)
  const escapedBody = escapeXml(params.copy.body)
  const escapedCta = escapeXml(params.copy.ctaText || '')
  
  const backgroundImageDataUri = await toImageDataUri(params.backgroundImageUrl)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${escapeXml(params.brand.mainColor || '#ff4f00')}" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#111827" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <image href="${escapeXml(backgroundImageDataUri || params.backgroundImageUrl)}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice" opacity="0.24"/>
  <rect x="110" y="${y - 190}" width="860" height="${escapedCta ? 390 : 320}" rx="34" fill="#ffffff" opacity="0.92" filter="url(#shadow)"/>
  <text x="540" y="${y - 40}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="64" font-weight="800" fill="#111827">${escapedHeadline}</text>
  <foreignObject x="190" y="${y + 10}" width="700" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif; font-size: 34px; font-weight: 600; color: #334155; line-height: 1.35; text-align: center;">${escapedBody}</div>
  </foreignObject>
  ${escapedCta ? `<rect x="350" y="${y + 180}" width="380" height="74" rx="37" fill="${escapeXml(params.brand.mainColor || '#ff4f00')}"/><text x="540" y="${y + 228}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">${escapedCta}</text>` : ''}
  <text x="70" y="985" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="26" font-weight="800" fill="#111827" opacity="0.72">${escapeXml(params.brand.name)}</text>
  ${params.showSlideNumber ? `<text x="1010" y="985" text-anchor="end" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#64748b">${params.copy.slideNumber}</text>` : ''}
</svg>`

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return uploadGeneratedAsset({
      fileName: `${params.campaignKey}-slide-${params.copy.slideNumber}.png`,
      content: png,
      contentType: 'image/png',
    })
  } catch (error) {
    console.error('[CarouselRenderer] PNG render failed, falling back to SVG', error)
    return uploadGeneratedAsset({
      fileName: `${params.campaignKey}-slide-${params.copy.slideNumber}.svg`,
      content: svg,
      contentType: 'image/svg+xml',
    })
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

async function toImageDataUri(imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith('data:')) return imageUrl

  // 로컬 파일 경로인 경우 (예: /background-showcase/showcase-1.webp)
  if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
    try {
      const cleanPath = imageUrl.startsWith('file://') 
        ? imageUrl.replace('file://', '') 
        : imageUrl
      
      const filePath = path.join(process.cwd(), 'public', cleanPath)
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath)
        const ext = path.extname(filePath).slice(1) || 'png'
        const contentType = ext === 'webp' ? 'image/webp' : `image/${ext}`
        const base64 = fileBuffer.toString('base64')
        return `data:${contentType};base64,${base64}`
      }
    } catch (e) {
      console.warn('[ImageDataUri] Failed to read local file:', imageUrl, e)
    }
  }

  // 원격 URL인 경우 (http, https)
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.warn('[ImageDataUri] Failed to inline remote background image', error)
    
    // 원격 이미지 로드 실패 시, 로컬의 기본 showcase-1.webp 파일을 읽어 base64 폴백
    try {
      const fallbackPath = path.join(process.cwd(), 'public', 'background-showcase', 'showcase-1.webp')
      if (fs.existsSync(fallbackPath)) {
        const fileBuffer = fs.readFileSync(fallbackPath)
        const base64 = fileBuffer.toString('base64')
        return `data:image/webp;base64,${base64}`
      }
    } catch (fallbackErr) {
      console.error('[ImageDataUri] Fallback image read failed', fallbackErr)
    }
    
    return ''
  }
}
