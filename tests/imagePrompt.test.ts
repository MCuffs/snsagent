import assert from 'node:assert/strict'
import test from 'node:test'
import { isPromptAllowed, sanitizeImagePrompt } from '../src/lib/ai/imageProvider.ts'

test('sanitizeImagePrompt removes positive typography instructions', () => {
  const prompt = [
    'photorealistic walnut still life',
    'add headline text on the image',
    'reserve quiet negative space for app-rendered copy later',
  ].join(', ')

  const sanitized = sanitizeImagePrompt(prompt)

  assert.ok(!sanitized.includes('add headline text'))
  assert.ok(sanitized.includes('photorealistic walnut still life'))
  assert.ok(isPromptAllowed(sanitized))
})

test('negative no-text constraints remain allowed', () => {
  const prompt = 'background-only editorial photograph, no readable text, no labels, leave blank space'

  assert.equal(isPromptAllowed(prompt), true)
  assert.equal(sanitizeImagePrompt(prompt), 'background-only editorial photograph\nno readable text\nno labels\nleave blank space')
})
