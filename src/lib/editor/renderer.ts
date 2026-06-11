import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { renderSvgToPng } from '../render/svgToPng'
import { uploadGeneratedAsset } from '../storage/upload'
import { layerByType, normalizeDocument } from './document'
import type { EditorialDocument, EditorialLayer, FontPreset } from './types'

export async function renderEditorialDocument(
  id: string,
  rawDocument: EditorialDocument,
  options: { format?: 'png' | 'jpg'; scale?: 1 | 2 } = {},
) {
  const document = normalizeDocument(rawDocument)
  const background = layerByType(document, 'background')
  const backgroundData = await toImageDataUri(background?.imageUrl || '')

  // Pre-fetch image data for user-added sticker layers so renderLayer stays sync
  const stickerImageData = new Map<string, string>()
  for (const layer of document.layers) {
    if (layer.type === 'sticker' && layer.id !== 'sticker' && layer.imageUrl) {
      const data = await toImageDataUri(layer.imageUrl)
      if (data) stickerImageData.set(layer.id, data)
    }
  }

  const svg = buildSvg(document, backgroundData, stickerImageData)
  const format = options.format || 'png'
  const png = renderSvgToPng(svg, options.scale || 1)
  const content = format === 'jpg' ? await sharp(png).jpeg({ quality: 94, mozjpeg: true }).toBuffer() : png
  return uploadGeneratedAsset({
    fileName: `${id}.${format}`,
    content,
    contentType: format === 'jpg' ? 'image/jpeg' : 'image/png',
  })
}

function buildSvg(document: EditorialDocument, backgroundData: string, stickerImageData: Map<string, string> = new Map()) {
  const visible = document.layers.filter(layer => layer.visible).sort((a, b) => a.zIndex - b.zIndex)
  // Collect unique blur/edgeFade values from sticker layers for SVG filter defs
  const stickerBlurDefs = visible
    .filter(layer => layer.type === 'sticker' && layer.id !== 'sticker' && layer.blur)
    .map(layer => `    <filter id="blur-${layer.id}"><feGaussianBlur stdDeviation="${layer.blur}"/></filter>`)
    .join('\n')
  // Edge fade: 4-directional linear gradients in SVG mask
  const stickerMaskDefs = visible
    .filter(layer => layer.type === 'sticker' && layer.id !== 'sticker' && (layer.edgeFade ?? 0) > 0)
    .map(layer => {
      const fade = layer.edgeFade! / 100
      return `    <linearGradient id="fade-h-${layer.id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="${fade}" stop-color="white" stop-opacity="1"/><stop offset="${1 - fade}" stop-color="white" stop-opacity="1"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <linearGradient id="fade-v-${layer.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white" stop-opacity="0"/><stop offset="${fade}" stop-color="white" stop-opacity="1"/><stop offset="${1 - fade}" stop-color="white" stop-opacity="1"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
    <mask id="fade-${layer.id}" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#fade-h-${layer.id})"/><rect width="1" height="1" fill="url(#fade-v-${layer.id})" style="mix-blend-mode:multiply"/></mask>`
    })
    .join('\n')
  const content = visible.map(layer => renderLayer(layer, document, backgroundData, stickerImageData)).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <filter id="editor-bg"><feGaussianBlur stdDeviation="${document.overlay.blur}"/><feComponentTransfer><feFuncR type="linear" slope="${document.overlay.contrast / 100}"/><feFuncG type="linear" slope="${document.overlay.contrast / 100}"/><feFuncB type="linear" slope="${document.overlay.contrast / 100}"/></feComponentTransfer></filter>
    <filter id="editor-text-shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.48"/></filter>
    <filter id="editor-grain"><feTurbulence baseFrequency="0.52" numOctaves="3" seed="12"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .32 0"/></filter>
${stickerBlurDefs}
${stickerMaskDefs}
    <radialGradient id="editor-vignette"><stop offset="45%" stop-color="#000000" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="${document.overlay.vignette / 100}"/></radialGradient>
    <linearGradient id="editor-darkness" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${document.overlay.colorFilter}" stop-opacity="${document.overlay.darkness / 250}"/><stop offset="1" stop-color="#050507" stop-opacity="${document.overlay.darkness / 100}"/></linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="#0c0d10"/>
  ${content}
</svg>`
}

function renderLayer(layer: EditorialLayer, document: EditorialDocument, backgroundData: string, stickerImageData: Map<string, string> = new Map()) {
  const opacity = layer.opacity / 100
  if (layer.type === 'background') {
    const source = backgroundData || layer.imageUrl || ''
    if (!source) return ''
    const scale = layer.scale ?? 1
    const tx = layer.x ?? 0
    const ty = layer.y ?? 0
    // SVG transform: translate then scale from origin (0,0) — matches CSS transform-origin:0 0
    const transform = (scale !== 1 || tx !== 0 || ty !== 0)
      ? ` transform="translate(${tx},${ty}) scale(${scale})"`
      : ''
    return `<image href="${escapeXml(source)}" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" opacity="${opacity}"${transform} filter="${document.overlay.blur ? 'url(#editor-bg)' : ''}"/>`
  }
  if (layer.type === 'overlay') {
    return `<rect width="1080" height="1350" fill="url(#editor-darkness)" opacity="${opacity}"/><rect width="1080" height="1350" fill="url(#editor-vignette)" opacity="${opacity}"/><rect width="1080" height="1350" filter="url(#editor-grain)" opacity="${document.overlay.grain / 180}"/>`
  }
  if (layer.type === 'sticker' && layer.id !== 'sticker') {
    const imageData = stickerImageData.get(layer.id)
    if (!imageData) return ''
    const cx = layer.x + layer.width / 2
    const cy = layer.y + layer.height / 2
    const scale = layer.scale || 1
    const transform = `rotate(${layer.rotation || 0} ${cx} ${cy}) scale(${scale} ${scale})`
    const blurAttr = layer.blur ? ` filter="url(#blur-${layer.id})"` : ''
    const maskAttr = (layer.edgeFade ?? 0) > 0 ? ` mask="url(#fade-${layer.id})"` : ''
    return `<image href="${escapeXml(imageData)}" x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}" transform="${transform}"${blurAttr}${maskAttr}/>`
  }
  if (!layer.text && !layer.textHtml) return ''
  const fontFamily = fontFamilyForPreset(layer.fontPreset)
  const anchorX = layer.textAlign === 'center' ? layer.x + layer.width / 2 : layer.textAlign === 'right' ? layer.x + layer.width : layer.x
  const fontSize = layer.fontSize || 24
  const text = renderRichText(layer, anchorX, fontFamily)
  const background = layer.textBackground
    ? `<rect x="${layer.x - 12}" y="${layer.y - 8}" width="${layer.width + 24}" height="${layer.height + 16}" rx="10" fill="${escapeXml(layer.textBackground)}" opacity="${opacity}"/>`
    : ''
  return `${background}<text font-family="${fontFamily}" font-size="${fontSize}" font-weight="${layer.fontWeight || 400}" letter-spacing="${layer.tracking || 0}" fill="${escapeXml(layer.color || '#ffffff')}" opacity="${opacity}" stroke="${escapeXml(layer.strokeColor || 'none')}" stroke-width="${layer.stroke || 0}" paint-order="stroke" filter="${layer.shadow ? 'url(#editor-text-shadow)' : ''}" transform="rotate(${layer.rotation} ${anchorX} ${layer.y}) scale(${layer.scale})">${text}</text>`
}

interface TextRun {
  text: string
  fontSize?: number
  fontWeight?: number
  italic?: boolean
  underline?: boolean
  breakBefore?: boolean
}

interface LineRun extends TextRun {
  x: number
}

function renderRichText(layer: EditorialLayer, anchorX: number, fontFamily: string) {
  const lines = wrapRichTextForLayer(layer).slice(0, 12)
  let cursorY = layer.y
  return lines.map(line => {
    const lineHeight = Math.max(...line.runs.map(run => run.fontSize || layer.fontSize || 24), [layer.fontSize || 24][0]) * (layer.lineHeight || 1.25)
    cursorY += lineHeight
    const startX = layer.textAlign === 'center'
      ? anchorX - line.width / 2
      : layer.textAlign === 'right'
        ? anchorX - line.width
        : anchorX
    let cursorX = startX
    return line.runs.map(run => {
      const output = `<tspan x="${cursorX}" y="${cursorY}" font-family="${fontFamily}" font-size="${run.fontSize || layer.fontSize || 24}" font-weight="${run.fontWeight || layer.fontWeight || 400}"${run.italic ? ' font-style="italic"' : ''}${run.underline ? ' text-decoration="underline"' : ''}>${escapeXml(run.text)}</tspan>`
      cursorX += estimateTextWidth(run.text, run.fontSize || layer.fontSize || 24, layer.tracking || 0)
      return output
    }).join('')
  }).join('')
}

function wrapRichTextForLayer(layer: EditorialLayer) {
  const baseFontSize = layer.fontSize || 24
  const maxWidth = Math.max(layer.width, baseFontSize)
  const tracking = layer.tracking || 0
  const sourceRuns = layer.textHtml ? parseRichTextHtml(layer.textHtml, layer) : plainTextRuns(layer.text || '', layer)
  const lines: { runs: LineRun[]; width: number }[] = []
  let currentRuns: LineRun[] = []
  let currentWidth = 0

  const pushLine = () => {
    lines.push({ runs: currentRuns, width: currentWidth })
    currentRuns = []
    currentWidth = 0
  }

  for (const run of sourceRuns) {
    if (run.breakBefore && (currentRuns.length > 0 || currentWidth > 0)) pushLine()
    for (const char of run.text) {
      if (char === '\n') {
        pushLine()
        continue
      }
      const runFontSize = run.fontSize || baseFontSize
      const width = estimateTextWidth(char, runFontSize, tracking)
      if (currentRuns.length > 0 && currentWidth + width > maxWidth) pushLine()
      const previous = currentRuns.at(-1)
      if (previous && sameRunStyle(previous, run)) {
        previous.text += char
      } else {
        currentRuns.push({ ...run, text: char, x: currentWidth })
      }
      currentWidth += width
    }
  }
  if (currentRuns.length > 0 || lines.length === 0) pushLine()
  return lines
}

function sameRunStyle(a: TextRun, b: TextRun) {
  return a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.italic === b.italic &&
    a.underline === b.underline
}

function plainTextRuns(text: string, layer?: EditorialLayer): TextRun[] {
  return [{
    text,
    fontWeight: layer?.fontWeight,
    italic: layer?.italic,
    underline: layer?.underline,
  }]
}

function parseRichTextHtml(html: string, layer: EditorialLayer): TextRun[] {
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean)
  const runs: TextRun[] = []
  const stack: Omit<TextRun, 'text'>[] = [{}]

  const current = () => ({ ...stack[stack.length - 1] })

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      const decoded = decodeHtml(token)
      if (decoded) runs.push({ ...current(), text: decoded })
      continue
    }

    const tag = token.toLowerCase()
    if (/^<br\s*\/?>/.test(tag) || /^<\/div/.test(tag) || /^<\/p/.test(tag)) {
      runs.push({ ...current(), text: '\n' })
      continue
    }
    if (/^<div/.test(tag) || /^<p/.test(tag)) {
      if (runs.length > 0) runs.push({ ...current(), text: '\n' })
      continue
    }
    if (/^<\/(span|b|strong|i|em|u)>/.test(tag)) {
      if (stack.length > 1) stack.pop()
      continue
    }
    if (/^<(b|strong)\b/.test(tag)) {
      stack.push({ ...current(), fontWeight: 800 })
      continue
    }
    if (/^<(i|em)\b/.test(tag)) {
      stack.push({ ...current(), italic: true })
      continue
    }
    if (/^<u\b/.test(tag)) {
      stack.push({ ...current(), underline: true })
      continue
    }
    if (/^<span\b/.test(tag)) {
      const style = current()
      const fontSizeMatch = token.match(/data-font-size=["']?(\d+(?:\.\d+)?)/i)
      const fontSize = fontSizeMatch ? Number(fontSizeMatch[1]) : undefined
      stack.push({
        ...style,
        fontSize: Number.isFinite(fontSize) ? Math.min(180, Math.max(10, fontSize!)) : style.fontSize || layer.fontSize,
      })
    }
  }

  return runs.length > 0 ? runs : [{ text: layer.text || '' }]
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function estimateTextWidth(text: string, fontSize: number, tracking: number) {
  let width = 0
  for (const char of text) {
    if (/\s/.test(char)) width += fontSize * 0.32
    else if (/[A-Z]/.test(char)) width += fontSize * 0.68
    else if (/[a-z0-9]/.test(char)) width += fontSize * 0.55
    else if (/[.,:;!?/()'"-]/.test(char)) width += fontSize * 0.38
    else width += fontSize
    width += tracking
  }
  return width
}

export function fontFamilyForPreset(preset?: FontPreset | null) {
  switch (preset) {
    case 'serif':
    case 'magazine':
      return 'Georgia, Times New Roman, Noto Serif KR, serif'
    case 'suit':
      return 'SUIT, Pretendard, Noto Sans KR, sans-serif'
    case 'noto-sans':
      return 'Noto Sans KR, Pretendard, sans-serif'
    default:
      return 'Pretendard, Apple SD Gothic Neo, Noto Sans KR, sans-serif'
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
  if (imageUrl.startsWith('/') || imageUrl.startsWith('file://')) {
    const cleanPath = imageUrl.startsWith('file://') ? imageUrl.replace('file://', '') : imageUrl
    const filePath = path.join(process.cwd(), 'public', cleanPath)
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath)
      const ext = path.extname(filePath).slice(1) || 'png'
      return `data:image/${ext};base64,${fileBuffer.toString('base64')}`
    }
  }
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) return ''
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${contentType};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`
  } catch {
    return ''
  }
}
