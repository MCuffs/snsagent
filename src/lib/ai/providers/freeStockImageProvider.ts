import type { ImageProvider } from '../imageProvider.ts'
import { sanitizeImagePrompt } from '../imageProvider.ts'

interface CommonsImageInfo {
  url?: string
  thumburl?: string
  mime?: string
  width?: number
  height?: number
}

interface CommonsPage {
  title?: string
  imageinfo?: CommonsImageInfo[]
}

interface CommonsSearchResponse {
  query?: {
    pages?: Record<string, CommonsPage>
  }
}

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const COMMONS_CORE_SEARCH_URL = 'https://api.wikimedia.org/core/v1/commons/search/page'
const cache = new Map<string, string>()

interface CoreSearchPage {
  key?: string
  title?: string
  excerpt?: string
  thumbnail?: {
    mimetype?: string
    width?: number
    height?: number
    url?: string
  } | null
}

interface CoreSearchResponse {
  pages?: CoreSearchPage[]
}

const STOPWORDS = new Set([
  'background', 'image', 'photo', 'photograph', 'only', 'clean', 'empty', 'space', 'layout',
  'frame', 'instagram', 'carousel', 'card', 'news', 'text', 'typography', 'headline', 'body',
  'slide', 'visual', 'direction', 'editorial', 'professional', 'brand', 'style', 'mood',
  'dark', 'light', 'minimal', 'high', 'contrast', 'no', 'without', 'avoid', 'blank',
  '카드뉴스', '배경', '이미지', '사진', '텍스트', '문구', '제목', '본문', '슬라이드', '공간',
])

const KO_TO_EN_KEYWORDS: Array<[RegExp, string]> = [
  [/호두|월넛/u, 'walnut'],
  [/견과|견과류/u, 'nuts'],
  [/아몬드/u, 'almond'],
  [/캐슈/u, 'cashew'],
  [/피스타치오/u, 'pistachio'],
  [/식단|식사|섭취/u, 'meal'],
  [/간식/u, 'snack'],
  [/커피|카페/u, 'coffee'],
  [/뷰티|피부|화장품/u, 'skincare'],
  [/운동|헬스|피트니스/u, 'fitness'],
  [/비즈니스|업무|직장/u, 'business'],
  [/기술|테크|인공지능|AI/u, 'technology'],
  [/시사|트렌드/u, 'news'],
  [/여행/u, 'travel'],
  [/패션|의류/u, 'fashion'],
  [/가방/u, 'bag'],
]

export class FreeStockImageProvider implements ImageProvider {
  private fallback?: ImageProvider

  constructor(fallback?: ImageProvider) {
    this.fallback = fallback
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] }
  ): Promise<{ imageUrl: string }> {
    const query = buildCommonsSearchQuery(prompt)
    const cacheKey = `${query}:${options?.size || ''}`
    const cached = cache.get(cacheKey)
    if (cached) return { imageUrl: cached }

    try {
      const imageUrl = await searchWikimediaCore(query, prompt) || await searchWikimediaCommons(query, prompt)
      if (imageUrl) {
        cache.set(cacheKey, imageUrl)
        return { imageUrl }
      }
    } catch (error) {
      console.warn('[FreeStockImageProvider] Stock search failed', error)
    }

    if (this.fallback) {
      return this.fallback.generateImage(prompt, options)
    }

    throw new Error('No free stock image was found for this prompt.')
  }
}

export function buildCommonsSearchQuery(prompt: string) {
  const sanitized = sanitizeImagePrompt(prompt)
  const translated = KO_TO_EN_KEYWORDS
    .filter(([pattern]) => pattern.test(sanitized))
    .map(([, keyword]) => keyword)

  const tokens = sanitized
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 3 && !STOPWORDS.has(token))
    .filter(token => !/^\d+$/.test(token))

  const englishTokens = tokens.filter(token => !/[가-힣]/u.test(token))
  const foodSubject = [...translated, ...englishTokens].some(token => ['walnut', 'nuts', 'almond', 'cashew', 'pistachio', 'meal', 'snack'].includes(token))
  const visualTokens = [...translated]
  if (foodSubject) visualTokens.push('still', 'life')
  visualTokens.push(...englishTokens)

  const unique = Array.from(new Set(visualTokens))
  const subjectTokens = unique.slice(0, 4)
  const query = subjectTokens.length > 0 ? subjectTokens.join(' ') : 'abstract texture'

  return query
}

async function searchWikimediaCommons(query: string, prompt: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs())

  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '14',
      gsrsearch: query,
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: '1400',
      format: 'json',
      origin: '*',
    })
    const response = await fetch(`${COMMONS_API_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Shuffla/1.0 (https://www.shuffla.io)',
        'Api-User-Agent': 'Shuffla/1.0 (https://www.shuffla.io)',
      },
    })
    if (!response.ok) return null

    const data = await response.json() as CommonsSearchResponse
    const pages = Object.values(data.query?.pages || {})
    const candidates = pages
      .map(page => ({ page, info: page.imageinfo?.[0] }))
      .filter((item): item is { page: CommonsPage; info: CommonsImageInfo } => Boolean(item.info))
      .filter(({ info }) => isUsableImage(info))
      .sort((a, b) => scoreCommonsImage(b, prompt) - scoreCommonsImage(a, prompt))

    const best = candidates[0]?.info
    return best?.thumburl || best?.url || null
  } finally {
    clearTimeout(timeout)
  }
}

async function searchWikimediaCore(query: string, prompt: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs())

  try {
    const params = new URLSearchParams({ q: query, limit: '12' })
    const response = await fetch(`${COMMONS_CORE_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Shuffla/1.0 (https://www.shuffla.io)',
        'Api-User-Agent': 'Shuffla/1.0 (https://www.shuffla.io)',
      },
    })
    if (!response.ok) return null

    const data = await response.json() as CoreSearchResponse
    const candidates = (data.pages || [])
      .filter(page => page.thumbnail?.url)
      .filter(page => !page.thumbnail?.mimetype || ['image/jpeg', 'image/png', 'image/webp'].includes(page.thumbnail.mimetype))
      .sort((a, b) => scoreCoreImage(b, prompt) - scoreCoreImage(a, prompt))

    return upscaleWikimediaThumbnail(candidates[0]?.thumbnail?.url || null)
  } finally {
    clearTimeout(timeout)
  }
}

function isUsableImage(info: CommonsImageInfo) {
  if (!info.url && !info.thumburl) return false
  if (info.mime && !['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return false
  if ((info.width || 0) < 640 || (info.height || 0) < 640) return false
  return true
}

function scoreCommonsImage(candidate: { page: CommonsPage; info: CommonsImageInfo }, prompt: string) {
  const title = (candidate.page.title || '').toLowerCase()
  const promptTokens = buildCommonsSearchQuery(prompt)
    .split(/\s+/)
    .filter(Boolean)
  const titleMatches = promptTokens.filter(token => title.includes(token)).length
  const width = candidate.info.width || 1
  const height = candidate.info.height || 1
  const ratio = width / height
  const layoutScore = ratio >= 0.6 && ratio <= 1.8 ? 4 : 0
  const sizeScore = Math.min(5, Math.round(Math.max(width, height) / 900))
  return titleMatches * 8 + layoutScore + sizeScore
}

function scoreCoreImage(page: CoreSearchPage, prompt: string) {
  const haystack = `${page.title || ''} ${page.key || ''} ${page.excerpt || ''}`.toLowerCase()
  const promptTokens = buildCommonsSearchQuery(prompt).split(/\s+/).filter(Boolean)
  const matches = promptTokens.filter(token => haystack.includes(token)).length
  const width = page.thumbnail?.width || 1
  const height = page.thumbnail?.height || 1
  const ratio = width / height
  const layoutScore = ratio >= 0.6 && ratio <= 1.8 ? 4 : 0
  return matches * 8 + layoutScore
}

function upscaleWikimediaThumbnail(url: string | null) {
  if (!url) return null
  return url.replace(/\/\d+px-([^/]+)$/u, '/1400px-$1')
}

function getTimeoutMs() {
  const value = Number(process.env.FREE_STOCK_TIMEOUT_MS || 2500)
  return Number.isFinite(value) ? Math.max(300, Math.min(value, 5000)) : 2500
}
