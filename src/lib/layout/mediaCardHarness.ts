import type { LayoutDefinition } from './layoutTypes'
import { generateOverlay, type OverlayPlan } from './overlayEngine'
import type { TypographyLine, TypographyPlan, TypographyToken } from './typographyEngine'

export interface MediaCardHarnessResult {
  layout: LayoutDefinition
  typography: TypographyPlan
  overlay: OverlayPlan
  diagnostics: {
    score: number
    issues: string[]
    rules: string[]
  }
}

const HARNESS_RULES = [
  'archive-bottom-left-composition',
  'muted-gray-film-overlay',
  'no-inline-color-emphasis',
  'medium-weight-korean-typography',
  'instagram-handle-metadata',
  'image-model-background-only',
  'bounded-title-fit',
]

const HEADLINE_MAX_CHARS = 9
const TEXT_BLOCK_MAX_HEIGHT = 330

export function applyMediaCardHarness(input: {
  layout: LayoutDefinition
  typography: TypographyPlan
}): MediaCardHarnessResult {
  const layout = enforceArchiveLayout(input.layout)
  const typography = enforceArchiveTypography(input.typography)
  const overlay = generateOverlay(layout.overlayStyle)
  const issues = validateHarness(layout, typography)

  return {
    layout,
    typography,
    overlay,
    diagnostics: {
      score: Math.max(0, 100 - issues.length * 12),
      issues,
      rules: HARNESS_RULES,
    },
  }
}

export function buildHarnessedVisualPrompt(prompt: string) {
  return [
    'archive style Korean Instagram product/news card reference',
    'centered product or subject with quiet surrounding space',
    'lower-left area reserved for small editorial typography',
    'muted gray film layer, subdued contrast, not vivid, not poster-like',
    'ignore any conflicting centered-title, vivid-gradient, poster, UI, or white-panel layout direction from the source prompt',
    `source visual context: ${prompt}`,
    'no generated text, no typography, no letters, no numbers, no logo, no watermark',
  ].join(', ')
}

function enforceArchiveLayout(layout: LayoutDefinition): LayoutDefinition {
  return {
    ...layout,
    typographyStyle: 'clean-sans',
    overlayStyle: 'dark-gradient',
    textPosition: 'bottom-left',
    safeArea: {
      top: 72,
      bottom: 132,
      left: 72,
      right: 72,
    },
    preferredColorPalette: ['black', 'white', 'gray'],
    recommendedHeadlineLength: Math.min(layout.recommendedHeadlineLength, 16),
    recommendedBodyLength: Math.min(layout.recommendedBodyLength, 36),
    visualMood: `${layout.visualMood}, muted archive editorial, quiet premium product card`,
    visualDensity: 'low',
    spacingRules: {
      headlineLineGap: 1.03,
      bodyLineGap: 1.34,
      badgeToHeadlineGap: 18,
      headlineToBodyGap: 24,
    },
  }
}

function enforceArchiveTypography(typography: TypographyPlan): TypographyPlan {
  const headlineLines = rebuildHeadlineLines(typography)
  const bodyLines = typography.bodyLines.slice(0, 2)
  const headlineFontSize = fitHeadlineFontSize(headlineLines.length)
  const bodyFontSize = bodyLines.length > 1 ? 23 : 25

  return {
    ...typography,
    headlineLines,
    bodyLines,
    headlineTokens: headlineLines.flatMap(line => line.tokens),
    headlineFontSize,
    bodyFontSize,
    lineHeight: 1.03,
    maxLineCount: 3,
    textAlign: 'left',
    emphasisColor: '#ffffff',
    readabilityScore: Math.max(typography.readabilityScore, 88),
  }
}

function validateHarness(layout: LayoutDefinition, typography: TypographyPlan) {
  const issues: string[] = []

  if (layout.textPosition !== 'bottom-left') {
    issues.push('텍스트 위치가 하단 좌측 아카이브 구도가 아닙니다.')
  }
  if (layout.overlayStyle !== 'dark-gradient') {
    issues.push('회색 필름 오버레이와 하단 그림자 기준을 벗어났습니다.')
  }
  if (typography.textAlign !== 'left') {
    issues.push('타이포그래피 정렬이 좌측 기준이 아닙니다.')
  }
  if (typography.headlineFontSize > 68) {
    issues.push('헤드라인이 레퍼런스보다 과하게 큽니다.')
  }
  if (typography.bodyLines.length > 2) {
    issues.push('본문이 2줄을 초과해 저장형 카드 밀도를 해칩니다.')
  }
  if (estimateTextBlockHeight(typography) > TEXT_BLOCK_MAX_HEIGHT) {
    issues.push('타이포그래피 블록이 하단 안전영역을 초과합니다.')
  }

  return issues
}

function rebuildHeadlineLines(typography: TypographyPlan): TypographyLine[] {
  const raw = typography.headlineLines
    .map(line => line.tokens.map(token => token.text).join(' '))
    .join(' ')
  const normalized = normalizeHeadline(raw)
  const lines = breakIntoBoundedLines(normalized, HEADLINE_MAX_CHARS, 3)

  return lines.map(line => ({
    tokens: line.split(' ').filter(Boolean).map<TypographyToken>(text => ({
      text,
      style: 'headline-normal',
    })),
    widthEstimate: estimateDisplayWidth(line),
  }))
}

function normalizeHeadline(value: string) {
  return value
    .replace(/\[[^\]]{1,32}\]\s*/g, '')
    .replace(/\([^)]{1,32}\)\s*/g, '')
    .replace(/([가-힣])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([가-힣])/g, '$1 $2')
    .replace(/올여름/g, '올여름 ')
    .replace(/신제품/g, '신제품 ')
    .replace(/라인업/g, '라인업 ')
    .replace(/공개/g, '공개')
    .replace(/특별/g, '특별 ')
    .replace(/혜택/g, '혜택 ')
    .replace(/소장/g, '소장 ')
    .replace(/가치/g, '가치 ')
    .replace(/한정/g, '한정 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function breakIntoBoundedLines(value: string, maxWidth: number, maxLines: number) {
  const words = value.split(' ').filter(Boolean).flatMap(word => splitOversizedWord(word, maxWidth))
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && estimateDisplayWidth(next) > maxWidth && lines.length < maxLines - 1) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)

  if (lines.length > maxLines) {
    const visible = lines.slice(0, maxLines)
    visible[maxLines - 1] = visible[maxLines - 1].replace(/[,.!?…\s]+$/, '')
    return visible
  }

  return lines.length ? lines : [value]
}

function splitOversizedWord(word: string, maxWidth: number) {
  if (estimateDisplayWidth(word) <= maxWidth) return [word]

  const parts: string[] = []
  let current = ''
  for (const char of Array.from(word)) {
    const next = `${current}${char}`
    if (current && estimateDisplayWidth(next) > maxWidth) {
      parts.push(current)
      current = char
    } else {
      current = next
    }
  }
  if (current) parts.push(current)
  return parts
}

function fitHeadlineFontSize(lineCount: number) {
  if (lineCount >= 3) return 54
  if (lineCount === 2) return 60
  return 66
}

function estimateDisplayWidth(value: string) {
  return Array.from(value).reduce((total, char) => {
    if (char === ' ') return total + 0.35
    const code = char.charCodeAt(0)
    return total + (code >= 0xac00 && code <= 0xd7a3 ? 1 : 0.58)
  }, 0)
}

function estimateTextBlockHeight(typography: TypographyPlan) {
  const headlineHeight = typography.headlineLines.length * typography.headlineFontSize * typography.lineHeight
  const bodyHeight = typography.bodyLines.length * typography.bodyFontSize * 1.34
  return 42 + headlineHeight + 24 + bodyHeight
}
