import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../../../../lib/env'
import { type ImageProvider, sanitizeImagePrompt } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'
import { uploadGeneratedAsset } from '../../storage/upload'

const NO_TEXT_IMAGE_INSTRUCTIONS = [
  'BACKGROUND IMAGE ONLY.',
  'Do not generate any readable or pseudo-readable text.',
  'No letters, Hangul, alphabet, numbers, captions, signs, labels, posters, menus, packaging text, logos, watermarks, UI, buttons, icons, typography, handwriting, calligraphy, brand marks, or symbols.',
  'No Korean text, no English text, no typography, no captions, no signs, no logo, no watermark, no UI text.',
  'Leave clean empty negative space for application-rendered text later.',
  'Empty area reserved for editable text overlay.',
  'If the scene contains signs, books, screens, packaging, newspapers, menus, labels, or billboards, keep them blank, blurred, cropped away, or turned from the camera.',
].join(' ')

export const ACTIVE_OPENAI_IMAGE_MODEL = 'gpt-image-1'

export class OpenAIImageProvider implements ImageProvider {
  private openai: OpenAI
  private model: string

  constructor(apiKey = process.env.OPENAI_API_KEY, model = ACTIVE_OPENAI_IMAGE_MODEL) {
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
    const sanitizedPrompt = sanitizeImagePrompt(prompt)
    const fullPrompt = `${sanitizedPrompt}. ${NO_TEXT_IMAGE_INSTRUCTIONS}`
    const size = '1024x1024'
    const refUrls = options?.productImageUrls?.filter(Boolean) ?? []

    try {
      // When reference images are provided, use images.edit so the model
      // can use them as visual anchors (style, subject, color palette, etc.)
      if (refUrls.length > 0 && this.model.startsWith('gpt-image-')) {
        return await this.generateWithReferences(fullPrompt, refUrls, size)
      }

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
        const persistedUrl = await persistImageUrl(image?.url)
        return { imageUrl: persistedUrl }
      }

      const response = await this.openai.images.generate({
        model: this.model,
        prompt: fullPrompt,
        size,
        n: 1,
      })

      const persistedUrl = await persistImageUrl(response.data?.[0]?.url)
      return { imageUrl: persistedUrl }
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

      // Fallback 2: Any DALL-E / gpt-image error -> Mock SVG Image
      console.warn(`Image generation failed for model ${this.model}, falling back to mock image provider`, err)
      return new MockImageProvider().generateImage(prompt)
    }
  }

  // Fetch reference image URLs and call images.edit so the model uses them
  // as visual references for subject, style, and color palette
  private async generateWithReferences(
    prompt: string,
    refUrls: string[],
    size: string
  ): Promise<{ imageUrl: string }> {
    const imageFiles = await Promise.all(
      refUrls.slice(0, 4).map(async (url, i) => {
        if (!isTrustedUploadedReference(url)) {
          throw new Error('Reference image must be an uploaded Shuffla asset.')
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Reference image fetch failed: ${url}`)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = res.headers.get('content-type') || 'image/png'
        const ext = contentType.split('/')[1]?.split('+')[0] || 'png'
        return new File([buffer], `ref-${i}.${ext}`, { type: contentType })
      })
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (this.openai.images.edit as any)({
      model: this.model,
      image: imageFiles.length === 1 ? imageFiles[0] : imageFiles,
      prompt,
      size,
      output_format: 'png',
      quality: 'low',
      n: 1,
    })

    const image = response.data?.[0]
    if (image?.b64_json) {
      return { imageUrl: `data:image/png;base64,${image.b64_json}` }
    }
    const persistedUrl = await persistImageUrl(image?.url)
    return { imageUrl: persistedUrl }
  }
}

async function persistImageUrl(url: string | undefined): Promise<string> {
  if (!url || url.startsWith('data:')) return url || ''
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = res.headers.get('content-type') || 'image/png'
    const ext = contentType.split('/')[1]?.split('+')[0] || 'png'
    const fileName = `dalle-bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    return await uploadGeneratedAsset({
      fileName,
      content: buffer,
      contentType: contentType as any,
    })
  } catch (err) {
    console.error('[OpenAIImageProvider] Failed to persist image:', err)
    return url
  }
}

function isTrustedUploadedReference(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (url.hostname.endsWith('.public.blob.vercel-storage.com')) return true

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'
    const appOrigin = new URL(appUrl).origin
    return url.origin === appOrigin && url.pathname.startsWith('/uploads/')
  } catch {
    return false
  }
}
