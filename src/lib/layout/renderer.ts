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
  if (input.overlay.overlayStyle === 'archive-cta') {
    return renderArchiveCta(input)
  }

  const textBox = getTextBox(input.layout)
  const sourceHandle = normalizeInstagramHandle(input.source || 'instaagent')
  const sourceMark = escapeXml(formatSourceMark(sourceHandle))
  const backgroundImageDataUri = await toImageDataUri(input.backgroundImageUrl)
  const fontFam = fontFamily(input.layout.typographyStyle)
  const textColor = input.layout.overlayStyle === 'none' ? '#ffffff' : input.overlay.textColor
  const secondaryTextColor = input.layout.overlayStyle === 'none' ? 'rgba(255,255,255,0.78)' : input.overlay.secondaryTextColor
  const headlineLineGap = input.layout.spacingRules?.headlineLineGap || 1.08
  const bodyLineGap = input.layout.spacingRules?.bodyLineGap || 1.42
  const badgeToHeadlineGap = input.layout.spacingRules?.badgeToHeadlineGap || 24
  const headlineToBodyGap = input.layout.spacingRules?.headlineToBodyGap || 36

  let currentY = textBox.y
  const kickerMarkup = renderKicker(input, textBox.x, currentY, textColor)
  currentY += 24 + badgeToHeadlineGap

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
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity="0.34"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#101114"/>
  <image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  ${input.overlay.svgMarkup || renderFallbackOverlay()}
  ${renderTopChrome(sourceMark, input.pageNumber, input.totalPages, textColor)}
  ${kickerMarkup}
  <g filter="url(#text-shadow)">
    ${headlineMarkup}
    ${bodyMarkup}
  </g>
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
  if (layout.overlayStyle === 'archive-light') return { x: left, y: 940, align: 'left' as const }
  return { x: left, y: 920, align: 'left' as const }
}

function renderTopChrome(source: string, pageNumber: number | undefined, totalPages: number | undefined, fill: string) {
  const pageLabel = pageNumber && totalPages
    ? `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`
    : ''
  const opacity = fill === '#050505' ? 0.30 : 0.46
  return `
    <g class="top-chrome">
      <text x="72" y="78" font-family="${fontFamily('clean-sans')}" font-size="22" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="4">${source}</text>
      ${pageLabel ? `<text x="1008" y="78" text-anchor="end" font-family="${fontFamily('clean-sans')}" font-size="20" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="2">${pageLabel}</text>` : ''}
    </g>
  `
}

function renderKicker(input: RenderMediaCardInput, x: number, y: number, fill: string) {
  const label = buildSlideLabel(input)
  const opacity = fill === '#050505' ? 0.34 : 0.46
  return `
    <text x="${x}" y="${y + 22}" font-family="${fontFamily('clean-sans')}" font-size="18" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="5">${escapeXml(label)}</text>
  `
}

function renderHeadline(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string) {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y

  return plan.headlineLines.map((line) => {
    const tspans = renderTokenTspans(line.tokens)
    const fallback = escapeXml(line.tokens.map(token => token.text).join(' '))
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.headlineFontSize}" font-weight="650" fill="${fill}" letter-spacing="-0.4">${tspans || fallback}</text>`
    currentY += plan.headlineFontSize * plan.lineHeight
    return markup
  }).join('')
}

function renderTokenTspans(tokens: TypographyToken[]) {
  return tokens.map((token, index) => {
    const prefix = index === 0 ? '' : ' '
    return `<tspan>${prefix}${escapeXml(token.text)}</tspan>`
  }).join('')
}

function renderBody(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string, bodyLineGap: number) {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y

  return plan.bodyLines.map((line) => {
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.bodyFontSize}" font-weight="400" fill="${fill}" letter-spacing="-0.1">${escapeXml(line)}</text>`
    currentY += plan.bodyFontSize * bodyLineGap
    return markup
  }).join('')
}

async function renderArchiveCta(input: RenderMediaCardInput) {
  const sourceHandle = normalizeInstagramHandle(input.source || 'instaagent')
  const sourceMark = escapeXml(formatSourceMark(sourceHandle))
  const headline = input.typography.headlineLines
    .map(line => line.tokens.map(token => token.text).join(' '))
    .join(' ') || input.headline
  const bodyLines = input.typography.bodyLines.length ? input.typography.bodyLines : [input.body]

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <filter id="cta-blur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#000000"/>
  ${renderTopChrome(sourceMark, input.pageNumber, input.totalPages, '#ffffff')}
  <text x="540" y="675" text-anchor="middle" font-family="${fontFamily('clean-sans')}" font-size="52" font-weight="700" fill="#ffffff" fill-opacity="0.58" letter-spacing="2" filter="url(#cta-blur)">${sourceMark.toUpperCase()}</text>
  <text x="72" y="970" font-family="${fontFamily('clean-sans')}" font-size="82" font-weight="750" fill="#f5f5f5" letter-spacing="-0.5">${escapeXml(headline)}</text>
  ${bodyLines.slice(0, 2).map((line, index) => `<text x="72" y="${1060 + index * 52}" font-family="${fontFamily('clean-sans')}" font-size="29" font-weight="400" fill="#ffffff" fill-opacity="0.44" letter-spacing="-0.2">${escapeXml(line)}</text>`).join('')}
  <line x1="72" y1="1188" x2="1008" y2="1188" stroke="#ffffff" stroke-opacity="0.16"/>
  <rect x="72" y="1230" width="936" height="78" fill="#f3f3f3"/>
  <text x="540" y="1280" text-anchor="middle" font-family="${fontFamily('clean-sans')}" font-size="28" font-weight="700" fill="#050505" letter-spacing="0">팔로우 ${escapeXml(sourceHandle)}</text>
</svg>`

  try {
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return uploadGeneratedAsset({
      fileName: `${input.id}.png`,
      content: png,
      contentType: 'image/png',
    })
  } catch (error) {
    console.error('[MediaCardRenderer] CTA PNG render failed, falling back to SVG', error)
    return uploadGeneratedAsset({
      fileName: `${input.id}.svg`,
      content: svg,
      contentType: 'image/svg+xml',
    })
  }
}

function buildSlideLabel(input: RenderMediaCardInput) {
  const index = input.pageNumber ? String(input.pageNumber).padStart(2, '0') : '01'
  const category = input.category
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
  return `${index} · ${category || 'ARCHIVE'}`
}

function renderFallbackOverlayDefs() {
  return `
    <linearGradient id="fallback-media-overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#171717" stop-opacity="0.30"/>
      <stop offset="58%" stop-color="#171717" stop-opacity="0.38"/>
      <stop offset="82%" stop-color="#101010" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#080808" stop-opacity="0.92"/>
    </linearGradient>
  `
}

function renderFallbackOverlay() {
  return '<rect width="1080" height="1350" fill="#8c8c8c" fill-opacity="0.22"/><rect width="1080" height="1350" fill="url(#fallback-media-overlay)"/>'
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

function formatSourceMark(handle: string) {
  return handle.replace(/^@/, '')
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
