import type { ImageProvider } from '../imageProvider'
import { sanitizeImagePrompt } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'
import { uploadGeneratedAsset } from '../../storage/upload'

const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const NO_TEXT_INSTRUCTIONS = [
  'Background photograph only.',
  'No readable text, branding, signage, watermarks, UI elements, or typographic shapes.',
  'Keep any printed surfaces blank or out of focus.',
].join(' ')

export class GeminiImageProvider implements ImageProvider {
  private readonly apiKey: string

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey?.trim() || apiKey === 'your-gemini-api-key-here') {
      throw new Error('GEMINI_API_KEY is not configured.')
    }
    this.apiKey = apiKey.trim()
  }

  async generateImage(
    prompt: string,
    _options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const sanitized = sanitizeImagePrompt(prompt)
    const fullPrompt = `${sanitized}\n${NO_TEXT_INSTRUCTIONS}`

    try {
      const url = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${this.apiKey}`

      const body = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Gemini API error ${res.status}: ${errText}`)
      }

      const data = await res.json() as GeminiResponse

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (p): p is GeminiInlineDataPart => 'inlineData' in p
      )

      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini returned no image data')
      }

      const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const mimeType = imagePart.inlineData.mimeType || 'image/png'
      const ext = mimeType === 'image/jpeg' ? 'jpeg' : 'png'

      const imageUrl = await uploadGeneratedAsset({
        fileName: `gemini-bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
        content: buffer,
        contentType: mimeType as 'image/png' | 'image/jpeg',
      })

      return { imageUrl }
    } catch (err) {
      console.warn('[GeminiImageProvider] Failed, falling back to mock:', err)
      return new MockImageProvider().generateImage(prompt)
    }
  }
}

interface GeminiTextPart { text: string }
interface GeminiInlineDataPart { inlineData: { mimeType: string; data: string } }
type GeminiPart = GeminiTextPart | GeminiInlineDataPart

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] }
  }>
}
