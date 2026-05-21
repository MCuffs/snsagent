export interface ImageProvider {
  generateImage(
    prompt: string,
    options?: {
      size?: string
      productImageUrls?: string[]
    }
  ): Promise<{ imageUrl: string }>
}
