import type { BrandProfile, CampaignInput, ContentStrategy, StrategyType } from './types'

export async function generateStrategy(
  brand: BrandProfile,
  input: CampaignInput
): Promise<ContentStrategy> {
  const text = `${brand.industry} ${input.objective} ${input.productDescription}`.toLowerCase()
  let strategyType: StrategyType = 'problem_solution'

  if (text.includes('비교') || text.includes('차이')) strategyType = 'comparison'
  else if (text.includes('후기') || text.includes('리뷰')) strategyType = 'review_style'
  else if (text.includes('체크') || text.includes('방법')) strategyType = 'checklist'
  else if (text.includes('할인') || text.includes('특가')) strategyType = 'discount'
  else if (text.includes('시즌') || text.includes('여름') || text.includes('겨울')) strategyType = 'seasonal'
  else if (text.includes('브랜드') || text.includes('스토리')) strategyType = 'storytelling'
  else if (text.includes('혜택') || text.includes('장점')) strategyType = 'benefit_focused'

  const recommendedSlideCount = Math.min(Math.max(input.slideCount || 5, 5), 10)

  return {
    strategyType,
    targetEmotion: strategyType === 'discount' ? '기회와 긴급성' : '공감과 필요성',
    contentGoal: input.objective || '저장 및 구매 전환',
    angle: getAngle(strategyType, input.productName),
    recommendedSlideCount,
    reason: `${brand.industry} 맥락에서는 첫 장에서 관심을 붙잡고, 문제 인식부터 CTA까지 단계적으로 설득하는 흐름이 효과적입니다.`,
  }
}

function getAngle(strategyType: StrategyType, productName: string) {
  const name = productName || '상품'
  const map: Record<StrategyType, string> = {
    problem_solution: `고객이 겪는 문제를 먼저 보여주고 ${name}을 해결책으로 제시`,
    benefit_focused: `${name}의 핵심 혜택을 짧고 구체적으로 반복 노출`,
    comparison: `비슷한 선택지와 ${name}의 차이를 비교해 구매 판단을 도움`,
    review_style: `사용자가 남길 법한 후기를 중심으로 신뢰감 형성`,
    checklist: `구매 전 확인할 체크리스트로 저장 가치를 높임`,
    seasonal: `시즌 상황과 ${name}의 사용 장면을 연결`,
    discount: `혜택과 마감감을 과장 없이 제시해 즉시 행동 유도`,
    storytelling: `브랜드 문제의식과 상품 탄생 맥락을 짧게 전달`,
  }
  return map[strategyType]
}
