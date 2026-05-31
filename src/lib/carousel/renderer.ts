import { uploadGeneratedAsset } from '../storage/upload'
import type { BrandProfile, SlideCopy, SlideDesignPrompt, OverlayType } from './types'
import fs from 'fs'
import path from 'path'
import { renderSvgToPng } from '../render/svgToPng'
import { truncateAtSentenceBoundary } from '../copywriting/truncate'

export async function renderSlide(params: {
  campaignKey: string
  brand: BrandProfile
  copy: SlideCopy
  design: SlideDesignPrompt
  backgroundImageUrl: string
  showSlideNumber?: boolean
}) {
  const { textPosition, overlayType = 'dark_gradient_bottom', overlayStrength = 65 } = params.design
  const escapedHeadline = escapeXml(params.copy.headline)
  const escapedCta = escapeXml(params.copy.ctaText || '')
  // Ensure body is a complete sentence before wrapping — never cut mid-word
  const safeBody = truncateAtSentenceBoundary(params.copy.body, 150)
  const bodyLines = wrapText(safeBody, 30)
  const MAX_BODY_LINES = 5
  const brandColor = escapeXml(params.brand.mainColor || '#ff4f00')
  const backgroundImageDataUri = await toImageDataUri(params.backgroundImageUrl)
  const imgSrc = escapeXml(backgroundImageDataUri || params.backgroundImageUrl)

  // Text anchor Y based on position
  const textY = textPosition === 'top' ? 260 : textPosition === 'bottom' ? 780 : 500

  // Overlay opacity derived from strength (0-100)
  const alpha = (overlayStrength / 100).toFixed(2)
  const alphaHigh = Math.min(overlayStrength / 100 + 0.25, 1).toFixed(2)

  const bodyStartY = textY + 72
  const ctaY = textY + 60 + bodyLines.slice(0, MAX_BODY_LINES).length * 50

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    ${buildOverlayDefs(overlayType, alpha, alphaHigh)}
    <filter id="textShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="ctaShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background image: full opacity, overlay controls darkness -->
  <image href="${imgSrc}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice"/>

  <!-- Overlay -->
  ${buildOverlaySvg(overlayType)}

  <!-- Headline -->
  <text x="540" y="${textY}" text-anchor="middle"
    font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif"
    font-size="68" font-weight="800" fill="#ffffff"
    filter="url(#textShadow)"
    letter-spacing="-1">${escapedHeadline}</text>

  <!-- Body lines -->
  ${bodyLines.slice(0, MAX_BODY_LINES).map((line, i) => `
  <text x="540" y="${bodyStartY + i * 50}" text-anchor="middle"
    font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif"
    font-size="34" font-weight="500" fill="rgba(255,255,255,0.88)"
    filter="url(#textShadow)">${escapeXml(line)}</text>`).join('')}

  <!-- CTA button -->
  ${escapedCta ? `
  <rect x="330" y="${ctaY + 24}" width="420" height="78" rx="39"
    fill="${brandColor}" filter="url(#ctaShadow)"/>
  <text x="540" y="${ctaY + 74}" text-anchor="middle"
    font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif"
    font-size="30" font-weight="800" fill="#ffffff">${escapedCta}</text>` : ''}

  <!-- Brand name -->
  <text x="70" y="1010"
    font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif"
    font-size="26" font-weight="700" fill="#ffffff" opacity="0.75"
    filter="url(#textShadow)">${escapeXml(params.brand.name)}</text>

  <!-- Slide number -->
  ${params.showSlideNumber ? `
  <text x="1010" y="1010" text-anchor="end"
    font-family="Arial, sans-serif" font-size="24" font-weight="600"
    fill="#ffffff" opacity="0.60">${params.copy.slideNumber}</text>` : ''}
</svg>`

  try {
    const png = renderSvgToPng(svg)
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

// ─── Overlay SVG defs ─────────────────────────────────────────────────────────

function buildOverlayDefs(type: OverlayType, alpha: string, alphaHigh: string): string {
  const mid = (parseFloat(alpha) * 0.4).toFixed(2)
  const low = (parseFloat(alpha) * 0.2).toFixed(2)

  switch (type) {
    case 'dark_gradient_bottom':
      return `<linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
        <stop offset="45%"  stop-color="#000000" stop-opacity="${mid}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${alphaHigh}"/>
      </linearGradient>`

    case 'dark_gradient_top':
      return `<linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="${alphaHigh}"/>
        <stop offset="55%"  stop-color="#000000" stop-opacity="${mid}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>`

    case 'dark_gradient_center':
      return `<linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="${low}"/>
        <stop offset="50%"  stop-color="#000000" stop-opacity="${alphaHigh}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${low}"/>
      </linearGradient>`

    case 'cinematic_dark':
      return `<linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="${mid}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${alpha}"/>
      </linearGradient>`

    case 'radial_focus':
      return `<radialGradient id="overlay" cx="50%" cy="50%" r="55%" fx="50%" fy="50%">
        <stop offset="0%"   stop-color="#000000" stop-opacity="0"/>
        <stop offset="60%"  stop-color="#000000" stop-opacity="${mid}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${alphaHigh}"/>
      </radialGradient>`

    case 'blur_glass':
      return `<linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#000000" stop-opacity="${low}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${mid}"/>
      </linearGradient>`

    default:
      return ''
  }
}

function buildOverlaySvg(type: OverlayType): string {
  if (type === 'none') return ''

  if (type === 'blur_glass') {
    return `
  <rect x="0" y="0" width="1080" height="1080" fill="url(#overlay)"/>
  <rect x="80" y="370" width="920" height="340" rx="28"
    fill="#000000" fill-opacity="0.42"/>
  <rect x="80" y="370" width="920" height="340" rx="28"
    fill="#ffffff" fill-opacity="0.06"/>`
  }

  return `<rect x="0" y="0" width="1080" height="1080" fill="url(#overlay)"/>`
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function wrapText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return ['']

  const lines: string[] = []
  let line = ''

  for (const word of compact.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > maxLength) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }

  if (line) lines.push(line)
  return lines
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
      const cleanPath = imageUrl.startsWith('file://')
        ? imageUrl.replace('file://', '')
        : imageUrl
      const filePath = path.join(process.cwd(), 'public', cleanPath)
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath)
        const ext = path.extname(filePath).slice(1) || 'png'
        const contentType = ext === 'webp' ? 'image/webp' : `image/${ext}`
        return `data:${contentType};base64,${fileBuffer.toString('base64')}`
      }
    } catch (e) {
      console.warn('[ImageDataUri] Failed to read local file:', imageUrl, e)
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
    try {
      const fallbackPath = path.join(process.cwd(), 'public', 'background-showcase', 'showcase-1.webp')
      if (fs.existsSync(fallbackPath)) {
        const fileBuffer = fs.readFileSync(fallbackPath)
        return `data:image/webp;base64,${fileBuffer.toString('base64')}`
      }
    } catch (fallbackErr) {
      console.error('[ImageDataUri] Fallback image read failed', fallbackErr)
    }
    return ''
  }
}
