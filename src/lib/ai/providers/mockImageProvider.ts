import type { ImageProvider } from '../imageProvider'

const PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1080&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1080&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1080&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1080&auto=format&fit=crop',
]

export class MockImageProvider implements ImageProvider {
  async generateImage(prompt: string): Promise<{ imageUrl: string }> {
    const index = Math.abs([...prompt].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % PLACEHOLDERS.length
    return { imageUrl: PLACEHOLDERS[index] }
  }
}
