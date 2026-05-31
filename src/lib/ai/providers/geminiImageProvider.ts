import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import { type ImageProvider, sanitizeImagePrompt } from '../imageProvider'
import { uploadGeneratedAsset } from '../../storage/upload'

// Nano Banana 2 = Gemini 3.1 Flash Image
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'

const NO_TEXT_INSTRUCTIONS =
  'Background photograph only. No readable text, branding, signs, UI, or typography anywhere.'

export class GeminiImageProvider implements ImageProvider {
  private client: GoogleGenerativeAI
  private model: string

  constructor(apiKey = process.env.GEMINI_API_KEY, model = GEMINI_IMAGE_MODEL) {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.')
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = model
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const sanitized = sanitizeImagePrompt(prompt)
    const fullPrompt = `${sanitized}\n${NO_TEXT_INSTRUCTIONS}`

    try {
      const genModel = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          // @ts-expect-error — responseModalities not yet in TS types
          responseModalities: ['IMAGE'],
          temperature: 1,
          topP: 0.95,
          topK: 40,
        },
      })

      const parts: Part[] = [{ text: fullPrompt }]

      const refUrls = options?.productImageUrls?.filter(Boolean) ?? []
      for (const url of refUrls.slice(0, 2)) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const buffer = Buffer.from(await res.arrayBuffer())
          const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0] as
            | 'image/jpeg'
            | 'image/png'
            | 'image/webp'
          parts.push({ inlineData: { data: buffer.toString('base64'), mimeType } })
        } catch {
          // skip bad reference
        }
      }

      const result = await genModel.generateContent(parts)
      const response = result.response

      for (const candidate of response.candidates ?? []) {
        for (const part of candidate.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const buffer = Buffer.from(part.inlineData.data, 'base64')
            const mimeType = part.inlineData.mimeType || 'image/png'
            const ext = mimeType.endsWith('jpeg') || mimeType.endsWith('jpg') ? 'jpeg' : 'png'
            const fileName = `gemini-bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
            const persistedUrl = await uploadGeneratedAsset({
              fileName,
              content: buffer,
              contentType: mimeType as 'image/png' | 'image/jpeg',
            })
            return { imageUrl: persistedUrl }
          }
        }
      }

      throw new Error('Gemini returned no image data')
    } catch (err) {
      console.error('[GeminiImageProvider] Generation failed', err)
      throw err
    }
  }
}
