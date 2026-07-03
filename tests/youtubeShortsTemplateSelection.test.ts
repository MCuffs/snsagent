import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseShortsTemplate } from '../lib/youtube-shorts-templates/select.ts'
import { makeDefaultShortsTemplate, type YouTubeShortsTemplateRecord } from '../lib/youtube-shorts-templates/types.ts'

function record(overrides: Partial<YouTubeShortsTemplateRecord> = {}): YouTubeShortsTemplateRecord {
  const value = makeDefaultShortsTemplate()
  return {
    ...value,
    id: 'default-id',
    version: 1,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  }
}

test('uses the default template when classification is unavailable', () => {
  const fallback = record()
  const result = chooseShortsTemplate([fallback], null)
  assert.equal(result?.template.templateKey, 'basic_viral_shorts')
  assert.equal(result?.usedDefaultTemplate, true)
  assert.equal(result?.reason, 'classifier_unavailable')
})

test('uses an explicit active recommendation above its confidence threshold', () => {
  const fallback = record()
  const sports = record({
    id: 'sports-id',
    templateName: 'Sports',
    templateKey: 'sports_breaking',
    category: 'sports',
    isDefault: false,
    config: {
      ...fallback.config,
      aiMatching: {
        ...fallback.config.aiMatching,
        contentTypes: ['sports'],
        minimumConfidenceScore: 0.7,
      },
    },
  })
  const result = chooseShortsTemplate([fallback, sports], {
    contentType: 'sports',
    tone: 'serious',
    recommendedTemplateKey: 'sports_breaking',
    confidenceScore: 0.8,
    reason: 'Sports keywords.',
  })
  assert.equal(result?.template.templateKey, 'sports_breaking')
  assert.equal(result?.usedDefaultTemplate, false)
})

test('rejects a recommendation below the template threshold', () => {
  const fallback = record()
  const news = record({
    id: 'news-id',
    templateKey: 'breaking_news',
    isDefault: false,
    config: {
      ...fallback.config,
      aiMatching: {
        ...fallback.config.aiMatching,
        contentTypes: [],
        matchingCategories: [],
        minimumConfidenceScore: 0.9,
      },
    },
  })
  const result = chooseShortsTemplate([fallback, news], {
    contentType: 'news',
    tone: 'serious',
    recommendedTemplateKey: 'breaking_news',
    confidenceScore: 0.7,
    reason: 'News topic.',
  })
  assert.equal(result?.template.templateKey, 'basic_viral_shorts')
  assert.equal(result?.reason, 'low_confidence_or_no_match')
})
