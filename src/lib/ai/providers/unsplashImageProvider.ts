import type { ImageProvider } from '../imageProvider'
import { uploadGeneratedAsset } from '../../storage/upload'

const UNSPLASH_BASE = 'https://api.unsplash.com'

interface UnsplashPhoto {
  id: string
  urls: { regular: string; full: string }
  links: { download_location: string }
}

// Prompt → Unsplash 검색 키워드 추출
export function extractUnsplashQuery(prompt: string, productName?: string): string {
  const lower = prompt.toLowerCase()

  // 슬라이드 역할별 키워드 매핑
  if (lower.includes('dramatic hero') || lower.includes('cinematic composition')) {
    return buildQuery(productName, 'product lifestyle editorial')
  }
  if (lower.includes('moody') || lower.includes('frustration') || lower.includes('desaturated')) {
    return buildQuery(null, 'moody lifestyle minimal')
  }
  if (lower.includes('abstract conceptual') || lower.includes('geometric')) {
    return buildQuery(null, 'abstract minimal clean')
  }
  if (lower.includes('cautionary') || lower.includes('warning')) {
    return buildQuery(null, 'minimal flat lay detail')
  }
  if (lower.includes('solution') || lower.includes('uplifting') || lower.includes('warm tones')) {
    return buildQuery(productName, 'lifestyle product bright')
  }
  if (lower.includes('close-up detail') || lower.includes('technical precision')) {
    return buildQuery(productName, 'product detail macro')
  }
  if (lower.includes('authentic lifestyle') || lower.includes('candid')) {
    return buildQuery(null, 'lifestyle authentic warm')
  }
  if (lower.includes('flatlay') || lower.includes('flat lay') || lower.includes('elegant')) {
    return buildQuery(productName, 'product flatlay minimal')
  }
  if (lower.includes('inviting') || lower.includes('airy')) {
    return buildQuery(productName, 'lifestyle bright airy')
  }

  // 업종 키워드 추출
  if (lower.includes('cosmetic') || lower.includes('skincare') || lower.includes('beauty') || lower.includes('뷰티')) {
    return buildQuery(productName, 'skincare beauty product')
  }
  if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('커피')) {
    return buildQuery(null, 'coffee minimal lifestyle')
  }
  if (lower.includes('fashion') || lower.includes('clothing') || lower.includes('패션')) {
    return buildQuery(null, 'fashion editorial minimal')
  }
  if (lower.includes('furniture') || lower.includes('interior') || lower.includes('가구')) {
    return buildQuery(null, 'interior minimal clean')
  }
  if (lower.includes('food') || lower.includes('식품') || lower.includes('음식')) {
    return buildQuery(null, 'food styling minimal')
  }

  return buildQuery(productName, 'product lifestyle minimal')
}

function buildQuery(productName: string | null | undefined, fallback: string): string {
  if (!productName) return fallback
  // 한국어 제거, 영문/숫자만 사용
  const cleaned = productName.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
  const words = cleaned.split(' ').slice(0, 2).join(' ')
  return words.length > 2 ? `${words} ${fallback}` : fallback
}

export class UnsplashImageProvider implements ImageProvider {
  private readonly accessKey: string

  constructor() {
    const key = process.env.UNSPLASH_ACCESS_KEY?.trim()
    if (!key) throw new Error('UNSPLASH_ACCESS_KEY must be set')
    this.accessKey = key
  }

  async generateImage(
    prompt: string,
    options?: { size?: string; productImageUrls?: string[] },
  ): Promise<{ imageUrl: string }> {
    const query = extractUnsplashQuery(prompt)
    const photo = await this.search(query)

    // Unsplash 다운로드 이벤트 트리거 (이용약관 필수)
    await this.triggerDownload(photo.links.download_location).catch(() => undefined)

    // 1080x1350 크롭 URL 생성
    const sourceUrl = `${photo.urls.regular}&w=1080&h=1350&fit=crop&crop=entropy`

    // Blob에 저장
    const res = await fetch(sourceUrl)
    if (!res.ok) throw new Error(`Unsplash fetch failed: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const imageUrl = await uploadGeneratedAsset({
      fileName: `unsplash-${photo.id}-${Date.now()}.jpg`,
      content: buffer,
      contentType: 'image/jpeg',
    })

    return { imageUrl }
  }

  private async search(query: string): Promise<UnsplashPhoto> {
    const url = new URL(`${UNSPLASH_BASE}/photos/random`)
    url.searchParams.set('query', query)
    url.searchParams.set('orientation', 'portrait')
    url.searchParams.set('content_filter', 'high')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${this.accessKey}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Unsplash API error ${res.status}: ${err}`)
    }

    return res.json() as Promise<UnsplashPhoto>
  }

  private async triggerDownload(downloadLocation: string): Promise<void> {
    await fetch(`${downloadLocation}?client_id=${this.accessKey}`, { cache: 'no-store' })
  }
}
