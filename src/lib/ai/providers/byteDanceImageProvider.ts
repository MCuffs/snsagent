import type { ImageProvider } from '../imageProvider'

export class ByteDanceImageProvider implements ImageProvider {
  constructor(private apiKey = process.env.BYTEDANCE_API_KEY) {}

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    void prompt
    void options
    void this.apiKey
    throw new Error('ByteDance image generation is not implemented. Use OpenAI, Gemini, or IMAGE_PROVIDER=mock for local development.')
  }
}
