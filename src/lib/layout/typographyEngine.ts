import type { LayoutDefinition } from './layoutTypes'

export type TypographyTokenStyle = 'headline-emphasis' | 'headline-normal' | 'body' | 'category' | 'source'

export interface TypographyToken {
  text: string
  style: TypographyTokenStyle
}

export interface TypographyLine {
  tokens: TypographyToken[]
  widthEstimate: number
}

export interface TypographyPlan {
  headlineTokens: TypographyToken[]
  headlineLines: TypographyLine[]
  bodyLines: string[]
  emphasisWords: string[]
  headlineFontSize: number
  bodyFontSize: number
  lineHeight: number
  maxLineCount: number
  textAlign: 'left' | 'center'
  emphasisColor: string
}

export interface TypographyInput {
  headline: string
  body: string
  category: string
  layout: LayoutDefinition
  emphasisWords?: string[]
}

const PARTICLES = ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '으로', '와', '과', '도', '만']

export function planTypography(input: TypographyInput): TypographyPlan {
  const emphasisWords = input.emphasisWords?.length
    ? input.emphasisWords
    : inferEmphasisWords(input.headline)

  const headlineTokens = segmentHeadline(input.headline, emphasisWords)
  const maxChars = getHeadlineLineChars(input.layout)
  const headlineLines = breakTokenLines(headlineTokens, maxChars, 3)
  const bodyLines = breakTextLines(input.body, getBodyLineChars(input.layout), 4)

  return {
    headlineTokens,
    headlineLines,
    bodyLines,
    emphasisWords,
    headlineFontSize: getHeadlineFontSize(input.layout, headlineLines.length),
    bodyFontSize: getBodyFontSize(input.layout),
    lineHeight: input.layout.typographyStyle === 'quote-large' ? 1.16 : 1.08,
    maxLineCount: 3,
    textAlign: input.layout.textPosition.includes('center') ? 'center' : 'left',
    emphasisColor: getEmphasisColor(input.layout.preferredColorPalette),
  }
}

export function segmentHeadline(headline: string, emphasisWords: string[]): TypographyToken[] {
  const normalized = headline.trim().replace(/\s+/g, ' ')
  if (!normalized) return []

  const tokens: TypographyToken[] = []
  const parts = normalized.split(' ')

  for (const part of parts) {
    const isEmphasis = emphasisWords.some(word => part.includes(word))
    tokens.push({
      text: part,
      style: isEmphasis ? 'headline-emphasis' : 'headline-normal',
    })
  }

  return tokens
}

function inferEmphasisWords(headline: string) {
  const words = headline
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= 2 && !PARTICLES.includes(word))

  const numeric = words.filter(word => /[\d%]/.test(word))
  if (numeric.length) return numeric.slice(0, 2)

  return words
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
}

function breakTokenLines(tokens: TypographyToken[], maxChars: number, maxLines: number): TypographyLine[] {
  const lines: TypographyLine[] = []
  let current: TypographyToken[] = []
  let currentLength = 0

  for (const token of tokens) {
    const nextLength = currentLength + token.text.length + (current.length ? 1 : 0)
    if (current.length && nextLength > maxChars && lines.length < maxLines - 1) {
      lines.push({ tokens: current, widthEstimate: currentLength })
      current = [token]
      currentLength = token.text.length
    } else {
      current.push(token)
      currentLength = nextLength
    }
  }

  if (current.length) {
    lines.push({ tokens: current, widthEstimate: currentLength })
  }

  return lines.slice(0, maxLines)
}

function breakTextLines(text: string, maxChars: number, maxLines: number) {
  const words = text.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && next.length > maxChars && lines.length < maxLines - 1) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, maxLines)
}

function getHeadlineLineChars(layout: LayoutDefinition) {
  if (layout.typographyStyle === 'stat-numeric') return 12
  if (layout.textPosition === 'center') return 13
  if (layout.textPosition.includes('column')) return 11
  return 12
}

function getBodyLineChars(layout: LayoutDefinition) {
  if (layout.textPosition.includes('column')) return 22
  if (layout.textPosition.includes('center')) return 24
  return 26
}

function getHeadlineFontSize(layout: LayoutDefinition, lineCount: number) {
  const base = layout.typographyStyle === 'stat-numeric'
    ? 104
    : layout.typographyStyle === 'quote-large'
      ? 82
      : layout.typographyStyle === 'clean-sans'
        ? 70
        : 78

  return Math.max(56, base - Math.max(0, lineCount - 2) * 8)
}

function getBodyFontSize(layout: LayoutDefinition) {
  return layout.typographyStyle === 'clean-sans' ? 34 : 31
}

function getEmphasisColor(palette: string[]) {
  if (palette.includes('red')) return '#ff2d2d'
  if (palette.includes('cyan')) return '#2bb8ff'
  if (palette.includes('yellow')) return '#ffd84d'
  if (palette.includes('green')) return '#33c481'
  if (palette.includes('blue')) return '#2aa2db'
  return '#ff4f0a'
}
