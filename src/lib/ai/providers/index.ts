import type { ImageProvider } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'
import { GeminiImageProvider, GeminiWithOpenAIFallbackProvider } from './geminiImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'mock' && process.env.ALLOW_MOCK_IMAGES === 'true') {
    return new MockImageProvider()
  }

  // Nano Banana (Gemini) with OpenAI fallback
  return new GeminiWithOpenAIFallbackProvider()
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'mock' && process.env.ALLOW_MOCK_IMAGES === 'true') {
    return 'mock'
  }

  return 'gemini-3.1-flash-image'
}
