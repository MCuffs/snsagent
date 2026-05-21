import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { uploadGeneratedAsset } from '../storage/upload'
import type { LayoutDefinition } from './layoutTypes'
import type { OverlayPlan } from './overlayEngine'
import type { TypographyPlan, TypographyToken } from './typographyEngine'

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
  const source = escapeXml(normalizeInstagramHandle(input.source || 'instaagent'))
  const backgroundImageDataUri = await toImageDataUri(input.backgroundImageUrl)
  const fontFam = fontFamily(input.layout.typographyStyle)
  const textColor = input.layout.overlayStyle === 'none' ? '#ffffff' : input.overlay.textColor
  const secondaryTextColor = input.layout.overlayStyle === 'none' ? 'rgba(255,255,255,0.78)' : input.overlay.secondaryTextColor
  const headlineLineGap = input.layout.spacingRules?.headlineLineGap || 1.08
  const bodyLineGap = input.layout.spacingRules?.bodyLineGap || 1.42
  const badgeToHeadlineGap = input.layout.spacingRules?.badgeToHeadlineGap || 24
  const headlineToBodyGap = input.layout.spacingRules?.headlineToBodyGap || 36

  let currentY = textBox.y
  const sourceMarkup = renderTopHandle(source, textBox.x, currentY, textColor, textBox.align)
  currentY += 30 + badgeToHeadlineGap

  const headlineStartBaseline = currentY + input.typography.headlineFontSize * 0.95
  const headlineMarkup = renderHeadline(input.typography, textBox.x, headlineStartBaseline, textColor, textBox.align, fontFam)
  const bodyStartBaseline =
    headlineStartBaseline +
    (input.typography.headlineLines.length - 1) * input.typography.headlineFontSize * headlineLineGap +
    headlineToBodyGap +
    input.typography.bodyFontSize * 0.95
  const bodyMarkup = renderBody(input.typography, textBox.x, bodyStartBaseline, secondaryTextColor, textBox.align, fontFam, bodyLineGap)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    ${input.overlay.svgDefs}
    ${renderFallbackOverlayDefs()}
    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.58"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#101114"/>
  <image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  ${input.overlay.svgMarkup || renderFallbackOverlay()}
  ${sourceMarkup}
  <g filter="url(#text-shadow)">
    ${headlineMarkup}
    ${bodyMarkup}
  </g>
  ${renderSourceBadge(source, input.layout.safeArea.left, 1268, textColor)}
  ${input.totalPages && input.pageNumber ? renderPaginationDots(input.pageNumber, input.totalPages, 540, 1284) : ''}
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

  if (layout.textPosition === 'center') return { x: centerX, y: 560, align: 'center' as const }
  if (layout.textPosition === 'bottom-center') return { x: centerX, y: 720, align: 'center' as const }
  if (layout.textPosition === 'top-left') return { x: left, y: 620, align: 'left' as const }
  if (layout.textPosition === 'left-column') return { x: left, y: 600, align: 'left' as const }
  if (layout.textPosition === 'right-column') return { x: right - 520, y: 600, align: 'left' as const }
  return { x: left, y: 710, align: 'left' as const }
}

function renderTopHandle(source: string, x: number, y: number, fill: string, align: 'left' | 'center') {
  const anchor = align === 'center' ? 'middle' : 'start'
  return `
    <text x="${x}" y="${y + 24}" text-anchor="${anchor}" font-family="${fontFamily('clean-sans')}" font-size="22" font-weight="500" fill="${fill}" fill-opacity="0.88" letter-spacing="0">${source}</text>
  `
}

function renderHeadline(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string) {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y

  return plan.headlineLines.map((line) => {
    const tspans = renderTokenTspans(line.tokens, plan.emphasisColor)
    const fallback = escapeXml(line.tokens.map(token => token.text).join(' '))
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.headlineFontSize}" font-weight="500" fill="${fill}" letter-spacing="0">${tspans || fallback}</text>`
    currentY += plan.headlineFontSize * plan.lineHeight
    return markup
  }).join('')
}

function renderTokenTspans(tokens: TypographyToken[], emphasisColor: string) {
  return tokens.map((token, index) => {
    const fill = token.style === 'headline-emphasis' ? ` fill="${emphasisColor}"` : ''
    const prefix = index === 0 ? '' : ' '
    return `<tspan${fill}>${prefix}${escapeXml(token.text)}</tspan>`
  }).join('')
}

function renderBody(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string, bodyLineGap: number) {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y

  return plan.bodyLines.map((line) => {
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.bodyFontSize}" font-weight="400" fill="${fill}" letter-spacing="0">${escapeXml(line)}</text>`
    currentY += plan.bodyFontSize * bodyLineGap
    return markup
  }).join('')
}

function renderPaginationDots(pageNumber: number, totalPages: number, centerX: number, y: number) {
  const count = Math.min(Math.max(totalPages, 1), 12)
  const gap = 20
  const startX = centerX - ((count - 1) * gap) / 2
  const dots = Array.from({ length: count }, (_, index) => {
    const active = index + 1 === pageNumber
    return `<circle cx="${startX + index * gap}" cy="${y}" r="${active ? 6 : 5}" fill="#ffffff" fill-opacity="${active ? 0.96 : 0.42}"/>`
  }).join('')
  return `<g class="pagination-dots">${dots}</g>`
}

function renderSourceBadge(source: string, x: number, y: number, textColor: string) {
  if (!source) return ''
  const fontColor = textColor === '#ffffff' ? '#ffffff' : '#111111'
  return `
    <g class="brand-badge">
      <text x="${x}" y="${y}" font-family="${fontFamily('clean-sans')}" font-size="18" font-weight="500" fill="${fontColor}" fill-opacity="0.72" letter-spacing="0">${escapeXml(source)}</text>
    </g>
  `
}

function renderFallbackOverlayDefs() {
  return `
    <linearGradient id="fallback-media-overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16"/>
      <stop offset="44%" stop-color="#000000" stop-opacity="0.24"/>
      <stop offset="74%" stop-color="#000000" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.92"/>
    </linearGradient>
  `
}

function renderFallbackOverlay() {
  return '<rect width="1080" height="1350" fill="url(#fallback-media-overlay)"/>'
}

function fontFamily(style: string) {
  if (style === 'magazine-serif') return 'Georgia, Times New Roman, Pretendard, serif'
  return 'Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif'
}

function normalizeInstagramHandle(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return '@instaagent'
  const withoutUrl = trimmed
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .split(/[/?#]/)[0]
  const handle = withoutUrl.replace(/^@+/, '').replace(/\s+/g, '').toLowerCase()
  return `@${handle || 'instaagent'}`
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

  if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
    try {
      const cleanPath = imageUrl.startsWith('file://') ? imageUrl.replace('file://', '') : imageUrl
      const filePath = path.join(process.cwd(), 'public', cleanPath)
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath)
        const ext = path.extname(filePath).slice(1) || 'png'
        const contentType = ext === 'webp' ? 'image/webp' : `image/${ext}`
        return `data:${contentType};base64,${fileBuffer.toString('base64')}`
      }
    } catch (error) {
      console.warn('[ImageDataUri] Failed to read local file:', imageUrl, error)
    }
  }

  try {
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString('base64')}`
  } catch (error) {
    console.warn('[ImageDataUri] Failed to inline remote background image', error)
    return ''
  }
}
