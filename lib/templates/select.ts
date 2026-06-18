import { listActiveCardTemplates } from './db'
import type { CardTemplateRecord } from './types'

export interface TemplateSelectionSignals {
  slideCount: number
  contentType?: string | null   // e.g. "business", "startup", "motivational", "news"
  industry?: string | null
  emotion?: string | null       // e.g. "confidence", "curiosity"
  topic?: string | null
  keywords?: string[]
}

function tokenize(values: Array<string | null | undefined>): string[] {
  return values
    .flatMap((v) => (v ?? '').toLowerCase().split(/[^a-z0-9가-힣]+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

function scoreTemplate(template: CardTemplateRecord, signalTokens: Set<string>): number {
  const tagTokens = [
    ...template.tags.emotion,
    ...template.tags.industry,
    ...template.tags.style,
    ...template.tags.visualTone,
  ].map((t) => t.toLowerCase().trim())

  let score = 0
  for (const tag of tagTokens) {
    if (!tag) continue
    if (signalTokens.has(tag)) {
      score += 2
      continue
    }
    // partial token overlap (e.g. signal "startups" vs tag "startup")
    for (const sig of signalTokens) {
      if (sig.length >= 3 && (sig.includes(tag) || tag.includes(sig))) {
        score += 1
        break
      }
    }
  }
  return score
}

/**
 * Picks the most suitable active template for the given content signals using tag-heuristic
 * matching. Returns `null` when no active template exists for the slide count — callers MUST
 * treat null as "use the existing default generation behavior" (no regression).
 */
export async function selectCardTemplateForContent(
  signals: TemplateSelectionSignals,
): Promise<CardTemplateRecord | null> {
  const candidates = await listActiveCardTemplates(signals.slideCount).catch(() => [])
  if (candidates.length === 0) return null

  const signalTokens = new Set(
    tokenize([
      signals.contentType,
      signals.industry,
      signals.emotion,
      signals.topic,
      ...(signals.keywords ?? []),
    ]),
  )

  let best: CardTemplateRecord | null = null
  let bestScore = -1
  for (const template of candidates) {
    const score = scoreTemplate(template, signalTokens)
    // tie-break: prefer isDefault, then more recent (candidates already sorted by updatedAt desc)
    const adjusted = score * 10 + (template.isDefault ? 1 : 0)
    if (adjusted > bestScore) {
      bestScore = adjusted
      best = template
    }
  }

  // If nothing scored on tags, fall back to the explicit default, else the most recent active.
  if (bestScore < 10) {
    return candidates.find((t) => t.isDefault) ?? candidates[0]
  }
  return best
}
