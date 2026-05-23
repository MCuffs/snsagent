import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../../../../lib/env'
import type { ImageProvider } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'

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

  constructor(apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2') {
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

    try {
      if (this.model.startsWith('gpt-image-')) {
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

      const response = await this.openai.images.generate({
        model: this.model,
        prompt: fullPrompt,
        size,
        n: 1,
      })

      return { imageUrl: response.data?.[0]?.url || '' }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err)
      
      // Fallback 1: dall-e-3 -> dall-e-2
      if (
        this.model === 'dall-e-3' &&
        (errMessage.includes('dall-e-3') || errMessage.includes('does not exist') || errMessage.includes('not found'))
      ) {
        console.warn('dall-e-3 is not available, falling back to dall-e-2', err)
        try {
          const fallbackResponse = await this.openai.images.generate({
            model: 'dall-e-2',
            prompt: fullPrompt,
            size,
            n: 1,
          })
          return { imageUrl: fallbackResponse.data?.[0]?.url || '' }
        } catch (fallbackErr: unknown) {
          console.warn('dall-e-2 also failed, falling back to mock image provider', fallbackErr)
          return new MockImageProvider().generateImage(prompt)
        }
      }

      // Fallback 2: Any DALL-E / gpt-image-2 error -> Mock SVG Image
      console.warn(`Image generation failed for model ${this.model}, falling back to mock image provider`, err)
      return new MockImageProvider().generateImage(prompt)
    }
  }
}
