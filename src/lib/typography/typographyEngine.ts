import type { LayoutDefinition } from '../layout/layoutTypes'
import { breakKoreanLines } from './lineBreakEngine'
import { detectEmphasis } from './emphasisEngine'

export interface TypographyToken {
  text: string
  style: 'headline-emphasis' | 'headline-normal' | 'body' | 'category' | 'source'
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
  readabilityScore: number // 100점 만점
  readabilityWarnings: string[]
}

export interface TypographyInput {
  headline: string
  body: string
  category: string
  layout: LayoutDefinition
  emphasisWords?: string[]
  brandMainColor?: string
}

export function planTypography(input: TypographyInput): TypographyPlan {
  // 1. 강조 단어 식별
  const detectedTokens = detectEmphasis(input.headline, input.emphasisWords)
  const emphasisWords = detectedTokens
    .filter(t => t.isEmphasis)
    .map(t => t.text)

  // 2. 가로폭 글자수 기준값 획득
  const maxHeadlineChars = getHeadlineLineChars(input.layout)
  const maxBodyChars = getBodyLineChars(input.layout)

  // 3. 지능형 한국어 줄바꿈 적용
  const rawHeadlineLines = breakKoreanLines(input.headline, maxHeadlineChars, 3)
  const bodyLines = breakKoreanLines(input.body, maxBodyChars, 4)

  // 4. 헤드라인 라인별 토큰 매핑
  const headlineLines: TypographyLine[] = rawHeadlineLines.map(lineText => {
    const lineWords = lineText.split(' ')
    const tokens: TypographyToken[] = lineWords.map(word => {
      // 해당 단어가 강조 대상인지 검출
      const isEmp = detectedTokens.some(dt => dt.text === word && dt.isEmphasis)
      return {
        text: word,
        style: isEmp ? 'headline-emphasis' : 'headline-normal',
      }
    })
    return {
      tokens,
      widthEstimate: lineText.length,
    }
  })

  // 5. 동적 폰트 크기 계산 (줄수가 길어질수록 폰트 크기 완화)
  const headlineFontSize = getHeadlineFontSize(input.layout, headlineLines.length)
  const bodyFontSize = getBodyFontSize(input.layout)
  const lineHeight = input.layout.spacingRules?.headlineLineGap || 1.10

  // 6. 모바일 가독성 분석 (Readability Validation)
  const { score, warnings } = validateMobileReadability(
    input.headline,
    input.body,
    headlineFontSize,
    headlineLines.length
  )

  const headlineTokens: TypographyToken[] = detectedTokens.map(t => ({
    text: t.text,
    style: t.isEmphasis ? 'headline-emphasis' : 'headline-normal',
  }))

  return {
    headlineTokens,
    headlineLines,
    bodyLines,
    emphasisWords,
    headlineFontSize,
    bodyFontSize,
    lineHeight,
    maxLineCount: 3,
    textAlign: input.layout.textPosition.includes('center') ? 'center' : 'left',
    emphasisColor: input.brandMainColor || getEmphasisColor(input.layout.preferredColorPalette),
    readabilityScore: score,
    readabilityWarnings: warnings,
  }
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
    ? 86
    : layout.typographyStyle === 'quote-large'
      ? 72
      : layout.typographyStyle === 'clean-sans'
        ? 62
        : 68

  // 라인이 많아질수록 폰트 스케일을 서서히 줄여서 오버플로우 방지
  return Math.max(48, base - Math.max(0, lineCount - 2) * 7)
}

function getBodyFontSize(layout: LayoutDefinition) {
  return layout.typographyStyle === 'clean-sans' ? 29 : 27
}

function getEmphasisColor(palette: string[]) {
  if (palette.includes('red')) return '#ff3b30'
  if (palette.includes('cyan')) return '#00a3ff'
  if (palette.includes('yellow')) return '#ffcc00'
  if (palette.includes('green')) return '#34c759'
  if (palette.includes('blue')) return '#007aff'
  if (palette.includes('orange')) return '#ff9500'
  return '#ff5a00' // 에디토리얼 기본 주황색
}

/**
 * 모바일 디바이스 환경에서의 가독성 스코어링 및 경고 판독
 */
function validateMobileReadability(
  headline: string,
  body: string,
  fontSize: number,
  lineCount: number
): { score: number; warnings: string[] } {
  let score = 100
  const warnings: string[] = []

  if (fontSize < 55) {
    score -= 15
    warnings.push('헤드라인 크기가 모바일 표준(55px) 미만으로 줄어들었습니다. 제목 텍스트 축소를 고려하세요.')
  }

  if (lineCount > 3) {
    score -= 20
    warnings.push('헤드라인이 3줄을 초과하여 복잡해졌습니다. 가독성을 해칠 수 있습니다.')
  }

  if (headline.length > 30) {
    score -= 10
    warnings.push('헤드라인 전체 자수가 너무 깁니다. 모바일 탐색 피드에서 시선을 끌기 어렵습니다.')
  }

  if (body.length > 90) {
    score -= 15
    warnings.push('본문 카피라인이 권장 수준(90자)을 초과하여 텍스트 밀도가 너무 높습니다.')
  }

  return {
    score: Math.max(0, score),
    warnings,
  }
}
