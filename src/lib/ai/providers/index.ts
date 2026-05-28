import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'
import { UnsplashImageProvider } from './unsplashImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'unsplash') {
    return new UnsplashImageProvider()
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return new OpenAIImageProvider()
  }

  if (provider === 'bytedance') {
    return new ByteDanceImageProvider()
  }

  // auto 모드에서 OpenAI 키 없으면 Unsplash 폴백
  if (provider === 'auto' && process.env.UNSPLASH_ACCESS_KEY?.trim()) {
    return new UnsplashImageProvider()
  }

  return new MockImageProvider()
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'unsplash') return 'unsplash'

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return ACTIVE_OPENAI_IMAGE_MODEL
  }

  if (provider === 'bytedance') return 'bytedance-placeholder'

  if (provider === 'auto' && process.env.UNSPLASH_ACCESS_KEY?.trim()) return 'unsplash'

  return 'mock'
}
