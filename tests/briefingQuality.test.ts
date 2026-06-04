import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateBriefingQuality } from '../src/lib/quality/briefingQuality.ts'

test('short generic Korean topic asks for clarification', () => {
  const result = evaluateBriefingQuality({
    text: '호두의 효능에 대한 카드뉴스를 만들어주세요',
    language: 'ko',
    generationMode: 'general',
  })

  assert.equal(result.shouldClarify, true)
  assert.ok(result.missing.includes('audience'))
  assert.ok(result.missing.includes('purpose'))
})

test('specific Korean briefing can proceed', () => {
  const result = evaluateBriefingQuality({
    text: '호두 효능을 건강 관심 초보자에게 하루 섭취량, 영양 성분, 과다 섭취 주의점까지 균형 있게 설명하고 저장 유도 CTA를 넣어주세요',
    language: 'ko',
    generationMode: 'general',
  })

  assert.equal(result.shouldClarify, false)
  assert.ok(result.score >= 56)
})

test('short generic English topic asks for clarification', () => {
  const result = evaluateBriefingQuality({
    text: 'make a carousel about walnut benefits',
    language: 'en',
    generationMode: 'general',
  })

  assert.equal(result.shouldClarify, true)
  assert.ok(result.missing.includes('audience'))
})

test('specific English briefing can proceed', () => {
  const result = evaluateBriefingQuality({
    text: 'Create an educational carousel for health-conscious beginners about walnut nutrition, serving size, storage, and balanced cautions with a save CTA',
    language: 'en',
    generationMode: 'general',
  })

  assert.equal(result.shouldClarify, false)
  assert.ok(result.score >= 56)
})
