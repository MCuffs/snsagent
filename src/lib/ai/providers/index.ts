import type { ImageProvider } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'
import { PexelsImageProvider } from './pexelsImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'pexels').toLowerCase()

  if (provider === 'mock' && process.env.ALLOW_MOCK_IMAGES === 'true') {
    return new MockImageProvider()
  }

  return new PexelsImageProvider()
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'pexels').toLowerCase()

  if (provider === 'mock' && process.env.ALLOW_MOCK_IMAGES === 'true') {
    return 'mock'
  }

  return 'pexels-only'
}
