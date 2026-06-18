import { cleanOrphanedParticles } from '../carousel/agents'

export type CardNewsAgentRole = 'hook' | 'context' | 'key-point' | 'detail' | 'stat' | 'summary' | 'save-cta'

export interface CardNewsAgentInput {
  brandName: string
  brandToneOfVoice?: string
  topic: string
  category: string
  title: string
  keyContent: string
  ctaStyle?: string
  forbiddenWords?: string
}

export interface CardNewsAgentSlide {
  slideNumber: number
  role: CardNewsAgentRole
  headline: string
  body: string
}

export interface CardNewsAgentResult<TSlide extends CardNewsAgentSlide> {
  slides: TSlide[]
  issues: string[]
  suggestions: string[]
}

const HEADLINE_LIMIT_BY_ROLE: Record<CardNewsAgentRole, number> = {
  hook: 18,
  context: 20,
  'key-point': 18,
  detail: 20,
  stat: 16,
  summary: 18,
  'save-cta': 16,
}

const BODY_LIMIT_BY_ROLE: Record<CardNewsAgentRole, number> = {
  hook: 46,
  context: 58,
  'key-point': 54,
  detail: 62,
  stat: 48,
  summary: 52,
  'save-cta': 42,
}

export function runCardNewsAgent<TSlide extends CardNewsAgentSlide>(params: {
  input: CardNewsAgentInput
  slides: TSlide[]
}): CardNewsAgentResult<TSlide> {
  const issues: string[] = []
  const suggestions: string[] = []
  const forbiddenWords = parseForbiddenWords(params.input.forbiddenWords)
  const seenHeadlines = new Set<string>()

  const slides = params.slides.map((slide, index) => {
    const isLast = index === params.slides.length - 1
    const role: CardNewsAgentRole = isLast ? 'save-cta' : slide.role
    const headlineLimit = HEADLINE_LIMIT_BY_ROLE[role]
    const bodyLimit = BODY_LIMIT_BY_ROLE[role]

    let headline = normalizeCopy(slide.headline)
    let body = normalizeCopy(slide.body)

    if (!headline) {
      headline = index === 0 ? normalizeCopy(params.input.title || params.input.topic) : `핵심 ${index + 1}`
      issues.push(`slide ${index + 1}: missing headline was repaired`)
    }

    if (!body || isNearDuplicate(headline, body)) {
      body = buildFallbackBody(params.input, role, index)
      suggestions.push(`slide ${index + 1}: body copy was strengthened`)
    }

    const beforeForbidden = `${headline}\n${body}`
    headline = removeForbiddenWords(headline, forbiddenWords)
    body = removeForbiddenWords(body, forbiddenWords)
    if (`${headline}\n${body}` !== beforeForbidden) {
      issues.push(`slide ${index + 1}: forbidden brand terms were removed`)
    }

    headline = trimToNaturalLength(headline, headlineLimit)
    body = trimToNaturalLength(body, bodyLimit)

    const duplicateKey = headline.toLowerCase()
    if (seenHeadlines.has(duplicateKey)) {
      headline = trimToNaturalLength(`${headline} 포인트`, headlineLimit)
      suggestions.push(`slide ${index + 1}: duplicate headline was adjusted`)
    }
    seenHeadlines.add(headline.toLowerCase())

    if (isLast) {
      body = trimToNaturalLength(params.input.ctaStyle || body || '저장해두고 필요할 때 다시 확인하세요.', bodyLimit)
    }

    return {
      ...slide,
      role,
      headline,
      body,
    }
  })

  return { slides, issues, suggestions }
}

function normalizeCopy(value: string) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseForbiddenWords(value?: string) {
  return String(value || '')
    .split(/[,;\n]/)
    .map(word => word.trim())
    .filter(Boolean)
}

function removeForbiddenWords(value: string, forbiddenWords: string[]) {
  const stripped = forbiddenWords.reduce((text, word) => {
    if (!word) return text
    return text.split(word).join('')
  }, value)
  return cleanOrphanedParticles(stripped)
}

function trimToNaturalLength(value: string, maxLength: number) {
  const clean = normalizeCopy(value)
  if (clean.length <= maxLength) return clean

  const sliced = clean.slice(0, maxLength + 1)
  const trimmed = sliced.replace(/\s+\S*$/, '').replace(/[,.!?…\s]+$/, '')
  return trimmed || clean.slice(0, maxLength)
}

function isNearDuplicate(headline: string, body: string) {
  const compactHeadline = compact(headline)
  const compactBody = compact(body)
  return compactHeadline.length > 0 && (compactHeadline === compactBody || compactBody.includes(compactHeadline))
}

function compact(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
}

function buildFallbackBody(input: CardNewsAgentInput, role: CardNewsAgentRole, index: number) {
  if (role === 'hook') return `${input.category} 관점에서 ${input.topic}의 핵심만 먼저 정리했습니다.`
  if (role === 'stat') return '숫자보다 중요한 맥락과 선택 기준을 함께 확인하세요.'
  if (role === 'save-cta') return input.ctaStyle || '저장해두고 필요할 때 다시 확인하세요.'
  if (role === 'summary') return `${input.brandName} 관점에서 바로 적용할 핵심만 다시 묶었습니다.`
  return `${input.brandToneOfVoice || '브랜드 톤'}에 맞춰 ${index + 1}번째 포인트를 정리했습니다.`
}
