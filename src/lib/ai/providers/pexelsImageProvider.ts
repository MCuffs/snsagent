import type { ImageProvider } from '../imageProvider'
import { buildCommonsSearchQuery } from './freeStockImageProvider'

interface PexelsPhoto {
  id: number
  width: number
  height: number
  alt?: string
  src?: {
    original?: string
    large2x?: string
    large?: string
    portrait?: string
    landscape?: string
  }
}

interface PexelsSearchResponse {
  photos?: PexelsPhoto[]
}

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search'
const cache = new Map<string, string>()

export class PexelsImageProvider implements ImageProvider {
  private apiKey: string

  constructor(apiKey = process.env.PEXELS_API_KEY) {
    if (!apiKey) {
      throw new Error('PEXELS_API_KEY is not configured. Image generation providers are disabled; configure Pexels before creating carousel images.')
    }
    this.apiKey = apiKey
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const query = buildPexelsSearchQuery(prompt)
    const cacheKey = `${query}:${options?.size || ''}`
    const cached = cache.get(cacheKey)
    if (cached) return { imageUrl: cached }

    const imageUrl = await searchPexels(query, this.apiKey)
    if (imageUrl) {
      cache.set(cacheKey, imageUrl)
      return { imageUrl }
    }

    throw new Error(`No usable Pexels image was found for query "${query}". Image generation fallback is disabled.`)
  }
}

export function buildPexelsSearchQuery(prompt: string) {
  return buildCommonsSearchQuery(prompt)
}

async function searchPexels(query: string, apiKey: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs())

  try {
    const params = new URLSearchParams({
      query,
      orientation: 'portrait',
      per_page: '20',
      size: 'large',
    })

    const response = await fetch(`${PEXELS_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        'User-Agent': 'Shuffla/1.0',
      },
    })
    if (!response.ok) return null

    const data = await response.json() as PexelsSearchResponse
    const candidates = (data.photos || [])
      .filter(isUsablePhoto)
      .sort((a, b) => scorePexelsPhoto(b, query) - scorePexelsPhoto(a, query))

    const best = candidates[0]
    return best?.src?.large2x || best?.src?.portrait || best?.src?.large || best?.src?.original || null
  } finally {
    clearTimeout(timeout)
  }
}

function isUsablePhoto(photo: PexelsPhoto) {
  if (!photo.src) return false
  if (photo.width < 640 || photo.height < 640) return false
  const ratio = photo.width / photo.height
  return ratio >= 0.45 && ratio <= 1.8
}

function scorePexelsPhoto(photo: PexelsPhoto, query: string) {
  const haystack = `${photo.alt || ''}`.toLowerCase()
  const tokens = query.split(/\s+/).filter(Boolean)
  const matches = tokens.filter(token => haystack.includes(token)).length
  const ratio = photo.width / photo.height
  const portraitScore = ratio >= 0.65 && ratio <= 0.9 ? 8 : 0
  const sizeScore = Math.min(6, Math.round(Math.max(photo.width, photo.height) / 900))
  return matches * 8 + portraitScore + sizeScore
}

function getTimeoutMs() {
  const value = Number(process.env.PEXELS_TIMEOUT_MS || process.env.FREE_STOCK_TIMEOUT_MS || 2500)
  return Number.isFinite(value) ? Math.max(300, Math.min(value, 6000)) : 2500
}
