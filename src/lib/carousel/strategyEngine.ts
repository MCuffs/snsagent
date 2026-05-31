import { getLLMClient, getTextGenerationModel } from '../ai/llmClient'
import { parseBrandDna, formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, ContentStrategy, StrategyType } from './types'

export async function generateStrategy(
  brand: BrandProfile,
  input: CampaignInput
): Promise<ContentStrategy> {
  const client = getLLMClient()
  const dna = parseBrandDna(brand.brandDna)
  const recommendedSlideCount = Math.min(Math.max(input.slideCount || 5, 5), 10)

  const dnaSection = brand.brandDna
    ? `\n브랜드 DNA:\n${formatBrandDnaForPrompt(brand.brandDna)}\n`
    : ''

  const prompt = `한국 인스타그램 카드뉴스의 콘텐츠 전략 유형을 선택해주세요.

브랜드: ${brand.name} (${brand.industry})
타겟 고객: ${brand.targetAudience}
어조: ${brand.toneOfVoice}
상품명: ${input.productName}
상품 설명: ${input.productDescription}
핵심 혜택: ${input.keyBenefits}
캠페인 목표: ${input.objective}
${dnaSection}
사용 가능한 전략 유형 (하나 선택):
- problem_solution: 고객이 겪는 문제를 먼저 공감시키고 상품을 해결책으로 제시
- benefit_focused: 핵심 혜택을 짧고 구체적으로 반복 노출해 구매 욕구 형성
- comparison: 비슷한 선택지와 상품의 차이를 비교해 판단 근거를 제시
- review_style: 실제 사용자가 남길 법한 후기 중심으로 신뢰감 형성
- checklist: 구매 전 확인할 체크리스트로 저장 가치를 높임
- seasonal: 시즌·상황과 상품 사용 장면을 자연스럽게 연결
- discount: 혜택과 마감감을 과장 없이 제시해 즉시 행동 유도
- storytelling: 브랜드 문제의식과 상품 탄생 맥락을 감성적으로 전달

전략 선택 기준:
- 캠페인 목표와 타겟 고객의 구매 심리에 가장 잘 맞는 유형 선택
- 브랜드 DNA가 있으면 차별점과 고객 페인포인트를 최우선으로 고려
- angle은 상품명과 브랜드 고유 언어를 사용해 한 문장으로 작성 (일반적인 업종 표현 사용 금지)

JSON 응답:
{
  "strategyType": "problem_solution",
  "targetEmotion": "공감과 필요성",
  "angle": "상품명과 브랜드 특성을 반영한 구체적 콘텐츠 방향성 한 문장",
  "reason": "이 전략이 해당 브랜드·상품·목표에 효과적인 이유 한 문장"
}`

  const result = await client.generateJson<{
    strategyType: StrategyType
    targetEmotion: string
    angle: string
    reason: string
  }>(
    'strategy generation',
    prompt,
    () => buildFallbackStrategy(brand, input, dna),
    { model: getTextGenerationModel(), temperature: 0.3 }
  )

  const validTypes = new Set<StrategyType>([
    'problem_solution', 'benefit_focused', 'comparison', 'review_style',
    'checklist', 'seasonal', 'discount', 'storytelling',
  ])

  const strategyType: StrategyType = validTypes.has(result?.strategyType)
    ? result.strategyType
    : buildFallbackStrategy(brand, input, dna).strategyType

  return {
    strategyType,
    targetEmotion: result?.targetEmotion || (strategyType === 'discount' ? '기회와 긴급성' : '공감과 필요성'),
    contentGoal: input.objective || '저장 및 구매 전환',
    angle: result?.angle || buildFallbackStrategy(brand, input, dna).angle,
    recommendedSlideCount,
    reason: result?.reason || buildFallbackStrategy(brand, input, dna).reason,
  }
}

function buildFallbackStrategy(
  brand: BrandProfile,
  input: CampaignInput,
  dna: ReturnType<typeof parseBrandDna>
): ContentStrategy {
  const text = `${brand.industry} ${input.objective} ${input.productDescription}`.toLowerCase()
  const recommendedSlideCount = Math.min(Math.max(input.slideCount || 5, 5), 10)

  let strategyType: StrategyType = 'problem_solution'

  if (dna.differentiators.length >= 2) strategyType = 'comparison'
  else if (dna.customerPainPoints.length >= 2) strategyType = 'problem_solution'
  else if (dna.valueProposition && dna.coreProducts.length > 0) strategyType = 'benefit_focused'
  else if (text.includes('비교') || text.includes('차이')) strategyType = 'comparison'
  else if (text.includes('후기') || text.includes('리뷰')) strategyType = 'review_style'
  else if (text.includes('체크') || text.includes('방법')) strategyType = 'checklist'
  else if (text.includes('할인') || text.includes('특가')) strategyType = 'discount'
  else if (text.includes('시즌') || text.includes('여름') || text.includes('겨울')) strategyType = 'seasonal'
  else if (text.includes('브랜드') || text.includes('스토리')) strategyType = 'storytelling'
  else if (text.includes('혜택') || text.includes('장점')) strategyType = 'benefit_focused'

  if (text.includes('후기') || text.includes('리뷰')) strategyType = 'review_style'
  if (text.includes('할인') || text.includes('특가')) strategyType = 'discount'

  const dnaAngle = dna.differentiators.length
    ? `브랜드 차별점(${dna.differentiators.slice(0, 2).join(', ')})을 중심으로 ${getAngle(strategyType, input.productName)}`
    : dna.valueProposition
      ? `브랜드 가치 제안(${dna.valueProposition.slice(0, 40)})을 토대로 ${getAngle(strategyType, input.productName)}`
      : getAngle(strategyType, input.productName)

  return {
    strategyType,
    targetEmotion: strategyType === 'discount' ? '기회와 긴급성' : '공감과 필요성',
    contentGoal: input.objective || '저장 및 구매 전환',
    angle: dnaAngle,
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
