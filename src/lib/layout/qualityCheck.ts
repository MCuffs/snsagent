import type { LayoutDefinition } from './layoutTypes'
import type { TypographyPlan } from './typographyEngine'

export interface MediaCardQualityResult {
  passed: boolean
  issues: string[]
  suggestions: string[]
}

export function runMediaCardQualityCheck(params: {
  layout: LayoutDefinition
  typography: TypographyPlan
  headline: string
  body: string
  backgroundImageUrl: string
}) {
  const issues: string[] = []
  const suggestions: string[] = []

  if (!params.backgroundImageUrl) {
    issues.push('배경 이미지 URL이 없습니다.')
    suggestions.push('이미지 provider fallback을 확인하세요.')
  }

  if (params.headline.length > params.layout.recommendedHeadlineLength * 1.8) {
    issues.push('헤드라인이 권장 길이를 크게 초과합니다.')
    suggestions.push('헤드라인을 2~3줄 안에서 읽히도록 줄이세요.')
  }

  if (params.body.length > params.layout.recommendedBodyLength * 1.8) {
    issues.push('본문이 카드 내 가독성을 해칠 정도로 깁니다.')
    suggestions.push('본문은 핵심 설명 1~2문장으로 압축하세요.')
  }

  if (params.typography.headlineLines.length > params.typography.maxLineCount) {
    issues.push('헤드라인 줄 수가 제한을 초과했습니다.')
    suggestions.push('핵심 단어 중심으로 제목을 재작성하세요.')
  }

  if (params.typography.headlineFontSize < 56) {
    issues.push('모바일 가독성 기준보다 제목 크기가 작습니다.')
    suggestions.push('제목 길이를 줄이거나 레이아웃을 minimal-clean으로 변경하세요.')
  }

  const safeWidth = 1080 - params.layout.safeArea.left - params.layout.safeArea.right
  if (safeWidth < 720) {
    issues.push('타이포그래피 safe area가 너무 좁습니다.')
    suggestions.push('좌우 safe area를 줄이거나 중앙형 레이아웃을 사용하세요.')
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  } satisfies MediaCardQualityResult
}
