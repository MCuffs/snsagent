import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCommonsSearchQuery } from '../src/lib/ai/providers/freeStockImageProvider.ts'

test('Korean food topics are translated into searchable Commons keywords', () => {
  const query = buildCommonsSearchQuery('호두의 효능 카드뉴스 배경, clean editorial background, no text')

  assert.ok(query.includes('walnut'))
  assert.ok(query.includes('still'))
  assert.ok(query.includes('life'))
  assert.ok(!query.includes('카드뉴스'))
})

test('visual prompt noise is removed from free stock search query', () => {
  const query = buildCommonsSearchQuery('background image only, no text, walnut still life, empty instagram layout')

  assert.ok(query.includes('walnut'))
  assert.ok(!query.includes('background'))
  assert.ok(!query.includes('instagram'))
})
