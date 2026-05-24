import { getLLMClient } from '../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, CarouselStructure, HookCandidate, SlideRole, SlideCopy } from './types'

const BANNED_CLICHES = ['혁신적인', '최고의', '완벽한']

export async function generateSlideCopies(
  brand: BrandProfile,
  input: CampaignInput,
  structure: CarouselStructure,
  selectedHook: HookCandidate
): Promise<SlideCopy[]> {
  const client = getLLMClient()

  const slideDescriptions = structure.slides
    .map(s => `슬라이드 ${s.slideNumber} [${s.role}]: ${s.purpose}`)
    .join('\n')

  const brandDnaSection = brand.brandDna
    ? `\n브랜드 DNA (반드시 카피에 반영할 핵심 인사이트):\n${formatBrandDnaForPrompt(brand.brandDna)}\n`
    : ''

  const prompt = `한국 인스타그램 카드뉴스 카피를 작성해주세요.

브랜드 정보:
- 브랜드명: ${brand.name}
- 업종: ${brand.industry}
- 타겟 고객: ${brand.targetAudience}
- 어조: ${brand.toneOfVoice}
- 금지어: ${brand.forbiddenWords || '없음'}
${brandDnaSection}
상품 정보:
- 상품명: ${input.productName}
- 상품 설명: ${input.productDescription}
- 핵심 혜택: ${input.keyBenefits}
- 캠페인 목표: ${input.objective}

첫 번째 슬라이드 훅 문구: "${selectedHook.text}"

슬라이드 구성:
${slideDescriptions}

규칙:
- headline: 반드시 20자 이하, 강렬하고 구체적으로 (공백 포함)
- body: 반드시 60자 이하, 핵심 메시지 전달 (공백 포함)
- ctaText: 마지막 슬라이드(cta 역할)에만 작성, 15자 이하. 나머지는 null
- 금지어와 과장 표현(혁신적인, 최고의, 완벽한) 사용 금지
- 슬라이드 역할(role)에 맞는 내용으로 작성
- hook 슬라이드의 headline은 반드시 "${selectedHook.text}" 그대로 사용
- 브랜드 DNA가 제공된 경우, 핵심 상품·차별점·고객 페인포인트·가치 제안 중 하나 이상이 슬라이드 카피에 반드시 녹아들어야 합니다
- 일반적인 업종 표현 대신 브랜드 고유의 언어와 키워드를 사용하세요

JSON 응답 형식:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "...", "ctaText": null },
    { "slideNumber": 2, "headline": "...", "body": "...", "ctaText": null }
  ]
}`

  const result = await client.generateJson<{ slides: SlideCopy[] }>(
    'slide copy generation',
    prompt,
    () => ({
      slides: structure.slides.map(slide =>
        generateFallbackCopy(brand, input, slide.slideNumber, slide.role, selectedHook)
      ),
    })
  )

  const slidesMap = new Map(result.slides.map(s => [s.slideNumber, s]))

  return structure.slides
    .map(slide => {
      const copy = slidesMap.get(slide.slideNumber) ?? generateFallbackCopy(brand, input, slide.slideNumber, slide.role, selectedHook)
      return cleanCopy(brand, copy)
    })
}

function generateFallbackCopy(
  brand: BrandProfile,
  input: CampaignInput,
  slideNumber: number,
  role: SlideRole,
  selectedHook: HookCandidate
): SlideCopy {
  const benefit = firstBenefit(input.keyBenefits)

  const copyMap: Record<SlideRole, SlideCopy> = {
    hook: { slideNumber, headline: selectedHook.text, body: '비슷해 보여도 차이는 여기서 납니다' },
    problem: { slideNumber, headline: '고민은 여기서 시작', body: `${input.productName} 고를 때 놓치기 쉬운 기준을 짚어볼게요.` },
    cause: { slideNumber, headline: '헷갈리는 이유', body: '상세 설명보다 실제 사용 장면이 더 중요하기 때문입니다.' },
    common_mistake: { slideNumber, headline: '이 실수는 피하세요', body: '가격만 보고 고르면 필요한 기능을 놓치기 쉽습니다.' },
    product_solution: { slideNumber, headline: `${input.productName}의 기준`, body: `${benefit}에 집중해 일상에서 바로 쓰기 쉽게 만들었습니다.` },
    feature: { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_1: { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_2: { slideNumber, headline: '두 번째 포인트', body: '복잡한 준비 없이 바로 쓰기 좋은 구성이 강점입니다.' },
    benefit_or_proof: { slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    proof: { slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    offer: { slideNumber, headline: '지금 확인해보세요', body: '필요한 옵션과 구성은 상세페이지에서 바로 볼 수 있습니다.' },
    cta: { slideNumber, headline: '저장하고 비교하세요', body: brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.', ctaText: brand.ctaStyle || '자세히 보기' },
  }

  return copyMap[role] ?? { slideNumber, headline: '저장하고 비교하세요', body: brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.' }
}

function firstBenefit(keyBenefits: string) {
  return keyBenefits.split(',').map(item => item.trim()).filter(Boolean)[0] || '필요한 기능'
}

function cleanCopy(brand: BrandProfile, copy: SlideCopy): SlideCopy {
  const forbiddenWords = brand.forbiddenWords
    .split(',')
    .map(word => word.trim())
    .filter(Boolean)

  const clean = (text: string, limit: number) => {
    let result = text
    for (const word of [...forbiddenWords, ...BANNED_CLICHES]) {
      result = result.replaceAll(word, '')
    }
    return result.trim().slice(0, limit)
  }

  return {
    ...copy,
    headline: clean(copy.headline, 20),
    body: clean(copy.body, 60),
    ctaText: copy.ctaText ? clean(copy.ctaText, 30) : undefined,
  }
}
