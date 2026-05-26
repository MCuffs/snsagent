import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

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

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return ACTIVE_OPENAI_IMAGE_MODEL
  }

  if (provider === 'bytedance') return 'bytedance-placeholder'
  return 'mock'
}
