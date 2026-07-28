import { FIXTURE_VIDEOS } from './fixtures'
import { parseIsoDuration, relativeLabel } from './pipeline'
import type { LicenseKind, TrendingVideo } from './types'

// 1단계: 실시간 유튜브 롱폼 인기 영상 로딩
//
// YOUTUBE_API_KEY 가 설정되어 있으면 YouTube Data API v3 인기 차트를 실제로 조회하고,
// 없으면 픽스처 데이터로 응답합니다. 두 경로의 반환 스키마가 같으므로 UI 는 그대로 동작합니다.
// page.tsx(서버 컴포넌트)와 api/trending/route.ts(새로고침)에서 함께 사용합니다.

export interface TrendingResult {
  mode: 'fixture' | 'youtube-api'
  notice: string | null
  videos: TrendingVideo[]
  fetchedAtLabel: string
  criteriaLabel: string
}

const CATEGORY_LABELS: Record<string, string> = {
  '1': '영화·애니메이션',
  '10': '음악',
  '17': '스포츠',
  '20': '게임',
  '22': '인물·블로그',
  '23': '코미디',
  '24': '엔터테인먼트',
  '25': '뉴스·정치',
  '26': '요리·노하우',
  '27': '교육',
  '28': '과학·기술',
}

interface YouTubeVideoItem {
  id: string
  snippet?: {
    title?: string
    channelTitle?: string
    channelId?: string
    publishedAt?: string
    categoryId?: string
    thumbnails?: Record<string, { url?: string } | undefined>
  }
  contentDetails?: {
    duration?: string
    regionRestriction?: { blocked?: string[] }
  }
  status?: { license?: string; embeddable?: boolean }
  statistics?: { viewCount?: string }
}

interface YouTubeSearchItem {
  id?: { videoId?: string }
}

function toTrendingVideo(item: YouTubeVideoItem, now: number): TrendingVideo {
  const thumbs = item.snippet?.thumbnails ?? {}
  const thumbnailUrl =
    thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? null
  const categoryId = item.snippet?.categoryId ?? ''
  const license: LicenseKind =
    item.status?.license === 'creativeCommon' ? 'creativeCommon' : 'youtube'

  return {
    id: item.id,
    title: item.snippet?.title ?? '(제목 없음)',
    channelTitle: item.snippet?.channelTitle ?? '(채널 없음)',
    channelId: item.snippet?.channelId ?? null,
    durationSec: parseIsoDuration(item.contentDetails?.duration ?? ''),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    publishedLabel: relativeLabel(item.snippet?.publishedAt, now),
    category: CATEGORY_LABELS[categoryId] ?? '기타',
    license,
    embeddable: item.status?.embeddable !== false,
    regionBlocked: Boolean(item.contentDetails?.regionRestriction?.blocked?.length),
    thumbnailUrl,
    source: 'youtube-api',
  }
}

async function fetchMostPopular(apiKey: string): Promise<TrendingVideo[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,contentDetails,status,statistics')
  url.searchParams.set('chart', 'mostPopular')
  url.searchParams.set('regionCode', 'KR')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`YouTube Data API ${res.status}: ${await res.text()}`)
  }

  const json = (await res.json()) as { items?: YouTubeVideoItem[] }
  const now = Date.now()
  return (json.items ?? []).map(item => toTrendingVideo(item, now))
}

async function fetchVideoDetails(
  apiKey: string,
  ids: string[],
): Promise<TrendingVideo[]> {
  const uniqueIds = [...new Set(ids)].slice(0, 50)
  if (uniqueIds.length === 0) return []

  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,contentDetails,status,statistics')
  url.searchParams.set('id', uniqueIds.join(','))
  url.searchParams.set('key', apiKey)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`YouTube Data API ${res.status}: ${await res.text()}`)
  }

  const json = (await res.json()) as { items?: YouTubeVideoItem[] }
  const now = Date.now()
  return (json.items ?? []).map(item => toTrendingVideo(item, now))
}

async function searchCreativeCommons(
  apiKey: string,
  videoDuration: 'medium' | 'long',
): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')

  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('q', '한국')
  url.searchParams.set('order', 'viewCount')
  url.searchParams.set('regionCode', 'KR')
  url.searchParams.set('relevanceLanguage', 'ko')
  url.searchParams.set('maxResults', '25')
  url.searchParams.set('safeSearch', 'moderate')
  url.searchParams.set('videoDuration', videoDuration)
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('videoLicense', 'creativeCommon')
  url.searchParams.set('key', apiKey)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`YouTube CC 검색 ${res.status}: ${await res.text()}`)
  }

  const json = (await res.json()) as { items?: YouTubeSearchItem[] }
  return (json.items ?? [])
    .map(item => item.id?.videoId)
    .filter((id): id is string => Boolean(id))
}

async function fetchCreativeCommonsLongform(
  apiKey: string,
): Promise<TrendingVideo[]> {
  // YouTube 검색의 medium은 4~20분, long은 20분 초과입니다.
  // 상세 조회 후 Shorts Lab의 정확한 3~60분 기준으로 다시 거릅니다.
  const [mediumIds, longIds] = await Promise.all([
    searchCreativeCommons(apiKey, 'medium'),
    searchCreativeCommons(apiKey, 'long'),
  ])
  const videos = await fetchVideoDetails(apiKey, [...mediumIds, ...longIds])

  return videos
    .filter(
      video =>
        video.license === 'creativeCommon' &&
        video.embeddable &&
        video.durationSec >= 180 &&
        video.durationSec <= 3_600,
    )
    .sort((a, b) => b.viewCount - a.viewCount)
}

function mergeUnique(
  popular: TrendingVideo[],
  reusable: TrendingVideo[],
): TrendingVideo[] {
  const seen = new Set(popular.map(video => video.id))
  return [...popular, ...reusable.filter(video => !seen.has(video.id))]
}

const FIXTURE_RESULT = (notice: string | null): TrendingResult => ({
  mode: 'fixture',
  notice,
  videos: FIXTURE_VIDEOS,
  fetchedAtLabel: '픽스처 스냅샷',
  criteriaLabel: '데모 데이터 · 3~60분 및 CC 필터 검증용',
})

export async function loadTrending(): Promise<TrendingResult> {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey) {
    return FIXTURE_RESULT(
      'YOUTUBE_API_KEY 가 없어 픽스처 데이터로 동작합니다. 키를 넣으면 같은 화면이 실제 인기 차트로 바뀝니다.',
    )
  }

  try {
    const popular = await fetchMostPopular(apiKey)
    let reusable: TrendingVideo[] = []
    let notice: string | null = null

    try {
      reusable = await fetchCreativeCommonsLongform(apiKey)
    } catch (error) {
      notice =
        '재사용 가능 영상 확장 검색에 실패해 한국 인기 차트만 표시합니다. ' +
        (error instanceof Error ? error.message : String(error))
    }

    return {
      mode: 'youtube-api',
      notice,
      videos: mergeUnique(popular, reusable),
      fetchedAtLabel: `조회 ${new Date().toLocaleTimeString('ko-KR', { hour12: false })}`,
      criteriaLabel: `한국 인기 차트 50개 + CC 조회수 상위 롱폼 ${reusable.length}개`,
    }
  } catch (error) {
    // 실 API 실패 시에도 데모가 멈추지 않도록 픽스처로 폴백
    return FIXTURE_RESULT(
      `YouTube Data API 호출 실패로 픽스처로 폴백했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}
