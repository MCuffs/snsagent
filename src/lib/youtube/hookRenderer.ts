import fs from 'node:fs/promises'
import { Resvg } from '@resvg/resvg-js'
import type { YouTubeShortsTemplateRecord } from '../../../lib/youtube-shorts-templates/types'

export async function renderHookOverlay(params: {
  title: string
  template: YouTubeShortsTemplateRecord
  outputPath: string
  repoRoot: string
}) {
  const hook = params.template.config.hookDesign
  const layout = params.template.config.layout
  if (!layout.headerEnabled || layout.headerHeight <= 0) return null
  const headerHeight = Math.round(1920 * layout.headerHeight / 100)
  const background = hook.backgroundType === 'gradient'
    ? '<rect width="1080" height="' + headerHeight + '" fill="url(#hookGradient)"/>'
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
      <filter id="hookShadow"><feDropShadow dx="0" dy="${hook.shadowOffsetY}" stdDeviation="${hook.shadowBlur}" flood-color="${hook.shadowColor}"/></filter>
      <style>.hook{font-family:Pretendard;font-size:${hook.fontSize}px;font-weight:${hook.fontWeight};letter-spacing:${hook.letterSpacing}px}.badge{font-family:Pretendard;font-size:20px;font-weight:900;fill:#071127}</style>
    </defs>
    ${background}${accent}${badge}
  </svg>`
  const png = new Resvg(svg).render().asPng()
  await fs.writeFile(params.outputPath, png)
  return params.outputPath
}

export function splitHook(title: string, maxLines: number, fontSize: number, paddingX: number) {
  const clean = title.replace(/\s+/g, ' ').trim()
  if (!clean) return ['오늘의 핵심 이야기']
  const approximateCharacters = Math.max(6, Math.floor((1080 - paddingX * 2) / (fontSize * 0.88)))
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > approximateCharacters && current && lines.length < maxLines - 1) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length === 1 && clean.length > approximateCharacters && maxLines > 1) {
    const middle = Math.floor(clean.length / 2)
    const space = clean.lastIndexOf(' ', middle)
    const cut = space > 3 ? space : middle
    return [clean.slice(0, cut).trim(), clean.slice(cut).trim()]
  }
  return lines.slice(0, maxLines)
}
