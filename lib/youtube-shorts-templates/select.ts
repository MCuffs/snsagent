import { ensureBuiltInShortsTemplates, listShortsTemplates } from './db'
import type { ShortsClassifierResult, YouTubeShortsTemplateRecord } from './types'

export interface TemplateSelection {
  template: YouTubeShortsTemplateRecord
  usedDefaultTemplate: boolean
  reason: string
}

export function chooseShortsTemplate(
  templates: YouTubeShortsTemplateRecord[],
  classification: ShortsClassifierResult | null,
): TemplateSelection | null {
  const active = templates.filter(t => t.isActive)
  const fallback = active.find(t => t.isDefault)
  if (!fallback) return null
  if (!classification) return { template: fallback, usedDefaultTemplate: true, reason: 'classifier_unavailable' }

  const recommended = classification.recommendedTemplateKey
    ? active.find(t => t.templateKey === classification.recommendedTemplateKey)
    : undefined
  if (recommended && classification.confidenceScore >= recommended.config.aiMatching.minimumConfidenceScore) {
    return { template: recommended, usedDefaultTemplate: recommended.isDefault, reason: 'ai_recommendation' }
  }

  const candidates = active
    .filter(t => !t.isDefault)
    .map(template => {
      const match = template.config.aiMatching
      let score = match.fallbackPriority / 100
      if (match.contentTypes.includes(classification.contentType)) score += 4
      if (match.tones.includes(classification.tone)) score += 1
      if (match.matchingCategories.includes(classification.contentType) || template.category === classification.contentType) score += 3
      return { template, score }
    })
    .filter(item => classification.confidenceScore >= item.template.config.aiMatching.minimumConfidenceScore)
    .sort((a, b) => b.score - a.score)

  if (candidates[0]?.score >= 3) {
    return { template: candidates[0].template, usedDefaultTemplate: false, reason: 'category_rule_match' }
  }
  return { template: fallback, usedDefaultTemplate: true, reason: 'low_confidence_or_no_match' }
}

export async function selectShortsTemplate(classification: ShortsClassifierResult | null) {
  await ensureBuiltInShortsTemplates()
  const result = chooseShortsTemplate(await listShortsTemplates(true), classification)
  if (!result) throw new Error('No active default YouTube Shorts template is configured.')
  return result
}
