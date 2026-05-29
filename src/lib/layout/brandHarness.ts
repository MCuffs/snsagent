import { parseBrandDna } from '../../../lib/brand-dna'
import type { MediaCardQualityResult } from './qualityCheck'

export interface VisualBrandLanguage {
  materials: string[]
  lightBehavior: string[]
  colorBehavior: string[]
  environmentCues: string[]
  stylingCues: string[]
  avoid: string[]
}

export function translateBrandToVisualLanguage(params: {
  brandIndustry?: string
  brandToneOfVoice?: string
  brandMainColor?: string
  brandDna?: string | null
}): VisualBrandLanguage {
  const dna = parseBrandDna(params.brandDna)
  const signals = [
    params.brandIndustry,
    params.brandToneOfVoice,
    dna.valueProposition,
    dna.visualMood,
    ...dna.brandKeywords,
    ...dna.differentiators,
  ].filter(Boolean).join(' ').toLowerCase()

  const language: VisualBrandLanguage = {
    materials: ['matte, realistically textured surfaces'],
    lightBehavior: ['soft natural window falloff with controlled shadows'],
    colorBehavior: params.brandMainColor
      ? [`use ${params.brandMainColor} only as a restrained object accent or reflected tint`]
      : ['restrained neutral palette with one subtle accent'],
    environmentCues: [],
    stylingCues: ['quiet object spacing and believable everyday styling'],
    avoid: dna.avoidVisuals.map(item => `avoid ${item}`),
  }

  if (/(건강|웰니스|식품|저당|비건|healthy|wellness|natural|organic)/.test(signals)) {
    language.materials.push('uncoated paper, natural food texture, reusable vessel')
    language.lightBehavior.push('clean afternoon daylight without artificial gloss')
    language.environmentCues.push('ordinary workday or home-routine evidence')
  }
  if (/(혁신|기술|스타트업|tech|innovation|modern)/.test(signals)) {
    language.materials.push('matte aluminum and clean glass reflection')
    language.lightBehavior.push('cool daylight with a restrained monitor reflection')
    language.environmentCues.push('organized Seoul startup workspace')
  }
  if (/(프리미엄|고급|luxury|premium|elegant)/.test(signals)) {
    language.materials.push('low-sheen finish and precisely finished edges')
    language.stylingCues.push('luxury expressed through restraint, never gold or excessive gloss')
  }
  if (/(따뜻|감성|친근|warm|friendly|comfort)/.test(signals)) {
    language.materials.push('subtle wood grain and soft fabric texture')
    language.lightBehavior.push('late-afternoon warm window glow')
    language.environmentCues.push('lived-in Korean home or neighborhood space')
  }
  if (dna.coreProducts.length) {
    language.stylingCues.push(`include physical cues of ${dna.coreProducts.slice(0, 2).join(' and ')}`)
  }

  return {
    materials: unique(language.materials).slice(0, 3),
    lightBehavior: unique(language.lightBehavior).slice(0, 2),
    colorBehavior: unique(language.colorBehavior).slice(0, 1),
    environmentCues: unique(language.environmentCues).slice(0, 2),
    stylingCues: unique(language.stylingCues).slice(0, 2),
    avoid: unique(language.avoid).slice(0, 2),
  }
}

export function formatVisualBrandLanguage(language: VisualBrandLanguage) {
  return [
    ...language.materials,
    ...language.lightBehavior,
    ...language.colorBehavior,
    ...language.environmentCues,
    ...language.stylingCues,
    ...language.avoid,
  ].join('; ')
}

export function reinforceSlidesWithBrandDna<T extends { headline: string; body: string; role?: string }>(
  slides: T[],
  brandDna?: string | null
) {
  const dna = parseBrandDna(brandDna)
  const primaryProduct = dna.coreProducts[0]
  const primaryDiff = dna.differentiators[0]
  const value = dna.valueProposition
  const allSignals = [
    ...dna.coreProducts,
    ...dna.differentiators,
    ...dna.brandKeywords.slice(0, 3),
  ].filter(Boolean)

  if (!primaryProduct && !primaryDiff && !value) return slides

  // 슬라이드 전체 브랜드 DNA 커버율 계산
  const coveredCount = slides.filter(slide => {
    const text = `${slide.headline} ${slide.body}`.toLowerCase()
    return allSignals.some(signal => text.includes(signal.toLowerCase()))
  }).length

  const coverageRatio = slides.length > 0 ? coveredCount / slides.length : 1

  return slides.map((slide, index) => {
    const text = `${slide.headline} ${slide.body}`
    const hasBrandSignal = allSignals
      .some(signal => signal && text.toLowerCase().includes(signal.toLowerCase()))

    // 이미 브랜드 신호가 있으면 그대로 유지
    if (hasBrandSignal) return slide

    // 커버율이 50% 이상이면 나머지 슬라이드는 가볍게 보강
    const isLightMode = coverageRatio >= 0.5

    if (index === 0 && value) {
      const appendText = isLightMode ? value.slice(0, 30) : value
      return { ...slide, body: compactBody(`${slide.body} ${appendText}`) }
    }
    if (slide.role === 'summary' && primaryDiff) {
      return { ...slide, body: compactBody(`${slide.body} ${primaryDiff}`) }
    }
    if (slide.role === 'key-point' && primaryProduct && !isLightMode) {
      return { ...slide, body: compactBody(`${slide.body} ${primaryProduct} 기준으로 정리했습니다.`) }
    }
    if (primaryDiff && !isLightMode) {
      return { ...slide, body: compactBody(`${slide.body} ${primaryDiff}`) }
    }
    return slide
  })
}

export function checkBrandFit(params: {
  headline: string
  body: string
  designPrompt: string
  brandDna?: string | null
  qualityCheck: MediaCardQualityResult
}): MediaCardQualityResult {
  const dna = parseBrandDna(params.brandDna)
  const needles = [
    ...dna.coreProducts,
    ...dna.differentiators,
    ...dna.brandKeywords,
    dna.valueProposition,
    dna.visualMood,
  ].filter(Boolean)

  if (needles.length === 0) return params.qualityCheck

  const haystack = `${params.headline} ${params.body} ${params.designPrompt}`.toLowerCase()
  const matched = needles.filter(item => haystack.includes(item.toLowerCase()))
  const score = Math.round((matched.length / Math.min(needles.length, 8)) * 100)

  if (score >= 25) {
    return {
      ...params.qualityCheck,
      suggestions: [...params.qualityCheck.suggestions, `Brand fit harness score: ${score}`],
    }
  }

  return {
    ...params.qualityCheck,
    passed: false,
    issues: [...params.qualityCheck.issues, `브랜드 적합도 하네스 점수가 낮습니다 (${score}).`],
    suggestions: [...params.qualityCheck.suggestions, '브랜드 DNA의 대표 상품, 차별점, 비주얼 무드가 슬라이드와 이미지 프롬프트에 더 직접적으로 반영되어야 합니다.'],
  }
}

function compactBody(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 92)
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}
