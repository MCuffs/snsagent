import { listActiveCardTemplates } from './db'
import {
  CARD_TEMPLATE_DOMAINS,
  type CardTemplateDomain,
  type CardTemplateRecord,
  type TemplateSlideConfig,
} from './types'

export interface TemplateSelectionSignals {
  slideCount: number
  domain?: string | null
  contentType?: string | null
  industry?: string | null
  emotion?: string | null
  topic?: string | null
  keywords?: string[]
}

function tokenize(values: Array<string | null | undefined>): string[] {
  return values
    .flatMap((value) => (value ?? '').toLowerCase().split(/[^\p{L}\p{N}+#]+/u))
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function normalizeDomain(value?: string | null): CardTemplateDomain | null {
  if (!value) return null
  return CARD_TEMPLATE_DOMAINS.find((domain) => domain === value.toLowerCase()) ?? null
}

function scoreTemplate(
  template: CardTemplateRecord,
  signalTokens: Set<string>,
  domain: CardTemplateDomain | null,
): number {
  let score = domain && template.tags.domain.includes(domain) ? 12 : 0
  const tagTokens = [
    ...template.tags.emotion,
    ...template.tags.industry,
    ...template.tags.style,
    ...template.tags.visualTone,
  ].map((tag) => tag.toLowerCase().trim())

  for (const tag of tagTokens) {
    if (!tag) continue
    if (signalTokens.has(tag)) {
      score += 2
      continue
    }
    for (const signal of signalTokens) {
      if (signal.length >= 3 && (signal.includes(tag) || tag.includes(signal))) {
        score += 1
        break
      }
    }
  }
  return score
}

function cloneSlide(slide: TemplateSlideConfig, slideNumber: number): TemplateSlideConfig {
  return {
    ...slide,
    slideNumber,
    typography: { ...slide.typography },
    overlay: { ...slide.overlay },
    layout: { ...slide.layout },
    background: { ...slide.background },
  }
}

/**
 * Fits a 5/7-slide authored template to any generated carousel size from 5 to 10.
 * The hero and CTA are preserved; middle slide styles are sampled or repeated.
 */
export function fitTemplateToSlideCount(
  template: CardTemplateRecord,
  requestedSlideCount: number,
): CardTemplateRecord {
  const targetCount = Math.min(10, Math.max(5, Math.round(requestedSlideCount)))
  const source = template.slides
  if (source.length === 0) return template
  if (source.length === targetCount) return template

  const first = source[0]
  const last = source[source.length - 1]
  const middle = source.slice(1, -1)
  const targetMiddleCount = targetCount - 2
  const fittedMiddle = Array.from({ length: targetMiddleCount }, (_, index) => {
    if (middle.length === 0) return first
    const sourceIndex = targetMiddleCount === 1
      ? 0
      : Math.round((index * (middle.length - 1)) / (targetMiddleCount - 1))
    return middle[sourceIndex]
  })
  const slides = [first, ...fittedMiddle, last].map((slide, index) => cloneSlide(slide, index + 1))

  return { ...template, slideCount: targetCount, slides }
}

function nearestAuthoredSlideCount(candidates: CardTemplateRecord[], requested: number): number | null {
  const counts = Array.from(new Set(candidates.map((candidate) => candidate.slideCount)))
  return counts.sort((a, b) => Math.abs(a - requested) - Math.abs(b - requested) || b - a)[0] ?? null
}

export function chooseCardTemplateForContent(
  allCandidates: CardTemplateRecord[],
  signals: TemplateSelectionSignals,
): CardTemplateRecord | null {
  if (allCandidates.length === 0) return null

  const requestedCount = Math.min(10, Math.max(5, Math.round(signals.slideCount || 5)))
  const authoredCount = nearestAuthoredSlideCount(allCandidates, requestedCount)
  const candidates = allCandidates.filter((template) => template.slideCount === authoredCount)
  if (candidates.length === 0) return null

  const domain = normalizeDomain(signals.domain)
  const signalTokens = new Set(tokenize([
    signals.contentType,
    signals.industry,
    signals.emotion,
    signals.topic,
    ...(signals.keywords ?? []),
  ]))

  let best: CardTemplateRecord | null = null
  let bestScore = -1
  for (const template of candidates) {
    const score = scoreTemplate(template, signalTokens, domain)
    const adjusted = score * 10 + (template.isDefault ? 1 : 0)
    if (adjusted > bestScore) {
      bestScore = adjusted
      best = template
    }
  }

  if (bestScore < 10) {
    best = candidates.find((template) => template.isDefault) ?? candidates[0]
  }
  return best ? fitTemplateToSlideCount(best, requestedCount) : null
}

/** Selects an active domain/tag-matched template and adapts it to 5-10 slides. */
export async function selectCardTemplateForContent(
  signals: TemplateSelectionSignals,
): Promise<CardTemplateRecord | null> {
  const candidates = await listActiveCardTemplates().catch(() => [])
  return chooseCardTemplateForContent(candidates, signals)
}
