import assert from 'node:assert/strict'
import test from 'node:test'
import { createEditorialDocument, layerByType, parseEditorialDocument } from '../src/lib/editor/document.ts'
import type { SlideEditorSeed } from '../src/lib/editor/types.ts'

function seed(overrides: Partial<SlideEditorSeed> = {}): SlideEditorSeed {
  return {
    slideNumber: 1,
    headline: '영상 카드뉴스',
    body: '본문',
    imageUrl: null,
    backgroundImageUrl: null,
    ...overrides,
  }
}

test('video metadata creates an editable video background without URL extension checks', () => {
  const document = createEditorialDocument(seed({
    videoUrl: 'https://cdn.example.com/signed-resource?token=abc',
    videoStartSec: 1,
    videoDurationSec: 5,
  }))
  const background = layerByType(document, 'background')

  assert.equal(background?.videoUrl, 'https://cdn.example.com/signed-resource?token=abc')
  assert.equal(background?.imageUrl, null)
  assert.equal(background?.videoStartSec, 1)
  assert.equal(background?.videoDurationSec, 5)
})

test('legacy editor documents are hydrated with explicit database video metadata', () => {
  const legacy = createEditorialDocument(seed({ imageUrl: 'https://example.com/old-preview.png' }))
  const restored = parseEditorialDocument(JSON.stringify(legacy), seed({
    videoUrl: 'https://blob.example.com/video',
    videoThumbnailUrl: 'https://blob.example.com/thumb.jpg',
    videoDurationSec: 5,
  }))
  const background = layerByType(restored, 'background')

  assert.equal(background?.videoUrl, 'https://blob.example.com/video')
  assert.equal(background?.imageUrl, 'https://blob.example.com/thumb.jpg')
})
