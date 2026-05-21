import type { BrandProfile, CampaignInput, CarouselStructure, HookCandidate, SlideCopy } from './types'

const BANNED_CLICHES = ['혁신적인', '최고의', '완벽한']

export async function generateSlideCopies(
  brand: BrandProfile,
  input: CampaignInput,
  structure: CarouselStructure,
  selectedHook: HookCandidate
): Promise<SlideCopy[]> {
  const benefit = firstBenefit(input.keyBenefits)

  return structure.slides.map((slide): SlideCopy => {
    if (slide.role === 'hook') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: selectedHook.text,
        body: '비슷해 보여도 차이는 여기서 납니다',
      })
    }

    if (slide.role === 'problem') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '고민은 여기서 시작',
        body: `${input.productName} 고를 때 놓치기 쉬운 기준을 짚어볼게요.`,
      })
    }

    if (slide.role === 'cause') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '헷갈리는 이유',
        body: '상세 설명보다 실제 사용 장면이 더 중요하기 때문입니다.',
      })
    }

    if (slide.role === 'common_mistake') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '이 실수는 피하세요',
        body: '가격만 보고 고르면 필요한 기능을 놓치기 쉽습니다.',
      })
    }

    if (slide.role === 'product_solution') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: `${input.productName}의 기준`,
        body: `${benefit}에 집중해 일상에서 바로 쓰기 쉽게 만들었습니다.`,
      })
    }

    if (slide.role === 'feature' || slide.role === 'feature_1') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '첫 번째 포인트',
        body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.`,
      })
    }

    if (slide.role === 'feature_2') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '두 번째 포인트',
        body: '복잡한 준비 없이 바로 쓰기 좋은 구성이 강점입니다.',
      })
    }

    if (slide.role === 'proof' || slide.role === 'benefit_or_proof') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '후기가 말해줍니다',
        body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.',
      })
    }

    if (slide.role === 'offer') {
      return cleanCopy(brand, {
        slideNumber: slide.slideNumber,
        headline: '지금 확인해보세요',
        body: '필요한 옵션과 구성은 상세페이지에서 바로 볼 수 있습니다.',
      })
    }

    return cleanCopy(brand, {
      slideNumber: slide.slideNumber,
      headline: '저장하고 비교하세요',
      body: `${brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.'}`,
      ctaText: brand.ctaStyle || '자세히 보기',
    })
  })
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
