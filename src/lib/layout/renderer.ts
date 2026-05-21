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
  
  const fontFam = fontFamily(input.layout.typographyStyle)
  const bodyLineGap = input.layout.spacingRules?.bodyLineGap || 1.42
  const headlineLineGap = input.layout.spacingRules?.headlineLineGap || 1.10
  const badgeToHeadlineGap = input.layout.spacingRules?.badgeToHeadlineGap || 24
  const headlineToBodyGap = input.layout.spacingRules?.headlineToBodyGap || 38

  let currentY = textBox.y
  let categoryMarkup = ''
  
  if (input.category) {
    const badge = renderCategoryBadge(
      category,
      textBox.x,
      currentY,
      input.typography.emphasisColor,
      textBox.align
    )
    categoryMarkup = badge.markup
    currentY += badge.height + badgeToHeadlineGap
  }

  // Adjust Y baseline for the first headline line
  const headlineStartBaseline = currentY + input.typography.headlineFontSize * 0.95
  const headlineMarkup = renderHeadline(
    input.typography,
    textBox.x,
    headlineStartBaseline,
    input.overlay.textColor,
    textBox.align,
    fontFam
  )

  // Calculate body starting position based on exact headline line count and spacing rules
  const bodyStartBaseline = headlineStartBaseline + 
    (input.typography.headlineLines.length - 1) * input.typography.headlineFontSize * headlineLineGap + 
    headlineToBodyGap + 
    input.typography.bodyFontSize * 0.95

  const bodyMarkup = renderBody(
    input.typography,
    textBox.x,
    bodyStartBaseline,
    input.overlay.secondaryTextColor,
    textBox.align,
    fontFam,
    bodyLineGap
  )

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    ${input.overlay.svgDefs}
    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <filter id="plate-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="32" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="#111111"/>
  <image href="${escapeXml(backgroundImageDataUri || input.backgroundImageUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  ${input.overlay.svgMarkup}
  ${renderMinimalSurface(input.layout)}
  ${categoryMarkup}
  <g filter="${input.overlay.textColor === '#ffffff' ? 'url(#text-shadow)' : ''}">
    ${headlineMarkup}
    ${bodyMarkup}
  </g>
  ${renderSourceBadge(source, input.layout.safeArea.left, 1268, input.overlay.textColor, input.typography.emphasisColor)}
  ${input.totalPages && input.pageNumber ? renderPaginationPill(input.pageNumber, input.totalPages, 1080 - input.layout.safeArea.right, 1268, input.overlay.textColor) : ''}
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

function renderCategoryBadge(category: string, x: number, y: number, emphasisColor: string, align: 'left' | 'center') {
  if (!category) return { markup: '', height: 0 }
  
  let estimatedWidth = 0
  for (let i = 0; i < category.length; i++) {
    const code = category.charCodeAt(i)
    if (code >= 0xac00 && code <= 0xd7a3) {
      estimatedWidth += 24
    } else if (code >= 65 && code <= 90) {
      estimatedWidth += 18
    } else {
      estimatedWidth += 13
    }
  }
  
  const paddingX = 20
  const badgeWidth = estimatedWidth + paddingX * 2
  const badgeHeight = 44
  const rx = 12
  
  const badgeX = align === 'center' ? x - badgeWidth / 2 : x
  const badgeY = y
  const textX = badgeX + badgeWidth / 2
  const textY = badgeY + 29
  
  const bgFill = emphasisColor || '#ff5a00'
  const textFill = '#ffffff'
  
  const markup = `
    <g class="category-badge">
      <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${rx}" fill="${bgFill}"/>
      <text x="${textX}" y="${textY}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="20" font-weight="900" fill="${textFill}" letter-spacing="1.5">${escapeXml(category)}</text>
    </g>
  `
  return { markup, height: badgeHeight }
}

function renderHeadline(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string) {
  let currentY = y
  const anchor = align === 'center' ? 'middle' : 'start'

  return plan.headlineLines.map((line) => {
    const text = line.tokens.map(token => token.text).join(' ')
    const tspans = renderTokenTspans(line.tokens, plan.emphasisColor)
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.headlineFontSize}" font-weight="950" fill="${fill}" letter-spacing="-2">${tspans || escapeXml(text)}</text>`
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

function renderBody(plan: TypographyPlan, x: number, y: number, fill: string, align: 'left' | 'center', fontFam: string, bodyLineGap: number) {
  const anchor = align === 'center' ? 'middle' : 'start'
  let currentY = y

  return plan.bodyLines.map((line) => {
    const markup = `<text x="${x}" y="${currentY}" text-anchor="${anchor}" font-family="${fontFam}" font-size="${plan.bodyFontSize}" font-weight="700" fill="${fill}" letter-spacing="-0.4">${escapeXml(line)}</text>`
    currentY += plan.bodyFontSize * bodyLineGap
    return markup
  }).join('')
}

function renderPaginationPill(pageNumber: number, totalPages: number, x: number, y: number, textColor: string) {
  const text = `${pageNumber} / ${totalPages}`
  const pillWidth = 96
  const pillHeight = 44
  const pillX = x - pillWidth
  const pillY = y - 28
  
  const bgFill = textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)'
  const borderStroke = textColor === '#ffffff' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(0, 0, 0, 0.12)'
  const fontColor = textColor === '#ffffff' ? '#ffffff' : '#111111'

  return `
    <g class="pagination-indicator">
      <rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="${pillHeight}" rx="22" fill="${bgFill}" stroke="${borderStroke}" stroke-width="1.5"/>
      <text x="${pillX + pillWidth / 2}" y="${pillY + 28}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="18" font-weight="800" fill="${fontColor}" letter-spacing="1">${text}</text>
    </g>
  `
}

function renderSourceBadge(source: string, x: number, y: number, textColor: string, emphasisColor: string) {
  if (!source) return ''
  const dotColor = emphasisColor || '#ff5a00'
  const fontColor = textColor === '#ffffff' ? '#ffffff' : '#111111'
  const textOpacity = textColor === '#ffffff' ? '0.9' : '0.8'
  
  return `
    <g class="brand-badge">
      <circle cx="${x + 8}" cy="${y - 8}" r="6" fill="${dotColor}"/>
      <text x="${x + 24}" y="${y}" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="22" font-weight="900" fill="${fontColor}" fill-opacity="${textOpacity}" letter-spacing="1">${escapeXml(source)}</text>
    </g>
  `
}


function renderMinimalSurface(layout: LayoutDefinition) {
  if (layout.overlayStyle !== 'none') return ''
  return `
    <!-- 종이 질감 느낌의 정밀한 레이아웃 카드 플레이트 -->
    <g>
      <!-- 부드러운 드롭 섀도우가 들어간 흰색 본체 플레이트 -->
      <rect x="54" y="70" width="972" height="1210" rx="24" fill="#ffffff" fill-opacity="0.94" filter="url(#plate-shadow)"/>
      <!-- 에디토리얼 테두리 선 -->
      <rect x="74" y="90" width="932" height="1170" rx="16" fill="none" stroke="#e5e7eb" stroke-width="2" stroke-opacity="0.8"/>
    </g>
  `
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
