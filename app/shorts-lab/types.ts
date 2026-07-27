// Shorts Lab — 독립 데모용 타입. Shuffla 도메인 타입과 의존관계 없음.

export type LicenseKind = 'creativeCommon' | 'youtube'

export type TemplateId =
  | 'comment-capture'
  | 'dark-red'
  | 'white-yellow'
  | 'dark-minimal'
  | 'paper'

export interface TrendingVideo {
  id: string
  title: string
  channelTitle: string
  durationSec: number
  viewCount: number
  publishedLabel: string
  category: string
  license: LicenseKind
  embeddable: boolean
  regionBlocked: boolean
  /** 실 API 모드에서는 i.ytimg.com 썸네일, 픽스처 모드에서는 null(그라데이션 대체) */
  thumbnailUrl: string | null
  /** 픽스처 데이터인지 실제 YouTube Data API 응답인지 */
  source: 'fixture' | 'youtube-api'
}

export interface CapturedComment {
  author: string
  text: string
  likeCount: number
  publishedLabel: string
  /** YouTube 프로필 이미지. 픽스처 댓글은 null */
  avatarUrl?: string | null
}

/** 댓글 출처 — 실제 API / 픽스처 / 댓글 없음(비활성화) */
export type CommentSource = 'youtube-api' | 'fixture' | 'none'

export interface EligibilityCheck {
  id: string
  label: string
  ok: boolean
  detail: string
  /** 통과하지 못해도 이용자 확인으로 넘길 수 있는 항목인지 */
  overridable: boolean
}

export interface ShortClip
{
  id: string
  index: number
  startSec: number
  endSec: number
  /** 0~100 훅 점수 */
  score: number
  hookTitle: string
  subtitleLines: string[]
  reason: string
  comment: CapturedComment | null
}

export interface GenerateOptions {
  videoId: string
  template: TemplateId
  withCommentCapture: boolean
}

export type StageStatus = 'pending' | 'running' | 'done'

export interface StageEvent {
  type: 'stage'
  id: string
  label: string
  detail: string
  status: StageStatus
}

export interface ResultEvent {
  type: 'result'
  video: TrendingVideo
  clips: ShortClip[]
  usedMinutes: number
  engine: string
  commentSource: CommentSource
  commentNotice: string | null
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type PipelineEvent = StageEvent | ResultEvent | ErrorEvent
