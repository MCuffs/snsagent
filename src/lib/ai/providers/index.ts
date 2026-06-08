import { isConfiguredOpenAIKey, isConfiguredGeminiKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { ByteDanceImageProvider } from './byteDanceImageProvider'
import { FreeStockImageProvider } from './freeStockImageProvider'
import { GeminiImageProvider, GeminiWithOpenAIFallbackProvider, canUseGeminiWithFallback, GEMINI_IMAGE_MODEL } from './geminiImageProvider'
import { MockImageProvider } from './mockImageProvider'
import { ACTIVE_OPENAI_IMAGE_MODEL, OpenAIImageProvider } from './openAIImageProvider'
import { PexelsImageProvider } from './pexelsImageProvider'

export function getPipelineImageProvider(): ImageProvider {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()
  const pexelsFirst = process.env.PEXELS_IMAGES !== 'false' && Boolean(process.env.PEXELS_API_KEY)

  if (provider === 'mock') {
    return new MockImageProvider()
  }

  if (provider === 'pexels') {
    return new PexelsImageProvider(getConfiguredPaidImageProvider() || new MockImageProvider())
  }

  if (provider === 'free-stock' || provider === 'stock' || provider === 'wikimedia') {
    const stock = new FreeStockImageProvider(new MockImageProvider())
    return pexelsFirst ? new PexelsImageProvider(stock) : stock
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    const generatedProvider = canUseGeminiWithFallback()
      ? new GeminiWithOpenAIFallbackProvider()
      : new GeminiImageProvider()
    return pexelsFirst ? new PexelsImageProvider(generatedProvider) : generatedProvider
  }

  if (provider === 'auto' && process.env.FREE_STOCK_IMAGES !== 'false') {
    const generatedProvider = getConfiguredPaidImageProvider() || new MockImageProvider()
    const stock = new FreeStockImageProvider(generatedProvider)
    return pexelsFirst ? new PexelsImageProvider(stock) : stock
  }

  if ((provider === 'auto' || provider === 'openai') && isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    const generatedProvider = new OpenAIImageProvider()
    return pexelsFirst ? new PexelsImageProvider(generatedProvider) : generatedProvider
  }

  if (provider === 'bytedance') {
    const generatedProvider = new ByteDanceImageProvider()
    return pexelsFirst ? new PexelsImageProvider(generatedProvider) : generatedProvider
  }

  // auto 모드에서 OpenAI 키 없으면 Gemini fallback (OpenAI 키가 있으면 폴백 포함)
  if (provider === 'auto' && isConfiguredGeminiKey(process.env.GEMINI_API_KEY)) {
    const generatedProvider = canUseGeminiWithFallback()
      ? new GeminiWithOpenAIFallbackProvider()
      : new GeminiImageProvider()
    return pexelsFirst ? new PexelsImageProvider(generatedProvider) : generatedProvider
  }

  throw new Error('Image generation is not configured. Set OPENAI_API_KEY or GEMINI_API_KEY, or set IMAGE_PROVIDER=mock for local development.')
}

function getConfiguredPaidImageProvider(): ImageProvider | null {
  if (isConfiguredOpenAIKey(process.env.OPENAI_API_KEY)) {
    return new OpenAIImageProvider()
  }
  if (isConfiguredGeminiKey(process.env.GEMINI_API_KEY)) {
    return new GeminiImageProvider()
  }
  return null
}

export function getPipelineImageModel() {
  const provider = (process.env.IMAGE_PROVIDER || 'auto').toLowerCase()

  if (provider === 'mock') return 'mock'

  if (provider === 'pexels' || (process.env.PEXELS_IMAGES !== 'false' && process.env.PEXELS_API_KEY)) {
    return 'pexels-first'
  }

  if (provider === 'free-stock' || provider === 'stock' || provider === 'wikimedia') {
    return 'free-stock-wikimedia'
  }

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return GEMINI_IMAGE_MODEL
  }

  if (provider === 'auto' && process.env.FREE_STOCK_IMAGES !== 'false') {
    return 'free-stock-wikimedia'
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
