import type { LayoutDefinition } from './layoutTypes'
import { generateOverlay, type OverlayPlan } from './overlayEngine'
import type { TypographyPlan } from './typographyEngine'

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
]

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
  return {
    ...typography,
    headlineLines: typography.headlineLines.slice(0, 3),
    bodyLines: typography.bodyLines.slice(0, 2),
    headlineFontSize: Math.min(Math.max(typography.headlineFontSize, 52), 68),
    bodyFontSize: Math.min(Math.max(typography.bodyFontSize, 23), 27),
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

  return issues
}
