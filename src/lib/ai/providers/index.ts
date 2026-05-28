import { isConfiguredOpenAIKey, isConfiguredGeminiKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { GeminiImageProvider } from './geminiImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'gemini') {
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

  return new MockImageProvider()
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'gemini') return 'gemini-2.0-flash-preview-image-generation'

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return ACTIVE_OPENAI_IMAGE_MODEL
  }

  if (provider === 'bytedance') return 'bytedance-placeholder'

  if (provider === 'auto' && isConfiguredGeminiKey(process.env.GEMINI_API_KEY)) {
    return 'gemini-2.0-flash-preview-image-generation'
  }

  return 'mock'
}
