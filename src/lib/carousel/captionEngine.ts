import { getLLMClient } from '../ai/llmClient'
import type { BrandProfile, CampaignInput, CaptionResult, ContentStrategy, HookCandidate } from './types'

export async function generateCaption(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy,
  selectedHook: HookCandidate
): Promise<CaptionResult> {
  const client = getLLMClient()

  const prompt = `한국 인스타그램 카드뉴스 게시글의 캡션과 해시태그를 작성해주세요.

브랜드: ${brand.name} (${brand.industry})
타겟 고객: ${brand.targetAudience}
어조: ${brand.toneOfVoice}
상품명: ${input.productName}
상품 설명: ${input.productDescription}
핵심 혜택: ${input.keyBenefits}
캠페인 목표: ${input.objective}
훅 문구: "${selectedHook.text}"
콘텐츠 전략: ${strategy.angle}

캡션 조건:
- 300자 이내
- 훅 문구로 시작
- ${brand.toneOfVoice} 어조 유지
- 자연스럽게 저장·공유 유도
- CTA: ${brand.ctaStyle || '프로필 링크에서 자세히 보기'}

해시태그 조건:
- 8~15개
- 상품/업종/타겟 관련 구체적 태그 포함
- 너무 광범위한 일반 태그 지양
- '#' 포함하여 반환

최적 게시 시간: 인스타그램 알고리즘 기준 한국 시간대 추천

JSON 응답 형식:
{
  "caption": "...",
  "hashtags": ["#태그1", "#태그2", ...],
  "recommendedPostTime": "오늘 오후 8시"
}`

  const result = await client.generateJson<CaptionResult>(
    'caption generation',
    prompt,
    () => buildFallbackCaption(brand, input, strategy, selectedHook)
  )

  const hashtags = result.hashtags
    .map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
    .filter(tag => tag.length > 1)
    .slice(0, 15)

  if (hashtags.length < 8) {
    hashtags.push(...buildFallbackHashtags(brand, input).slice(0, 8 - hashtags.length))
  }

  return {
    caption: result.caption || buildFallbackCaption(brand, input, strategy, selectedHook).caption,
    hashtags,
    recommendedPostTime: result.recommendedPostTime || '오늘 오후 8시',
  }
}

function buildFallbackCaption(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy,
  selectedHook: HookCandidate
): CaptionResult {
  const caption = [
    selectedHook.text,
    '',
    `${input.productName}을 고르기 전에 확인하면 좋은 포인트를 정리했어요.`,
    `이번 카드뉴스는 ${strategy.angle} 흐름으로 구성했습니다.`,
    '',
    '나중에 비교할 수 있게 저장해두고, 필요한 옵션은 상세페이지에서 확인해보세요.',
    brand.ctaStyle || '프로필 링크에서 자세히 보기',
  ].join('\n')

  return {
    caption,
    hashtags: buildFallbackHashtags(brand, input),
    recommendedPostTime: '오늘 오후 8시',
  }
}

function buildFallbackHashtags(brand: BrandProfile, input: CampaignInput): string[] {
  const base = [
    '#스마트스토어',
    '#신상품',
    '#생활꿀템',
    '#구매전필독',
    '#상품추천',
    '#인스타카드뉴스',
    '#온라인쇼핑',
    '#쇼핑팁',
  ]

  const industry = brand.industry.replace(/\s+/g, '')
  const product = input.productName.replace(/\s+/g, '')
  const extra = [industry && `#${industry}`, product && `#${product}`].filter(Boolean) as string[]

  return [...new Set([...base, ...extra])].slice(0, 15)
}
