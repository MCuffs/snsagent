import { uploadGeneratedAsset } from '../storage/upload'
import sharp from 'sharp'
import type { LayoutDefinition } from './layoutTypes'
import type { OverlayPlan } from './overlayEngine'
import type { TypographyPlan, TypographyToken } from './typographyEngine'
import fs from 'fs'
import path from 'path'

export interface RenderMediaCardInput {
  id: string
  layout: LayoutDefinition
  typography: TypographyPlan
  overlay: OverlayPlan
  category: string
  headline: string
  body: string
  backgroundImageUrl: string
  source?: string
  pageNumber?: number
  totalPages?: number
}

export async function renderMediaCard(input: RenderMediaCardInput) {
  const textBox = getTextBox(input.layout)
  const category = escapeXml(input.category)
  const source = escapeXml(input.source || 'InstaAgent')
  const backgroundImageDataUri = await toImageDataUri(input.backgroundImageUrl)
  const pagination = input.totalPages && input.pageNumber
    ? `${input.pageNumber}/${input.totalPages}`
    : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    ${input.overlay.svgDefs}
    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.28"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#111111"/>
  <image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  ${input.overlay.svgMarkup}
  ${renderMinimalSurface(input.layout)}
  <g filter="${input.overlay.textColor === '#ffffff' ? 'url(#text-shadow)' : ''}">
    <text x="${textBox.x}" y="${textBox.y}" font-family="${fontFamily(input.layout.typographyStyle)}" font-size="27" font-weight="800" fill="${input.typography.emphasisColor}" letter-spacing="2">${category}</text>
    ${renderHeadline(input.typography, textBox.x, textBox.y + 78, input.overlay.textColor, textBox.align)}
    ${renderBody(input.typography, textBox.x, textBox.y + 78 + headlineBlockHeight(input.typography), input.overlay.secondaryTextColor, textBox.align)}
  </g>
  <text x="${input.layout.safeArea.left}" y="1268" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="25" font-weight="800" fill="${input.overlay.textColor}" opacity="0.78">${source}</text>
  ${pagination ? `<text x="${1080 - input.layout.safeArea.right}" y="1268" text-anchor="end" font-family="Arial, sans-serif" font-size="25" font-weight="800" fill="${input.overlay.textColor}" opacity="0.72">${pagination}</text>` : ''}
</svg>`

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return uploadGeneratedAsset({
      fileName: `${input.id}.png`,
      content: png,
      contentType: 'image/png',
    })
  } catch (error) {
    console.error('[MediaCardRenderer] PNG render failed, falling back to SVG', error)
    return uploadGeneratedAsset({
      fileName: `${input.id}.svg`,
      content: svg,
      contentType: 'image/svg+xml',
    })
  }
}

function getTextBox(layout: LayoutDefinition) {
  const left = layout.safeArea.left
  const right = 1080 - layout.safeArea.right
  const centerX = 540

  if (layout.textPosition === 'center') return { x: centerX, y: 455, align: 'center' as const }
  if (layout.textPosition === 'bottom-center') return { x: centerX, y: 760, align: 'center' as const }
  if (layout.textPosition === 'top-left') return { x: left, y: layout.safeArea.top + 12, align: 'left' as const }
  if (layout.textPosition === 'left-column') return { x: left, y: 300, align: 'left' as const }
  if (layout.textPosition === 'right-column') return { x: right - 430, y: 300, align: 'left' as const }
  return { x: left, y: 760, align: 'left' as const }
}

function renderHeadline(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center') {
  let currentY = y
  const anchor = align === 'center' ? 'middle' : 'start'

  return plan.headlineLines.map((line) => {
    const text = line.tokens.map(token => token.text).join(' ')
    const tspans = renderTokenTspans(line.tokens, plan.emphasisColor)
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="${plan.headlineFontSize}" font-weight="950" fill="${fill}" letter-spacing="-2">${tspans || escapeXml(text)}</text>`
    currentY += plan.headlineFontSize * plan.lineHeight
    return markup
  }).join('')
}

function renderTokenTspans(tokens: TypographyToken[], emphasisColor: string) {
  if (!tokens.length) return ''

  return tokens.map((token, index) => {
    const color = token.style === 'headline-emphasis' ? ` fill="${emphasisColor}"` : ''
    const prefix = index === 0 ? '' : ' '
    return `<tspan${color}>${prefix}${escapeXml(token.text)}</tspan>`
  }).join('')
}

function renderBody(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center') {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y + 38

  return plan.bodyLines.map((line) => {
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="${plan.bodyFontSize}" font-weight="700" fill="${fill}" letter-spacing="-0.4">${escapeXml(line)}</text>`
    currentY += plan.bodyFontSize * 1.42
    return markup
  }).join('')
}

function headlineBlockHeight(plan: TypographyPlan) {
  return plan.headlineLines.length * plan.headlineFontSize * plan.lineHeight
}

function renderMinimalSurface(layout: LayoutDefinition) {
  if (layout.overlayStyle !== 'none') return ''
  return '<rect x="42" y="58" width="996" height="1234" rx="36" fill="#ffffff" fill-opacity="0.88"/>'
}

function fontFamily(style: string) {
  if (style === 'magazine-serif') return 'Georgia, Times New Roman, Pretendard, serif'
  return 'Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif'
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
