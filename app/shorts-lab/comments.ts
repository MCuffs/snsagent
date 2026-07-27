import { FIXTURE_COMMENTS } from './fixtures'
import { relativeLabel } from './pipeline'
import type { CapturedComment, CommentSource } from './types'

// 4단계: 인기 댓글 수집
//
// commentThreads.list (1 유닛) 로 상위 댓글을 받아 좋아요 순으로 정렬합니다.
// order=relevance 는 좋아요 순이 아니라 유튜브의 자체 관련도 순이라,
// "인기 댓글"을 원하면 받아온 뒤 likeCount 로 다시 정렬해야 합니다.

export interface CommentPool {
  comments: CapturedComment[]
  source: CommentSource
  notice: string | null
}

interface CommentThreadItem {
  snippet?: {
    topLevelComment?: {
      snippet?: {
        authorDisplayName?: string
        authorProfileImageUrl?: string
        textOriginal?: string
        textDisplay?: string
        likeCount?: number
        publishedAt?: string
      }
    }
  }
}

interface YouTubeErrorPayload {
  error?: { message?: string; errors?: { reason?: string }[] }
}

/** 캡처에 쓸 수 없는 댓글 걸러내기 — 너무 길거나 링크만 있는 것 */
function isUsable(text: string): boolean {
  if (text.length < 2 || text.length > 90) return false
  if (/https?:\/\//i.test(text)) return false
  return true
}

export async function loadTopComments(
  videoId: string,
  take = 12,
): Promise<CommentPool> {
  const apiKey = process.env.YOUTUBE_API_KEY

  // 픽스처 영상은 실제 videoId 가 아니므로 API 를 호출하지 않습니다.
  if (!apiKey || videoId.startsWith('fx_')) {
    return {
      comments: FIXTURE_COMMENTS,
      source: 'fixture',
      notice: apiKey
        ? '픽스처 영상이라 데모 댓글을 사용했습니다.'
        : 'YOUTUBE_API_KEY 가 없어 데모 댓글을 사용했습니다.',
    }
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('videoId', videoId)
  url.searchParams.set('order', 'relevance')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('textFormat', 'plainText')
  url.searchParams.set('key', apiKey)

  try {
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as YouTubeErrorPayload | null
      const reason = payload?.error?.errors?.[0]?.reason ?? String(res.status)

      // 댓글을 끈 영상은 정상적인 상태입니다 — 폴백하지 않고 "댓글 없음"으로 둡니다.
      if (reason === 'commentsDisabled') {
        return {
          comments: [],
          source: 'none',
          notice: '이 영상은 댓글이 비활성화되어 있어 댓글 캡처를 건너뜁니다.',
        }
      }

      return {
        comments: FIXTURE_COMMENTS,
        source: 'fixture',
        notice: `댓글 조회 실패(${reason})로 데모 댓글로 폴백했습니다.`,
      }
    }

    const json = (await res.json()) as { items?: CommentThreadItem[] }
    const now = Date.now()

    const comments: CapturedComment[] = (json.items ?? [])
      .flatMap(item => {
        const s = item.snippet?.topLevelComment?.snippet
        if (!s) return []
        const text = (s.textOriginal ?? s.textDisplay ?? '').replace(/\s+/g, ' ').trim()
        if (!isUsable(text)) return []
        return [
          {
            author: s.authorDisplayName ?? '@unknown',
            text,
            likeCount: s.likeCount ?? 0,
            publishedLabel: relativeLabel(s.publishedAt, now),
            avatarUrl: s.authorProfileImageUrl ?? null,
          },
        ]
      })
      // relevance 순 → 좋아요 순으로 재정렬해 "인기 댓글"에 맞춥니다.
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, take)

    if (comments.length === 0) {
      return {
        comments: [],
        source: 'none',
        notice: '캡처에 쓸 만한 댓글을 찾지 못했습니다.',
      }
    }

    return { comments, source: 'youtube-api', notice: null }
  } catch (error) {
    return {
      comments: FIXTURE_COMMENTS,
      source: 'fixture',
      notice: `댓글 조회 오류로 데모 댓글로 폴백했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}
