import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../env'

export interface ImageProvider {
  generateImage(prompt: string): Promise<{ imageUrl: string }>
}

/**
 * MockImageProvider returns beautiful, high-quality stock imagery placeholders 
 * from Unsplash matching keywords in the prompt, or abstract gradient layouts.
 */
export class MockImageProvider implements ImageProvider {
  async generateImage(prompt: string): Promise<{ imageUrl: string }> {
    const lowercasePrompt = prompt.toLowerCase()
    
    // Choose curated stock images based on keywords in the prompt
    let category = 'abstract'
    if (lowercasePrompt.includes('cyberpunk') || lowercasePrompt.includes('neon')) {
      category = 'cyberpunk'
    } else if (lowercasePrompt.includes('minimalist') || lowercasePrompt.includes('scandinavian') || lowercasePrompt.includes('clean')) {
      category = 'minimalist'
    } else if (lowercasePrompt.includes('gradient') || lowercasePrompt.includes('fluid')) {
      category = 'gradient'
    } else if (lowercasePrompt.includes('vector') || lowercasePrompt.includes('flat') || lowercasePrompt.includes('illustration')) {
      category = 'vector'
    } else if (lowercasePrompt.includes('photo') || lowercasePrompt.includes('studio') || lowercasePrompt.includes('photorealistic')) {
      category = 'photo'
    } else if (lowercasePrompt.includes('gym') || lowercasePrompt.includes('workout') || lowercasePrompt.includes('body')) {
      category = 'fitness'
    } else if (lowercasePrompt.includes('coffee') || lowercasePrompt.includes('cafe') || lowercasePrompt.includes('barista')) {
      category = 'coffee'
    } else if (lowercasePrompt.includes('clinic') || lowercasePrompt.includes('skin') || lowercasePrompt.includes('beauty')) {
      category = 'skincare'
    } else if (lowercasePrompt.includes('tech') || lowercasePrompt.includes('office') || lowercasePrompt.includes('business')) {
      category = 'business'
    }

    const images: Record<string, string[]> = {
      cyberpunk: [
        'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1080&auto=format&fit=crop',
      ],
      minimalist: [
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?q=80&w=1080&auto=format&fit=crop',
      ],
      gradient: [
        'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1080&auto=format&fit=crop',
      ],
      vector: [
        'https://images.unsplash.com/photo-1618005198143-e528346d9a59?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=1080&auto=format&fit=crop',
      ],
      photo: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1080&auto=format&fit=crop',
      ],
      fitness: [
        'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1080&auto=format&fit=crop',
      ],
      coffee: [
        'https://images.unsplash.com/photo-1498804103079-a6351b050096?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1442512595331-e89e73853f31?q=80&w=1080&auto=format&fit=crop',
      ],
      skincare: [
        'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1608248597481-496100c80836?q=80&w=1080&auto=format&fit=crop',
      ],
      business: [
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1080&auto=format&fit=crop',
      ],
      abstract: [
        'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1080&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1080&auto=format&fit=crop',
      ],
    }

    const list = images[category] || images.abstract
    // Pick a random image from the list
    const randomIndex = Math.floor(Math.random() * list.length)
    const imageUrl = list[randomIndex]

    // Simulate small API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    return { imageUrl }
  }
}

/**
 * OpenAIImageProvider integrates with DALL-E 3 API to generate images.
 */
export class OpenAIImageProvider implements ImageProvider {
  private openai: OpenAI

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!isConfiguredOpenAIKey(apiKey)) {
      throw new Error('OpenAI API Key is missing for OpenAIImageProvider')
    }
    this.openai = new OpenAI({ apiKey })
  }

  async generateImage(prompt: string): Promise<{ imageUrl: string }> {
    try {
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: `${prompt}, square instagram layout, empty central space for text overlay, photorealistic, professional brand style`,
        n: 1,
        size: '1024x1024',
      })
      const imageUrl = response.data?.[0]?.url || ''
      return { imageUrl }
    } catch (err) {
      console.error('DALL-E image generation failed, falling back to mock image', err)
      const mock = new MockImageProvider()
      return mock.generateImage(prompt)
    }
  }
}

/**
 * ByteDanceImageProvider is a placeholder for future Doubao / ByteDance image generation integration.
 */
export class ByteDanceImageProvider implements ImageProvider {
  // TODO: Add ByteDance Client API Credentials to constructor
  // constructor(private apiKey: string, private appId: string) {}

  async generateImage(prompt: string): Promise<{ imageUrl: string }> {
    // TODO: Integrate ByteDance text-to-image API.
    // Example endpoint: POST https://open.volcengineapi.com/api/v1/image/generate
    // Headers: Authorization: Bearer <API_KEY>
    // Body: { "model": "doubao-image-v2", "prompt": prompt, "width": 1024, "height": 1024 }
    console.log('ByteDanceImageProvider placeholder called with prompt:', prompt)
    
    // For now, fall back to Mock provider to ensure execution doesn't fail
    const mock = new MockImageProvider()
    return mock.generateImage(prompt)
  }
}

/**
 * Helper factory to get configured image provider based on environment variables
 */
export function getImageProvider(): ImageProvider {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!isConfiguredOpenAIKey(apiKey)) {
    console.log('Using MockImageProvider (OpenAI Key not set)')
    return new MockImageProvider()
  }

  try {
    return new OpenAIImageProvider()
  } catch (err) {
    console.error('Failed to initialize OpenAIImageProvider, using Mock', err)
    return new MockImageProvider()
  }
}
