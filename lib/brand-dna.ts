export interface BrandDna {
  brandDescription: string
  coreProducts: string[]
  valueProposition: string
  customerPainPoints: string[]
  differentiators: string[]
  visualMood: string
  contentPillars: string[]
  brandKeywords: string[]
  avoidVisuals: string[]
}

export const EMPTY_BRAND_DNA: BrandDna = {
  brandDescription: '',
  coreProducts: [],
  valueProposition: '',
  customerPainPoints: [],
  differentiators: [],
  visualMood: '',
  contentPillars: [],
  brandKeywords: [],
  avoidVisuals: [],
}

export function parseBrandDna(value?: string | null): BrandDna {
  if (!value) return EMPTY_BRAND_DNA
  try {
    return normalizeBrandDna(JSON.parse(value) as Partial<BrandDna>)
  } catch {
    return EMPTY_BRAND_DNA
  }
}

export function stringifyBrandDna(value: Partial<BrandDna>) {
  return JSON.stringify(normalizeBrandDna(value))
}

export function normalizeBrandDna(value: Partial<BrandDna>): BrandDna {
  return {
    brandDescription: normalizeText(value.brandDescription),
    coreProducts: normalizeList(value.coreProducts),
    valueProposition: normalizeText(value.valueProposition),
    customerPainPoints: normalizeList(value.customerPainPoints),
    differentiators: normalizeList(value.differentiators),
    visualMood: normalizeText(value.visualMood),
    contentPillars: normalizeList(value.contentPillars),
    brandKeywords: normalizeList(value.brandKeywords),
    avoidVisuals: normalizeList(value.avoidVisuals),
  }
}

export function buildBrandDnaFromProfile(input: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  ctaStyle: string
  brandDescription?: string
  sourceText?: string
  parsed?: Record<string, unknown>
}) {
  const parsed = input.parsed || {}
  const sourceWords = extractKeywords(input.sourceText || '')
  const valueProposition = readString(parsed.valueProposition) || `${input.name}은(는) ${input.targetAudience}을 위한 ${input.industry} 브랜드입니다.`
  const brandDescription = input.brandDescription
    || readString(parsed.brandDescription)
    || valueProposition
  return stringifyBrandDna({
    brandDescription,
    coreProducts: toStringList(parsed.coreProducts).concat(sourceWords.products).slice(0, 6),
    valueProposition,
    customerPainPoints: toStringList(parsed.customerPainPoints).concat(sourceWords.pains).slice(0, 6),
    differentiators: toStringList(parsed.differentiators).concat(sourceWords.differentiators).slice(0, 6),
    visualMood: readString(parsed.visualMood) || `${input.toneOfVoice}, 브랜드 컬러 ${input.mainColor}, 감성적 제품 사진`,
    contentPillars: toStringList(parsed.contentPillars).concat([
      '제품 혜택 교육',
      '고객 문제와 해결',
      '브랜드 신뢰와 증거',
      '구매 유도 CTA',
    ]).slice(0, 6),
    brandKeywords: toStringList(parsed.brandKeywords).concat([
      input.name,
      input.industry,
      input.targetAudience,
    ]).concat(sourceWords.keywords).slice(0, 10),
    avoidVisuals: toStringList(parsed.avoidVisuals).concat([
      '일반 스톡 사진',
      '관련 없는 추상 배경',
      '이미지 속 가짜 텍스트',
    ]).slice(0, 6),
  })
}

export function formatBrandDnaForPrompt(value?: string | null) {
  const dna = parseBrandDna(value)
  return [
    `브랜드 설명: ${dna.brandDescription || dna.valueProposition || 'unknown'}`,
    `핵심 제품/서비스: ${dna.coreProducts.join(', ') || 'unknown'}`,
    `가치 제안: ${dna.valueProposition || 'unknown'}`,
    `고객 페인포인트: ${dna.customerPainPoints.join(', ') || 'unknown'}`,
    `차별점: ${dna.differentiators.join(', ') || 'unknown'}`,
    `비주얼 무드: ${dna.visualMood || 'unknown'}`,
    `콘텐츠 필러: ${dna.contentPillars.join(', ') || 'unknown'}`,
    `브랜드 키워드: ${dna.brandKeywords.join(', ') || 'unknown'}`,
    `피해야 할 비주얼: ${dna.avoidVisuals.join(', ') || 'unknown'}`,
  ].join('\n')
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
}

function normalizeList(value: unknown) {
  return toStringList(value).map(item => item.slice(0, 120)).slice(0, 10)
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(/[,;\n]/).map(item => item.trim()).filter(Boolean)
  return []
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractKeywords(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const candidates = Array.from(new Set(clean.match(/[\p{L}\p{N}][\p{L}\p{N}\s-]{1,22}/gu) || []))
    .map(item => item.trim())
    .filter(item => item.length >= 2 && !/^(http|https|www|com|co|kr|naver|instagram)$/i.test(item))
    .slice(0, 36)

  return {
    products: candidates.filter(item => /product|service|shop|store|coffee|cream|food|class|app|상품|제품|서비스|세트|크림|커피|식품|예약|클래스|솔루션/i.test(item)).slice(0, 4),
    pains: candidates.filter(item => /problem|pain|need|worry|issue|문제|불편|필요|고민|걱정|부족|관리/i.test(item)).slice(0, 4),
    differentiators: candidates.filter(item => /premium|custom|natural|eco|fast|certified|direct|전문|프리미엄|맞춤|천연|친환경|빠른|검증|인증|직접/i.test(item)).slice(0, 4),
    keywords: candidates.slice(0, 8),
  }
}
