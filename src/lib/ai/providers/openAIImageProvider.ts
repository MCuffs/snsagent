import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'

const NO_TEXT_IMAGE_INSTRUCTIONS = [
  'BACKGROUND IMAGE ONLY.',
  'Do not generate any readable or pseudo-readable text.',
  'No letters, Hangul, alphabet, numbers, captions, signs, labels, posters, menus, packaging text, logos, watermarks, UI, buttons, icons, typography, handwriting, calligraphy, brand marks, or symbols.',
  'Leave clean empty negative space for application-rendered text later.',
  'If the scene contains signs, books, screens, packaging, newspapers, menus, labels, or billboards, keep them blank, blurred, cropped away, or turned from the camera.',
].join(' ')

export class OpenAIImageProvider implements ImageProvider {
  private openai: OpenAI
  private model: string

  constructor(apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_IMAGE_MODEL || 'dall-e-3') {
    if (!isConfiguredOpenAIKey(apiKey)) {
      throw new Error('OPENAI_API_KEY is not configured.')
    }
    const baseURL = process.env.OPENAI_BASE_URL || undefined
    this.openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })
    this.model = model
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const fullPrompt = `${prompt}. ${NO_TEXT_IMAGE_INSTRUCTIONS}`
    const size = '1024x1024'

    if (this.model === 'gpt-image-1') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.openai.images.generate as any)({
        model: this.model,
        prompt: fullPrompt,
        size,
        output_format: 'png',
        quality: 'low',
        n: 1,
      })

      const image = response.data?.[0]
      if (image?.b64_json) {
        return { imageUrl: `data:image/png;base64,${image.b64_json}` }
      }
      return { imageUrl: image?.url || '' }
    }

    // dall-e-3 (default)
    const response = await this.openai.images.generate({
      model: this.model,
      prompt: fullPrompt,
      size,
      n: 1,
    })

    return { imageUrl: response.data?.[0]?.url || '' }
  }
}
