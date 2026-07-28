'use client'

import { useState } from 'react'
import { formatDuration, formatLikes, splitHook } from './pipeline'
import type { ShortClip, TemplateId, TrendingVideo } from './types'

// 9:16 프리뷰 렌더러.
//
// 이지컷 템플릿 라이브러리의 구조를 따릅니다. 5종이 모두 같은 레이아웃을 쓰고
// 훅 둘째 줄의 색 처리만 다릅니다:
//   [훅 2줄 중앙정렬] → [영상 밴드 풀블리드] → [(댓글 카드)] → [하단 중앙 워터마크]
//
// 실제 mp4 렌더가 아니라 최종 결과물 구성을 확인하는 합성 미리보기입니다.

interface TemplateSpec {
  id: TemplateId
  label: string
  hint: string
  /** 댓글 카드·워터마크에 쓸 명암 톤 */
  tone: 'light' | 'dark'
}

export const TEMPLATES: TemplateSpec[] = [
  { id: 'comment-capture', label: '댓글 캡처', hint: '인기 댓글을 화면에 얹는 구성', tone: 'dark' },
  { id: 'dark-red', label: '다크 레드', hint: '강한 레드 포인트로 핵심 강조', tone: 'dark' },
  { id: 'white-yellow', label: '화이트 옐로', hint: '밝고 친근한 전달', tone: 'light' },
  { id: 'dark-minimal', label: '다크 미니멀', hint: '장식을 덜고 영상에 집중', tone: 'dark' },
  { id: 'paper', label: '페이퍼', hint: '차분하고 신뢰감 있는 톤', tone: 'light' },
]

const TONE_OF: Record<TemplateId, 'light' | 'dark'> = TEMPLATES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t.tone }),
  {} as Record<TemplateId, 'light' | 'dark'>,
)

function hueOf(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 360
  }
  return h
}


/**
 * 하이라이트 구간을 YouTube IFrame 플레이어로 재생합니다.
 * 원본을 내려받지 않고 start/end 파라미터로 해당 구간만 재생합니다.
 */
function embedUrl(videoId: string, clip: ShortClip): string {
  const params = new URLSearchParams({
    start: String(clip.startSec),
    end: String(clip.endSec),
    autoplay: '1',
    // 브라우저 자동재생 정책상 음소거 상태여야 자동으로 시작됩니다.
    mute: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

function VideoBand({ video, clip }: { video: TrendingVideo; clip: ShortClip }) {
  const [playing, setPlaying] = useState(false)
  // 픽스처 영상은 실제 videoId 가 아니라 재생할 수 없습니다.
  const canPlay = video.source === 'youtube-api' && video.embeddable

  const hue = hueOf(video.id)
  const style = video.thumbnailUrl
    ? {
        backgroundImage: `url(${video.thumbnailUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        background: `linear-gradient(145deg, hsl(${hue} 12% 34%), hsl(${hue} 10% 22%))`,
      }

  if (playing && canPlay) {
    return (
      <div className="sl-band">
        <iframe
          className="sl-embed"
          src={embedUrl(video.id, clip)}
          title={`${video.title} ${formatDuration(clip.startSec)} 구간`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
        <button type="button" className="sl-band-stop" onClick={() => setPlaying(false)}>
          ■
        </button>
      </div>
    )
  }

  return (
    <div className="sl-band" style={style}>
      {canPlay && (
        <button
          type="button"
          className="sl-band-play"
          onClick={() => setPlaying(true)}
          title="이 구간만 재생"
        >
          ▶
        </button>
      )}
      <div className="sl-band-range">
        {formatDuration(clip.startSec)} – {formatDuration(clip.endSec)}
      </div>
    </div>
  )
}

function CommentCard({ clip, tone }: { clip: ShortClip; tone: 'light' | 'dark' }) {
  if (!clip.comment) return null
  const { author, text, likeCount, publishedLabel, avatarUrl } = clip.comment

  return (
    <div className={`sl-comment sl-comment-${tone}`}>
      <div
        className="sl-comment-avatar"
        aria-hidden
        style={
          avatarUrl
            ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: 'transparent',
              }
            : undefined
        }
      >
        {author.replace('@', '').charAt(0).toUpperCase()}
      </div>
      <div className="sl-comment-body">
        <div className="sl-comment-meta">
          <span className="sl-comment-author">{author}</span>
          <span className="sl-comment-date">{publishedLabel}</span>
        </div>
        <p className="sl-comment-text">{text}</p>
        <div className="sl-comment-actions">
          <span>👍 {formatLikes(likeCount)}</span>
          <span>👎</span>
          <span>답글</span>
        </div>
      </div>
    </div>
  )
}

export default function ShortPreview({
  video,
  clip,
  template,
}: {
  video: TrendingVideo
  clip: ShortClip
  template: TemplateId
}) {
  const [line1, line2] = splitHook(clip.hookTitle)
  const tone = TONE_OF[template]

  return (
    <div className={`sl-frame sl-tpl-${template}`}>
      <div className="sl-hook">
        <span className="sl-hook-l1">{line1}</span>
        {line2 && <span className="sl-hook-l2">{line2}</span>}
      </div>

      <VideoBand video={video} clip={clip} />

      <CommentCard clip={clip} tone={tone} />

      <div className="sl-footer">
        <span className="sl-watermark-mark" aria-hidden>
          {video.channelTitle.charAt(0)}
        </span>
        <span className="sl-watermark-name">{video.channelTitle}</span>
      </div>
    </div>
  )
}
