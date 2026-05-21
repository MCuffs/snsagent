import type { ImageProvider } from '../imageProvider'
import { MockImageProvider } from './mockImageProvider'

export class ByteDanceImageProvider implements ImageProvider {
  constructor(private apiKey = process.env.BYTEDANCE_API_KEY) {}

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    if (!this.apiKey) {
      return new MockImageProvider().generateImage(prompt)
    }

    // TODO: Replace with the official ByteDance/Volcengine image API request
    // once the exact endpoint, auth signing, and model parameters are fixed.
    // Keep this provider behind the ImageProvider interface so the pipeline
    // can switch models without changing carousel generation logic.
    void options
    return new MockImageProvider().generateImage(prompt)
  }
}
