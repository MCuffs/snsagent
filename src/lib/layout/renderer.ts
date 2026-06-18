import fs from 'fs'
import path from 'path'
import { uploadGeneratedAsset } from '../storage/upload'
import { renderSvgToPng } from '../render/svgToPng'
import { isTrustedRenderableImageUrl } from '../security/imageUrl'
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
  fontOverride?: string
  textColorOverride?: string
  headlineFontSizeOverride?: number
  bodyFontSizeOverride?: number
  // Admin template support: one of the 9 logical positions (e.g. "top-right", "middle-center").
  // When set, overrides the layout's built-in text anchor for full WYSIWYG fidelity.
  textPositionOverride?: string
  headlineWeightOverride?: number
  headlineTrackingOverride?: number   // letter-spacing (px)
  headlineLineHeightOverride?: number
  paddingXOverride?: number
  paddingYOverride?: number
}

export async function renderMediaCard(input: RenderMediaCardInput) {
  if (input.overlay.overlayStyle === 'archive-cta') {
    return renderArchiveCta(input)
  }

  const textBox = input.textPositionOverride
    ? getTextBoxFromPosition(input.textPositionOverride, input.layout, input.paddingXOverride, input.paddingYOverride)
    : getTextBox(input.layout)
  const sourceHandle = normalizeInstagramHandle(input.source || 'shuffla')
  const sourceMark = escapeXml(formatSourceMark(sourceHandle))
  const backgroundImageDataUri = await toImageDataUri(input.backgroundImageUrl)
  const fontFam = input.fontOverride ?? fontFamily(input.layout.typographyStyle)
  const typography = applyTypographyOverrides(input)
  const textColor = input.textColorOverride ?? (input.layout.overlayStyle === 'none' ? '#ffffff' : input.overlay.textColor)
  const secondaryTextColor = input.textColorOverride
    ? `${input.textColorOverride}cc`
    : (input.layout.overlayStyle === 'none' ? 'rgba(255,255,255,0.78)' : input.overlay.secondaryTextColor)
  const headlineLineGap = input.headlineLineHeightOverride ?? (input.layout.spacingRules?.headlineLineGap || 1.08)
  const bodyLineGap = input.layout.spacingRules?.bodyLineGap || 1.42
  const badgeToHeadlineGap = input.layout.spacingRules?.badgeToHeadlineGap || 24
  const headlineToBodyGap = input.layout.spacingRules?.headlineToBodyGap || 36

  let currentY = fitTextBoxY({
    layout: input.layout,
    textBoxY: textBox.y,
    typography,
    headlineLineGap,
    bodyLineGap,
    badgeToHeadlineGap,
    headlineToBodyGap,
  })
  const kickerMarkup = renderKicker(input, textBox.x, currentY, textColor, textBox.align)
  currentY += 24 + badgeToHeadlineGap

  const headlineStartBaseline = currentY + typography.headlineFontSize * 0.95
  const headlineMarkup = renderHeadline(typography, textBox.x, headlineStartBaseline, textColor, textBox.align, fontFam, {
    weight: input.headlineWeightOverride,
    tracking: input.headlineTrackingOverride,
  })
  const bodyStartBaseline =
    headlineStartBaseline +
    (typography.headlineLines.length - 1) * typography.headlineFontSize * headlineLineGap +
    headlineToBodyGap +
    typography.bodyFontSize * 0.95
  const bodyMarkup = renderBody(typography, textBox.x, bodyStartBaseline, secondaryTextColor, textBox.align, fontFam, bodyLineGap)

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    ${input.overlay.svgDefs}
    ${renderFallbackOverlayDefs()}
  </defs>
  <rect width="1080" height="1350" fill="#101114"/>
  <image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  ${input.overlay.svgMarkup || renderFallbackOverlay()}
  ${renderTopChrome(sourceMark, input.pageNumber, input.totalPages, textColor)}
  ${kickerMarkup}
  <g>
    ${headlineMarkup}
    ${bodyMarkup}
  </g>
</svg>`

  try {
    const png = renderSvgToPng(svg)
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
  const bottom = layout.overlayStyle === 'archive-light' ? 880 : 860
  switch (layout.textPosition) {
    case 'top-left':
      return { x: left, y: 168, align: 'left' as const }
    case 'top-center':
      return { x: 540, y: 196, align: 'center' as const }
    case 'center':
      return { x: 540, y: 552, align: 'center' as const }
    case 'bottom-center':
      return { x: 540, y: bottom, align: 'center' as const }
    case 'left-column':
      return { x: left, y: 520, align: 'left' as const }
    default:
      return { x: left, y: bottom, align: 'left' as const }
  }
}

// Resolves one of the 9 admin-template logical positions to an anchor box, supporting
// left / center / right alignment for full WYSIWYG fidelity with the template editor.
function getTextBoxFromPosition(
  position: string,
  layout: LayoutDefinition,
  paddingX?: number,
  paddingY?: number,
): { x: number; y: number; align: 'left' | 'center' | 'right' } {
  const padX = paddingX ?? layout.safeArea.left
  const padY = paddingY ?? 0
  const left = padX
  const right = 1080 - padX
  const topY = Math.max(120, padY + 96)
  const bottomY = (layout.overlayStyle === 'archive-light' ? 880 : 860) - padY
  const y = position.startsWith('top') ? topY : position.startsWith('bottom') ? bottomY : 540
  if (position.endsWith('right')) return { x: right, y, align: 'right' }
  if (position.endsWith('center')) return { x: 540, y, align: 'center' }
  return { x: left, y, align: 'left' }
}

function fitTextBoxY(input: {
  layout: LayoutDefinition
  textBoxY: number
  typography: TypographyPlan
  headlineLineGap: number
  bodyLineGap: number
  badgeToHeadlineGap: number
  headlineToBodyGap: number
}) {
  const blockHeight = estimateRenderedTextBlockHeight(input)
  const safeTop = input.layout.safeArea.top + 48
  const safeBottom = 1350 - input.layout.safeArea.bottom
  const overflow = input.textBoxY + blockHeight - safeBottom
  if (overflow <= 0) return input.textBoxY
  return Math.max(safeTop, input.textBoxY - overflow - 24)
}

function estimateRenderedTextBlockHeight(input: {
  typography: TypographyPlan
  headlineLineGap: number
  bodyLineGap: number
  badgeToHeadlineGap: number
  headlineToBodyGap: number
}) {
  const kickerHeight = 24 + input.badgeToHeadlineGap
  const headlineHeight = Math.max(1, input.typography.headlineLines.length) *
    input.typography.headlineFontSize *
    input.headlineLineGap
  const bodyHeight = Math.max(1, input.typography.bodyLines.length) *
    input.typography.bodyFontSize *
    input.bodyLineGap
  return kickerHeight + headlineHeight + input.headlineToBodyGap + bodyHeight
}

function renderTopChrome(source: string, pageNumber: number | undefined, totalPages: number | undefined, fill: string) {
  const pageLabel = pageNumber && totalPages
    ? `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`
    : ''
  const opacity = fill === '#050505' ? 0.30 : 0.46
  return `
    <g class="top-chrome">
      <text xml:space="preserve" x="72" y="78" font-family="${fontFamily('clean-sans')}" font-size="22" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="4">${source}</text>
      ${pageLabel ? `<text xml:space="preserve" x="1008" y="78" text-anchor="end" font-family="${fontFamily('clean-sans')}" font-size="20" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="2">${pageLabel}</text>` : ''}
    </g>
  `
}

function renderKicker(input: RenderMediaCardInput, x: number, y: number, fill: string, align: 'left' | 'center' | 'right') {
  const label = buildSlideLabel(input)
  const opacity = fill === '#050505' ? 0.34 : 0.46
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  return `
    <text xml:space="preserve" x="${x}" y="${y + 22}" text-anchor="${anchor}" font-family="${fontFamily('clean-sans')}" font-size="18" font-weight="400" fill="${fill}" fill-opacity="${opacity}" letter-spacing="5">${escapeXml(label)}</text>
  `
}

function renderHeadline(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center' | 'right', fontFam: string, override?: { weight?: number; tracking?: number }) {
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const weight = override?.weight ?? 650
  const tracking = override?.tracking ?? -0.4
  let currentY = y

  return plan.headlineLines.map((line) => {
    const tspans = renderTokenTspans(line.tokens)
    const fallback = escapeXml(line.tokens.map(token => token.text).join(' '))
    const markup = `<text xml:space="preserve" x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.headlineFontSize}" font-weight="${weight}" fill="${fill}" letter-spacing="${tracking}">${tspans || fallback}</text>`
    currentY += plan.headlineFontSize * plan.lineHeight
    return markup
  }).join('')
}

function renderTokenTspans(tokens: TypographyToken[]) {
  return tokens.map((token, index) => {
    const prefix = index === 0 ? '' : ' '
    return `<tspan xml:space="preserve">${prefix}${escapeXml(token.text)}</tspan>`
  }).join('')
}

function renderBody(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center' | 'right', fontFam: string, bodyLineGap: number) {
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  let currentY = y

  return plan.bodyLines.map((line) => {
    const markup = `<text xml:space="preserve" x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.bodyFontSize}" font-weight="400" fill="${fill}" letter-spacing="-0.1">${escapeXml(line)}</text>`
    currentY += plan.bodyFontSize * bodyLineGap
    return markup
  }).join('')
}

async function renderArchiveCta(input: RenderMediaCardInput) {
  const sourceHandle = normalizeInstagramHandle(input.source || 'shuffla')
  const sourceMark = escapeXml(formatSourceMark(sourceHandle))
  const typography = applyTypographyOverrides(input)
  const backgroundImageDataUri = await toImageDataUri(input.backgroundImageUrl)
  const fontFam = input.fontOverride ?? fontFamily('clean-sans')
  const textColor = input.textColorOverride ?? '#f5f5f5'
  const secondaryTextColor = input.textColorOverride ?? '#ffffff'
  const headline = typography.headlineLines
    .map(line => line.tokens.map(token => token.text).join(' '))
    .join(' ') || input.headline
  const bodyLines = typography.bodyLines.length ? typography.bodyLines : [input.body]
  if (bodyLines.length > 5) {
    throw new Error(`CTA layout body exceeds renderable line limit (${bodyLines.length}/5)`)
  }
  const ctaBodyFontSize = bodyLines.length > 4 ? Math.min(typography.bodyFontSize, 22) : typography.bodyFontSize
  const ctaBodyStartY = bodyLines.length > 4 ? 982 : 1002

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#000000"/>
  <defs>
    <linearGradient id="cta-bottom-gradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="58%" stop-color="#000000" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  ${backgroundImageDataUri || input.backgroundImageUrl ? `<image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>` : ''}
  <rect width="1080" height="1350" fill="url(#cta-bottom-gradient)"/>
  ${renderTopChrome(sourceMark, input.pageNumber, input.totalPages, textColor)}
  <text xml:space="preserve" x="540" y="675" text-anchor="middle" font-family="${fontFam}" font-size="52" font-weight="700" fill="${textColor}" fill-opacity="0.42" letter-spacing="2">${sourceMark.toUpperCase()}</text>
  <text xml:space="preserve" x="540" y="925" text-anchor="middle" font-family="${fontFam}" font-size="${typography.headlineFontSize}" font-weight="750" fill="${textColor}" letter-spacing="-0.5">${escapeXml(headline)}</text>
  ${bodyLines.map((line, index) => `<text xml:space="preserve" x="540" y="${ctaBodyStartY + index * (ctaBodyFontSize + 12)}" text-anchor="middle" font-family="${fontFam}" font-size="${ctaBodyFontSize}" font-weight="400" fill="${secondaryTextColor}" fill-opacity="0.64" letter-spacing="-0.2">${escapeXml(line)}</text>`).join('')}
  <line x1="72" y1="1188" x2="1008" y2="1188" stroke="#ffffff" stroke-opacity="0.16"/>
  <rect x="72" y="1230" width="936" height="78" fill="#f3f3f3"/>
  <text xml:space="preserve" x="540" y="1280" text-anchor="middle" font-family="${fontFamily('clean-sans')}" font-size="28" font-weight="700" fill="#050505" letter-spacing="0">팔로우 ${escapeXml(sourceHandle)}</text>
</svg>`

  try {
    const png = renderSvgToPng(svg)
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

function applyTypographyOverrides(input: RenderMediaCardInput): TypographyPlan {
  return {
    ...input.typography,
    headlineFontSize: input.headlineFontSizeOverride ?? input.typography.headlineFontSize,
    bodyFontSize: input.bodyFontSizeOverride ?? input.typography.bodyFontSize,
    lineHeight: input.headlineLineHeightOverride ?? input.typography.lineHeight,
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
  if (!trimmed) return '@shuffla'
  const withoutUrl = trimmed
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .split(/[/?#]/)[0]
  const handle = withoutUrl.replace(/^@+/, '').replace(/\s+/g, '').toLowerCase()
  return `@${handle || 'shuffla'}`
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
  if (!isTrustedRenderableImageUrl(imageUrl)) return ''

  if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
    try {
      const cleanPath = imageUrl
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
