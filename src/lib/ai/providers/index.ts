import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { GeminiImageProvider, GEMINI_IMAGE_MODEL } from './geminiImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return new GeminiImageProvider()
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return new OpenAIImageProvider()
  }

  if (provider === 'bytedance') {
    return new ByteDanceImageProvider()
  }

  return new MockImageProvider()
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return GEMINI_IMAGE_MODEL
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return ACTIVE_OPENAI_IMAGE_MODEL
  }

  if (provider === 'bytedance') return 'bytedance-placeholder'
  return 'mock'
}
