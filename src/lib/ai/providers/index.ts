import { isConfiguredOpenAIKey, isConfiguredGeminiKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { GeminiImageProvider, GEMINI_IMAGE_MODEL } from './geminiImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'mock') {
    return new MockImageProvider()
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return new GeminiImageProvider()
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return new OpenAIImageProvider()
  }

  if (provider === 'bytedance') {
    return new ByteDanceImageProvider()
  }

  // auto 모드에서 OpenAI 키 없으면 Gemini fallback
  if (provider === 'auto' && isConfiguredGeminiKey(process.env.GEMINI_API_KEY)) {
    return new GeminiImageProvider()
  }

  throw new Error('Image generation is not configured. Set OPENAI_API_KEY or GEMINI_API_KEY, or set IMAGE_PROVIDER=mock for local development.')
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'mock') return 'mock'

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return GEMINI_IMAGE_MODEL
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return ACTIVE_OPENAI_IMAGE_MODEL
  }

  if (provider === 'bytedance') return 'bytedance-placeholder'

  if (provider === 'auto' && isConfiguredGeminiKey(process.env.GEMINI_API_KEY)) {
    return 'gemini-3.1-flash-image'
  }

  return 'unconfigured'
}
