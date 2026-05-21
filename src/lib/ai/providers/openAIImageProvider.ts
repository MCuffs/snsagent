import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'

export class OpenAIImageProvider implements ImageProvider {
  private openai: OpenAI

  constructor(apiKey = process.env.OPENAI_API_KEY) {
    if (!isConfiguredOpenAIKey(apiKey)) {
      throw new Error('OPENAI_API_KEY is not configured.')
    }
    this.openai = new OpenAI({ apiKey })
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: `${prompt}. Do not render any text, letters, captions, Hangul, logos, or typography.`,
      size: options?.size === '1024x1024' ? '1024x1024' : '1024x1024',
      n: 1,
    })

    return { imageUrl: response.data?.[0]?.url || '' }
  }
}
