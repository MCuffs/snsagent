import type { BrandProfile, CampaignInput, CaptionResult, ContentStrategy, HookCandidate } from './types'

export async function generateCaption(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy,
  selectedHook: HookCandidate
): Promise<CaptionResult> {
  const caption = [
    `${selectedHook.text}`,
    '',
    `${input.productName}을 고르기 전에 확인하면 좋은 포인트를 정리했어요.`,
    `이번 카드뉴스는 ${strategy.angle} 흐름으로 구성했습니다.`,
    '',
    '나중에 비교할 수 있게 저장해두고, 필요한 옵션은 상세페이지에서 확인해보세요.',
    brand.ctaStyle || '프로필 링크에서 자세히 보기',
  ].join('\n')

  return {
    caption,
    hashtags: buildHashtags(brand, input),
    recommendedPostTime: '오늘 오후 8시',
  }
}

function buildHashtags(brand: BrandProfile, input: CampaignInput) {
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
