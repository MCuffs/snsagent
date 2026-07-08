import { getLLMClient } from '../ai/llmClient'
import { parseBrandDna } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, ContentStrategy, HookCandidate, HookType } from './types'
import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import { buildHookPromptSection, rankHooksByPattern } from '../copywriting/hookPatternEngine'

const FALLBACK_HOOKS: { text: string; type: HookType; baseScore: number }[] = [
  { text: '사기 전에 꼭 보세요', type: 'curiosity', baseScore: 92 },
  { text: '왜 이제 알았지?', type: 'curiosity', baseScore: 85 },
  { text: '이거 하나로 정리 끝', type: 'benefit', baseScore: 88 },
  { text: '후기 좋은 이유 있음', type: 'social_proof', baseScore: 84 },
  { text: '비슷해도 다릅니다', type: 'comparison', baseScore: 82 },
]

export async function generateHooks(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy,
  knowledgeCtx?: CopyKnowledgeContext
): Promise<HookCandidate[]> {
  const client = getLLMClient()
  const dna = parseBrandDna(brand.brandDna)

  const painSection = dna.customerPainPoints.length
    ? `\n고객 페인포인트 (pain_point 훅 작성 시 이 중에서 골라 구체화하세요):\n${dna.customerPainPoints.map(p => `- ${p}`).join('\n')}\n`
    : ''
  const diffSection = dna.differentiators.length
    ? `\n브랜드 차별점 (comparison/benefit 훅 작성 시 반영하세요):\n${dna.differentiators.map(d => `- ${d}`).join('\n')}\n`
    : ''

  const hookPatternSection = knowledgeCtx
    ? `\n${buildHookPromptSection(knowledgeCtx)}\n`
    : ''

  const hasRssContext = input.productDescription.includes('[실시간 뉴스 컨텍스트') || input.productDescription.includes('[Real-Time News Context')
  const rssSection = hasRssContext
    ? `\n[실시간 뉴스 컨텍스트 활용 지시]\n위 상품 설명에 포함된 최신 뉴스 기사들의 키워드·이슈·트렌드를 훅에 반드시 반영하세요.\n실제 사람들이 지금 관심 갖는 이슈로 훅을 만들어야 스크롤을 멈춥니다.\n\n`
    : ''

  const prompt = `한국 인스타그램 카드뉴스 첫 슬라이드에 사용할 훅 문구를 5개 생성해주세요.
${rssSection}
브랜드: ${brand.name} (${brand.industry})
타겟 고객: ${brand.targetAudience}
상품명: ${input.productName}
상품 설명: ${input.productDescription.slice(0, 2000)}
핵심 혜택: ${input.keyBenefits}
캠페인 목표: ${input.objective}
콘텐츠 전략: ${strategy.strategyType} — ${strategy.angle}
${painSection}${diffSection}${hookPatternSection}
훅 조건:
- 반드시 25자 이하 (공백 포함)
- 스크롤을 멈추게 하는 강렬한 첫 문장
- 타겟 고객의 공감 또는 호기심 자극
- 과장·클리셰 금지
- pain_point 훅은 반드시 위의 고객 페인포인트 중 하나를 구체적으로 반영하세요
- comparison/benefit 훅은 위의 브랜드 차별점을 토대로 작성하세요

유형(type):
- curiosity: 궁금증 유발 ("왜?", "몰랐던")
- pain_point: 불편·고통 공감
- benefit: 구체적 혜택 제시
- urgency: 시급성·기회
- comparison: 비교 차별화
- social_proof: 사용자 증거

JSON 응답 형식:
{
  "hooks": [
    { "text": "...", "type": "curiosity", "score": 85, "reason": "이 문구가 효과적인 이유 한 줄" },
    { "text": "...", "type": "pain_point", "score": 82, "reason": "..." }
  ]
}`

  // usedFallback marks hooks from the canned list so the pipeline can flag degraded output.
  const result = await client.generateJson<{ hooks: HookCandidate[] }>(
    'hook generation',
    prompt,
    () => ({
      hooks: FALLBACK_HOOKS.map((hook, index) => ({
        text: hook.text,
        type: hook.type,
        score: hook.baseScore + scoreBoost(hook.type, strategy.strategyType) - index,
        reason: `${brand.targetAudience}에게 ${input.productName} 구매 전 확인할 이유를 짧게 제시합니다.`,
        usedFallback: true,
      })),
    })
  )

  const generatedHooks = Array.isArray(result?.hooks) ? result.hooks : []

  const trimmed = generatedHooks.map(hook => ({ ...hook, text: fitTwentyChars(hook.text) }))

  // Use knowledge-aware ranking if context is available, otherwise fall back to score sort
  if (knowledgeCtx) {
    return rankHooksByPattern(trimmed, knowledgeCtx)
  }
  return trimmed.sort((a, b) => b.score - a.score)
}

export function selectBestHook(hooks: HookCandidate[]): HookCandidate {
  if (hooks.length === 0) {
    return {
      text: '사기 전에 꼭 보세요',
      type: 'curiosity',
      score: 80,
      reason: '기본 구매 전환형 Hook입니다.',
    }
  }
  return [...hooks].sort((a, b) => b.score - a.score)[0]
}

function scoreBoost(hookType: HookType, strategyType: ContentStrategy['strategyType']) {
  if (strategyType === 'comparison' && hookType === 'comparison') return 8
  if (strategyType === 'review_style' && hookType === 'social_proof') return 8
  if (strategyType === 'benefit_focused' && hookType === 'benefit') return 8
  return 0
}

function fitTwentyChars(text: string) {
  return text.length > 25 ? text.slice(0, 25) : text
}

