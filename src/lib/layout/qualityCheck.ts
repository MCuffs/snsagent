import type { LayoutDefinition } from './layoutTypes'
import type { TypographyPlan } from './typographyEngine'
import { isPromptAllowed } from '../ai/imageProvider'

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
  designPrompt?: string
  harnessDiagnostics?: {
    score: number
    issues: string[]
    rules: string[]
  }
}) {
  const issues: string[] = []
  const suggestions: string[] = []

  if (params.designPrompt && !isPromptAllowed(params.designPrompt)) {
    issues.push('배경 이미지 프롬프트에 비-부정형 텍스트 유도 키워드가 포함되어 있습니다.')
    suggestions.push('프롬프트에서 제목, 본문 내용 또는 "text", "headline", "title" 등 텍스트 생성 유도 단어를 제외하고, "no text"와 같은 부정 지시어 컨텍스트만 사용하세요.')
  }

  if (!params.backgroundImageUrl) {
    issues.push('배경 이미지 URL이 없습니다.')
    suggestions.push('이미지 provider fallback을 확인하세요.')
  }

  if (params.harnessDiagnostics) {
    if (params.harnessDiagnostics.score < 90) {
      issues.push(`카드뉴스 하네스 점수가 낮습니다 (${params.harnessDiagnostics.score}점).`)
    }
    suggestions.push(...params.harnessDiagnostics.issues)
  }

  // 1. 가독성 경고 병합
  if (params.typography.readabilityScore < 85) {
    issues.push(`모바일 가독성 점수가 낮습니다 (${params.typography.readabilityScore}점).`)
  }
  
  params.typography.readabilityWarnings.forEach(warning => {
    suggestions.push(warning)
  })

  // 2. 텍스트 길이 및 라인 제한 체크
  if (params.headline.length > params.layout.recommendedHeadlineLength * 1.8) {
    issues.push('헤드라인 글자 수가 레이아웃 권장 한도를 크게 초과합니다.')
    suggestions.push('헤드라인을 직관적이고 짧은 2줄 이내의 문구로 요약하세요.')
  }

  if (params.body.length > params.layout.recommendedBodyLength * 1.8) {
    issues.push('본문 카피라인이 너무 길어 화면을 채우고 모바일 시인성을 해칩니다.')
    suggestions.push('본문은 1~2줄의 에디토리얼 핵심 요약문으로 압축하세요.')
  }

  if (params.typography.headlineLines.length > params.typography.maxLineCount) {
    issues.push('헤드라인 줄 수가 3줄 한도를 초과하여 오버플로우되었습니다.')
    suggestions.push('단어 배치를 조정하거나 글자 수를 줄여 3줄 이내로 만드세요.')
  }

  // 3. 종횡/세로 Safe Area 충돌(오버플로우) 진단
  const safeWidth = 1080 - params.layout.safeArea.left - params.layout.safeArea.right
  if (safeWidth < 700) {
    issues.push('타이포그래피 Safe Area 가로폭이 극도로 좁아 단어 단위 개행이 심하게 일어납니다.')
    suggestions.push('좌우 여백을 줄이거나 텍스트 위치를 bottom-center 또는 center로 변경하세요.')
  }

  // 세로 영역 계산
  const badgeToHeadlineGap = params.layout.spacingRules?.badgeToHeadlineGap || 24
  const headlineToBodyGap = params.layout.spacingRules?.headlineToBodyGap || 38
  const headlineLineGap = params.layout.spacingRules?.headlineLineGap || 1.10
  const bodyLineGap = params.layout.spacingRules?.bodyLineGap || 1.42

  const categoryHeight = 28
  const headlineHeight = params.typography.headlineLines.length * params.typography.headlineFontSize * headlineLineGap
  const bodyHeight = params.typography.bodyLines.length * params.typography.bodyFontSize * bodyLineGap
  
  const totalTextHeight = categoryHeight + badgeToHeadlineGap + headlineHeight + headlineToBodyGap + bodyHeight
  const safeHeight = 1350 - params.layout.safeArea.top - params.layout.safeArea.bottom

  if (totalTextHeight > safeHeight) {
    issues.push(`타이포그래피 세로 높이(${Math.round(totalTextHeight)}px)가 Safe Area 높이(${safeHeight}px)를 초과하여 오버플로우 위험이 있습니다.`)
    suggestions.push('본문 문장 길이를 축소하거나 줄바꿈 개수를 줄이십시오.')
  }

  // 4. AI 생성 이미지 가이드라인 및 워터마크 혼입 위험 자가 진단
  if (params.backgroundImageUrl.includes('dall-e') || params.backgroundImageUrl.includes('openai')) {
    // dall-e에서 텍스트가 섞여 나왔을 가능성이 있으므로 알림 권장
    suggestions.push('AI 배경 이미지 생성 시 글자가 섞여 생성되었는지 최종 시각 검수를 권장합니다.')
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  } satisfies MediaCardQualityResult
}
