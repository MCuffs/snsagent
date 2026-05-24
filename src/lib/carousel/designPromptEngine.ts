import { parseBrandDna } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, CarouselStructure, SlideCopy, SlideDesignPrompt, TextPosition } from './types'

export async function generateDesignPrompts(
  brand: BrandProfile,
  input: CampaignInput,
  copies: SlideCopy[],
  structure?: CarouselStructure
): Promise<SlideDesignPrompt[]> {
  const roleMap = new Map(
    structure?.slides.map(s => [s.slideNumber, s.role]) ?? []
  )
  const dna = parseBrandDna(brand.brandDna)
  const visualMood = dna.visualMood || ''
  const avoidVisuals = dna.avoidVisuals.length ? dna.avoidVisuals : []

  return copies.map((copy): SlideDesignPrompt => {
    const role = roleMap.get(copy.slideNumber) ?? 'product_solution'
    const textPosition = pickTextPosition(copy.slideNumber, copies.length)
    const backgroundPrompt = buildBackgroundPrompt(role, copy, input, brand, visualMood, avoidVisuals)

    return {
      slideNumber: copy.slideNumber,
      backgroundPrompt,
      layoutStyle: 'minimal-commerce',
      textPosition,
      visualMood: getVisualMood(role),
    }
  })
}

function buildBackgroundPrompt(
  role: string,
  copy: SlideCopy,
  input: CampaignInput,
  brand: BrandProfile,
  visualMood: string,
  avoidVisuals: string[]
): string {
  const avoidClause = avoidVisuals.length
    ? avoidVisuals.map(v => `no ${v}`).join(', ')
    : ''

  const base = [
    'Korean Instagram card news style',
    'square 1080x1080 composition',
    'background image only',
    'no text, no pseudo text, no letters, no numbers, no typography, no Hangul, no logo, no watermark',
    'no signage, labels, posters, menus, packaging text, screen text, handwriting, or calligraphy',
    `brand accent color ${brand.mainColor}`,
    visualMood ? `visual mood: ${visualMood}` : '',
    avoidClause,
    'clean empty negative space for app-rendered overlay later',
  ].filter(Boolean)

  const productContext = `product: ${input.productName}`
  const industryContext = `industry: ${brand.industry}`

  switch (role) {
    case 'hook':
      return [
        ...base,
        'dramatic hero shot, cinematic composition',
        'eye-catching bold visual that stops scroll',
        'strong contrast, editorial magazine style',
        productContext,
        industryContext,
      ].join(', ')

    case 'problem':
      return [
        ...base,
        'slightly moody relatable everyday scene',
        'subtle frustration or uncertainty atmosphere',
        'soft shadows, desaturated tones',
        industryContext,
        'lifestyle photography style',
      ].join(', ')

    case 'cause':
      return [
        ...base,
        'abstract conceptual visual',
        'clean metaphor for complexity or confusion',
        'minimal geometric shapes, muted palette',
        industryContext,
      ].join(', ')

    case 'common_mistake':
      return [
        ...base,
        'warning or cautionary visual mood',
        'split tone lighting, attention-grabbing',
        industryContext,
        'flat lay or close-up detail',
      ].join(', ')

    case 'product_solution':
      return [
        ...base,
        'bright positive uplifting light',
        `${input.productName} in natural use context`,
        'solution-oriented composition, warm tones',
        productContext,
        'lifestyle product photography',
      ].join(', ')

    case 'feature':
    case 'feature_1':
    case 'feature_2':
      return [
        ...base,
        'close-up detail shot, technical precision',
        `${input.productName} key feature highlight`,
        'clean minimalist product photography',
        'sharp focus, premium quality feel',
        productContext,
      ].join(', ')

    case 'benefit_or_proof':
    case 'proof':
      return [
        ...base,
        'warm authentic lifestyle scene',
        'trust and satisfaction atmosphere',
        'natural candid feel, soft warm lighting',
        industryContext,
        'real-life usage context',
      ].join(', ')

    case 'offer':
      return [
        ...base,
        'clean minimal product flatlay',
        'premium elegant composition',
        'soft neutral background, centered product',
        productContext,
        'commercial photography style',
      ].join(', ')

    case 'cta':
      return [
        ...base,
        'inviting warm and bright scene',
        'positive action-oriented energy',
        'light airy composition, welcoming mood',
        productContext,
        industryContext,
      ].join(', ')

    default:
      return [
        ...base,
        'minimal clean ecommerce product background',
        'soft lighting, neutral tones',
        productContext,
      ].join(', ')
  }
}

function getVisualMood(role: string): string {
  const moods: Record<string, string> = {
    hook: 'dramatic, bold, attention-grabbing',
    problem: 'relatable, slightly tense, authentic',
    cause: 'analytical, clean, informative',
    common_mistake: 'cautionary, direct, clear',
    product_solution: 'positive, trustworthy, solution-focused',
    feature: 'precise, premium, detail-oriented',
    feature_1: 'precise, premium, detail-oriented',
    feature_2: 'functional, clear, modern',
    benefit_or_proof: 'warm, authentic, reassuring',
    proof: 'warm, authentic, reassuring',
    offer: 'elegant, minimal, premium',
    cta: 'inviting, energetic, positive',
  }
  return moods[role] ?? 'clean, trustworthy, modern'
}

function pickTextPosition(slideNumber: number, slideCount: number): TextPosition {
  if (slideNumber === 1) return 'center'
  if (slideNumber === slideCount) return 'bottom'
  return slideNumber % 2 === 0 ? 'top' : 'center'
}
