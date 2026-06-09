import type { ImageProvider } from '../imageProvider'
import { sanitizeImagePrompt } from '../imageProvider'

export interface PexelsPhoto {
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

export interface PexelsBackgroundCandidate {
  id: number
  alt: string
  width: number
  height: number
  imageUrl: string
  previewUrl: string
}

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search'

// Per-process query-level cache: avoids re-fetching identical queries across slides
const queryCache = new Map<string, PexelsPhoto[]>()

const PEXELS_STOPWORDS = new Set([
  'background', 'image', 'photo', 'photograph', 'only', 'clean', 'empty', 'space', 'layout',
  'frame', 'instagram', 'carousel', 'card', 'news', 'text', 'typography', 'headline', 'body',
  'slide', 'visual', 'direction', 'editorial', 'professional', 'brand', 'style', 'mood',
  'dark', 'light', 'minimal', 'high', 'contrast', 'without', 'avoid', 'blank', 'copy',
])

const SUBJECT_KEYWORDS: Array<[RegExp, string[]]> = [
  [/AI|인공지능|기술|테크|반도체|메모리|데이터|로봇|클라우드|삼성|현대차|네이버|SK|하이닉스/u, ['technology', 'office']],
  [/기업|회사|비즈니스|시장|투자|주가|경제|협력|공급망/u, ['business', 'meeting']],
  [/식단|다이어트|건강|영양|단백질|채소|식사|음식/u, ['healthy', 'food']],
  [/화장품|뷰티|피부|스킨케어|선크림|메이크업/u, ['skincare', 'beauty']],
  [/패션|의류|가방|스타일|코디/u, ['fashion', 'style']],
  [/여행|호텔|휴가|공항|도시/u, ['travel', 'city']],
  [/운동|피트니스|헬스|러닝|요가/u, ['fitness', 'workout']],
  [/카페|커피|디저트|베이커리/u, ['coffee', 'cafe']],
  [/교육|강의|학습|체크리스트|가이드/u, ['workspace', 'notebook']],
]

const STYLE_KEYWORDS: Array<[RegExp, string[]]> = [
  [/minimal|clean|미니멀|깔끔|여백/u, ['minimal']],
  [/dark|editorial|bold|다크|강렬|에디토리얼/u, ['editorial']],
  [/warm|lifestyle|감성|따뜻/u, ['lifestyle']],
  [/modern|professional|전문|신뢰/u, ['modern']],
]

const UNIVERSAL_PEXELS_QUERIES = [
  'modern workspace',
  'business background',
  'abstract texture',
]

export class PexelsImageProvider implements ImageProvider {
  private apiKey: string
  // Tracks used photo IDs within a single generation run to guarantee unique backgrounds
  private usedPhotoIds = new Set<number>()

  constructor(apiKey = process.env.PEXELS_API_KEY) {
    if (!apiKey) {
      throw new Error('PEXELS_API_KEY is not configured. Image generation providers are disabled; configure Pexels before creating carousel images.')
    }
    this.apiKey = apiKey
  }

  /** Reset used-photo tracking between carousel generation runs */
  resetUsedPhotos() {
    this.usedPhotoIds.clear()
  }

  async generateImage(
    prompt: string,
    _options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const queries = buildPexelsSearchQueries(prompt)

    // Fetch all queries in parallel, using the per-process cache for dedup
    const allPhotosPerQuery = await Promise.all(
      queries.map(q => searchPexelsPhotos(q, this.apiKey, 30).catch(() => [] as PexelsPhoto[]))
    )

    // Merge, deduplicate by photo id
    const seen = new Map<number, PexelsPhoto>()
    for (const photos of allPhotosPerQuery) {
      for (const photo of photos) {
        if (!seen.has(photo.id)) seen.set(photo.id, photo)
      }
    }

    // Sort by score against the primary query
    const primaryQuery = queries[0]
    const ranked = [...seen.values()].sort(
      (a, b) => scorePexelsPhoto(b, primaryQuery) - scorePexelsPhoto(a, primaryQuery)
    )

    // Pick the first photo not already used in this run
    for (const photo of ranked) {
      if (this.usedPhotoIds.has(photo.id)) continue
      const imageUrl = photo.src?.large2x || photo.src?.portrait || photo.src?.large || photo.src?.original
      if (!imageUrl) continue
      this.usedPhotoIds.add(photo.id)
      return { imageUrl }
    }

    // All candidates exhausted — relax uniqueness and return best available
    const best = ranked[0]
    if (best) {
      const imageUrl = best.src?.large2x || best.src?.portrait || best.src?.large || best.src?.original
      if (imageUrl) {
        this.usedPhotoIds.add(best.id)
        return { imageUrl }
      }
    }

    throw new Error(`No usable Pexels image was found for queries "${queries.join(', ')}". Image generation fallback is disabled.`)
  }
}

export function buildPexelsSearchQuery(prompt: string) {
  return buildPexelsSearchQueries(prompt)[0]
}

export function buildPexelsSearchQueries(prompt: string) {
  const sanitized = sanitizeImagePrompt(prompt)
  const translated = [
    ...SUBJECT_KEYWORDS.flatMap(([pattern, keywords]) => pattern.test(sanitized) ? keywords : []),
    ...STYLE_KEYWORDS.flatMap(([pattern, keywords]) => pattern.test(sanitized) ? keywords : []),
  ]

  const englishTokens = sanitized
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 3)
    .filter(token => !PEXELS_STOPWORDS.has(token))
    .filter(token => !/^\d+$/.test(token))
    .filter(token => !/[가-힣]/u.test(token))
    .slice(0, 5)

  const primaryTokens = Array.from(new Set([...translated, ...englishTokens])).slice(0, 4)
  const primary = primaryTokens.length > 0 ? primaryTokens.join(' ') : 'modern workspace'
  const subjectOnly = translated.length > 0 ? Array.from(new Set(translated)).slice(0, 3).join(' ') : ''

  return Array.from(new Set([
    primary,
    subjectOnly,
    ...UNIVERSAL_PEXELS_QUERIES,
  ].filter(Boolean)))
}

export async function searchPexelsBackgroundCandidates(prompt: string, apiKey = process.env.PEXELS_API_KEY, limit = 12) {
  if (!apiKey) throw new Error('PEXELS_API_KEY is not configured.')
  const queries = buildPexelsSearchQueries(prompt)

  // Fetch all queries in parallel
  const allResults = await Promise.all(
    queries.map(q => searchPexelsPhotos(q, apiKey, Math.max(limit, 12)).catch(() => [] as PexelsPhoto[]))
  )

  const seen = new Set<number>()
  const candidates: PexelsBackgroundCandidate[] = []
  for (const photos of allResults) {
    for (const photo of photos) {
      if (seen.has(photo.id)) continue
      const imageUrl = photo.src?.large2x || photo.src?.portrait || photo.src?.large || photo.src?.original
      const previewUrl = photo.src?.portrait || photo.src?.large || imageUrl
      if (!imageUrl || !previewUrl) continue
      seen.add(photo.id)
      candidates.push({
        id: photo.id,
        alt: photo.alt || queries[0],
        width: photo.width,
        height: photo.height,
        imageUrl,
        previewUrl,
      })
      if (candidates.length >= limit) return candidates
    }
  }

  return candidates
}

async function searchPexelsPhotos(query: string, apiKey: string, perPage: number): Promise<PexelsPhoto[]> {
  const cacheKey = `${query}:${perPage}`
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs())

  try {
    const params = new URLSearchParams({
      query,
      orientation: 'portrait',
      per_page: String(Math.min(Math.max(perPage, 1), 40)),
      size: 'large',
    })

    const response = await fetch(`${PEXELS_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        'User-Agent': 'Shuffla/1.0',
      },
    })
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Pexels API rejected the configured key with status ${response.status}.`)
    }
    if (!response.ok) return []

    const data = await response.json() as PexelsSearchResponse
    const results = (data.photos || [])
      .filter(isUsablePhoto)
      .sort((a, b) => scorePexelsPhoto(b, query) - scorePexelsPhoto(a, query))

    queryCache.set(cacheKey, results)
    return results
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
  const value = Number(process.env.PEXELS_TIMEOUT_MS || process.env.FREE_STOCK_TIMEOUT_MS || 4500)
  return Number.isFinite(value) ? Math.max(1000, Math.min(value, 8000)) : 4500
}
