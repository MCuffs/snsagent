import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseCardTemplateForContent, fitTemplateToSlideCount } from '../lib/templates/select.ts'
import { makeDefaultTemplateConfig, type CardTemplateRecord } from '../lib/templates/types.ts'

function template(slideCount: 5 | 7): CardTemplateRecord {
  const config = makeDefaultTemplateConfig(slideCount)
  config.slides[config.slides.length - 1].label = 'CTA'
  return {
    id: `template-${slideCount}`,
    name: `Template ${slideCount}`,
    description: null,
    slideCount,
    status: 'active',
    isDefault: true,
    slides: config.slides,
    tags: config.tags,
    createdAt: '2026-06-21T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
  }
}

test('template fitting preserves hero and CTA while expanding to 10 slides', () => {
  const source = template(7)
  const result = fitTemplateToSlideCount(source, 10)

  assert.equal(result.slides.length, 10)
  assert.equal(result.slides[0].label, source.slides[0].label)
  assert.equal(result.slides[9].label, 'CTA')
  assert.deepEqual(result.slides.map((slide) => slide.slideNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('template fitting preserves CTA when reducing a 7-slide template to 6', () => {
  const result = fitTemplateToSlideCount(template(7), 6)

  assert.equal(result.slides.length, 6)
  assert.equal(result.slides[5].label, 'CTA')
})

test('domain matching takes priority and 6 slides use the nearest 7-slide variant', () => {
  const tech = template(7)
  tech.id = 'tech-7'
  tech.tags.domain = ['tech']
  const techFive = template(5)
  techFive.id = 'tech-5'
  techFive.tags.domain = ['tech']
  const news = template(7)
  news.id = 'news'
  news.tags.domain = ['news']

  const result = chooseCardTemplateForContent([techFive, news, tech], {
    slideCount: 6,
    domain: 'tech',
  })

  assert.equal(result?.id, 'tech-7')
  assert.equal(result?.slides.length, 6)
})
