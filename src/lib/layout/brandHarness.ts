import { formatBrandDnaForPrompt, parseBrandDna } from '../../../lib/brand-dna'
import type { MediaCardQualityResult } from './qualityCheck'

export function buildBrandHarnessPrompt(params: {
  brandName: string
  brandIndustry?: string
  brandToneOfVoice?: string
  brandMainColor?: string
  brandDna?: string | null
}) {
  return [
    `Brand name: ${params.brandName}`,
    `Industry: ${params.brandIndustry || 'unknown'}`,
    `Tone: ${params.brandToneOfVoice || 'unknown'}`,
    `Main color: ${params.brandMainColor || 'unknown'}`,
    formatBrandDnaForPrompt(params.brandDna),
  ].join('\n')
}

export function buildVisualBrandAnchors(brandDna?: string | null) {
  const dna = parseBrandDna(brandDna)
  return [
    dna.coreProducts.length ? `show visual cues related to: ${dna.coreProducts.join(', ')}` : '',
    dna.valueProposition ? `communicate value proposition visually: ${dna.valueProposition}` : '',
    dna.differentiators.length ? `reflect differentiators: ${dna.differentiators.join(', ')}` : '',
    dna.visualMood ? `brand visual mood: ${dna.visualMood}` : '',
    dna.avoidVisuals.length ? `avoid: ${dna.avoidVisuals.join(', ')}` : '',
  ].filter(Boolean).join(', ')
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
