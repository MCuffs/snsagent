import fs from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
import type { YouTubeShortsTemplateRecord } from '../../../lib/youtube-shorts-templates/types'

export async function renderHookOverlay(params: {
  title: string
  template: YouTubeShortsTemplateRecord
  outputPath: string
}) {
  const hook = params.template.config.hookDesign
  const layout = params.template.config.layout
  if (!layout.headerEnabled || layout.headerHeight <= 0) return null
  const headerHeight = Math.round(1920 * layout.headerHeight / 100)
  const background = hook.backgroundType === 'gradient'
    ? `<rect width="1080" height="${headerHeight}" fill="url(#hookGradient)"/>`
    : hook.backgroundType === 'solid'
      ? `<rect width="1080" height="${headerHeight}" fill="${hook.backgroundColor}"/>`
      : ''
  const badge = hook.categoryBadgeEnabled
    ? `<rect x="${hook.paddingX}" y="24" width="190" height="44" rx="8" fill="${hook.emphasisColor}"/><text x="${hook.paddingX + 95}" y="55" text-anchor="middle" class="badge">SHUFFLA NOW</text>`
    : ''
  const accent = hook.preset === 'breaking_news'
    ? '<path d="M0 0H1080V10H0Z" fill="#16E0E8" opacity=".9"/><path d="M720 0L1080 0L1080 260Z" fill="#16E0E8" opacity=".035"/>'
    : ''
  const svg = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="hookGradient" x1="0" y1="0" x2="1080" y2="${headerHeight}"><stop stop-color="${hook.backgroundGradientStart}"/><stop offset="1" stop-color="${hook.backgroundGradientEnd}"/></linearGradient>
      <style>.badge{font-family:sans-serif;font-size:20px;font-weight:900;fill:#071127}</style>
    </defs>
    ${background}${accent}${badge}
  </svg>`
  const png = new Resvg(svg).render().asPng()
  await fs.writeFile(params.outputPath, png)
  return params.outputPath
}

export function splitHook(title: string, maxLines: number, fontSize: number, paddingX: number) {
  return fitHookText(title, { maxLines, fontSize, paddingX }).lines
}

export function fitHookText(
  title: string,
  options: { maxLines: number; fontSize: number; paddingX: number; minFontSize?: number; maxCharacters?: number },
) {
  const normalized = title.replace(/\s+/g, ' ').trim() || '오늘의 핵심 이야기'
  const characters = Array.from(normalized)
  const maxCharacters = options.maxCharacters ?? 42
  const clean = characters.length > maxCharacters
    ? `${characters.slice(0, maxCharacters - 1).join('').trim()}…`
    : normalized
  const minFontSize = options.minFontSize ?? 48
  for (let fontSize = options.fontSize; fontSize >= minFontSize; fontSize -= 2) {
    const lines = splitForSize(clean, options.maxLines, fontSize, options.paddingX)
    const capacity = lineCapacity(fontSize, options.paddingX)
    if (lines.length <= options.maxLines && lines.every(line => visualLength(line) <= capacity)) {
      return { lines, fontSize, truncated: clean !== normalized }
    }
  }
  const capacity = lineCapacity(minFontSize, options.paddingX)
  const hardLimit = Math.max(6, Math.floor(capacity * options.maxLines))
  const shortened = Array.from(clean)
  const safe = shortened.length > hardLimit ? `${shortened.slice(0, hardLimit - 1).join('').trim()}…` : clean
  return {
    lines: splitForSize(safe, options.maxLines, minFontSize, options.paddingX),
    fontSize: minFontSize,
    truncated: true,
  }
}

function splitForSize(clean: string, maxLines: number, fontSize: number, paddingX: number) {
  const capacity = lineCapacity(fontSize, paddingX)
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (visualLength(next) > capacity && current && lines.length < maxLines - 1) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length === 1 && visualLength(clean) > capacity && maxLines > 1) {
    const characters = Array.from(clean)
    const middle = Math.floor(characters.length / 2)
    const left = characters.slice(0, middle).join('')
    const space = left.lastIndexOf(' ')
    const cut = space > 3 ? space : middle
    return [characters.slice(0, cut).join('').trim(), characters.slice(cut).join('').trim()]
  }
  return lines.slice(0, maxLines)
}

function lineCapacity(fontSize: number, paddingX: number) {
  return Math.max(6, (1080 - paddingX * 2) / (fontSize * 0.9))
}

function visualLength(value: string) {
  return Array.from(value).reduce(
    (total, character) => total + (/[^\u0000-\u00ff]/.test(character) ? 1 : 0.56),
    0,
  )
}
