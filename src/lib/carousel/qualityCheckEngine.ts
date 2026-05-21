import type { BrandProfile, CampaignInput, CaptionResult, GeneratedSlide, QualityCheckResult } from './types'

const EXAGGERATED = ['혁신적인', '최고의', '완벽한', '100% 보장', '무조건']

export async function runQualityCheck(params: {
  brand: BrandProfile
  input: CampaignInput
  slides: GeneratedSlide[]
  caption: CaptionResult
}): Promise<QualityCheckResult> {
  const issues: string[] = []
  const suggestions: string[] = []
  const forbiddenWords = params.brand.forbiddenWords.split(',').map(word => word.trim()).filter(Boolean)

  if (params.slides.length !== params.input.slideCount) {
    issues.push(`슬라이드 수가 요청값과 다릅니다. expected=${params.input.slideCount}, actual=${params.slides.length}`)
  }

  for (const slide of params.slides) {
    if (slide.headline.length > 20) issues.push(`${slide.slideNumber}번 headline이 20자를 초과했습니다.`)
    if (slide.body.length > 60) issues.push(`${slide.slideNumber}번 body가 60자를 초과했습니다.`)
    if (!slide.backgroundImageUrl) issues.push(`${slide.slideNumber}번 배경 이미지 URL이 비어 있습니다.`)
    if (!slide.finalImageUrl) issues.push(`${slide.slideNumber}번 최종 이미지 URL이 비어 있습니다.`)

    const text = `${slide.headline} ${slide.body}`
    for (const word of forbiddenWords) {
      if (word && text.includes(word)) issues.push(`${slide.slideNumber}번 슬라이드에 금지어 "${word}"가 포함되었습니다.`)
    }
    for (const word of EXAGGERATED) {
      if (text.includes(word)) issues.push(`${slide.slideNumber}번 슬라이드에 과장 표현 "${word}"가 포함되었습니다.`)
    }
  }

  if (params.caption.hashtags.length < 8 || params.caption.hashtags.length > 15) {
    issues.push('해시태그는 8~15개여야 합니다.')
  }

  const lastSlide = params.slides[params.slides.length - 1]
  if (!lastSlide || !/저장|확인|문의|구매|보기|링크/.test(`${lastSlide.headline} ${lastSlide.body}`)) {
    issues.push('마지막 슬라이드에 CTA가 명확하지 않습니다.')
  }

  if (issues.length > 0) {
    suggestions.push('needs_review 상태로 저장하고 운영자가 문구와 이미지 URL을 확인하세요.')
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  }
}
