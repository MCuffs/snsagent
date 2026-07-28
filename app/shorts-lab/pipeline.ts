import type {
  CapturedComment,
  EligibilityCheck,
  ShortClip,
  TrendingVideo,
} from './types'

export const MIN_SOURCE_SEC = 180 // 3분
export const MAX_SOURCE_SEC = 3_600 // 60분

// ── 표시 유틸 ────────────────────────────────────────────────

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatViews(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1)}억회`
  if (count >= 10_000) return `${(count / 10_000).toFixed(1)}만회`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}천회`
  return `${count}회`
}

export function formatLikes(count: number): string {
  if (count >= 10_000) return `${(count / 10_000).toFixed(1)}만`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}천`
  return String(count)
}

/** ISO 8601 타임스탬프 → "3일 전" 형태의 상대 표기 */
export function relativeLabel(publishedAt: string | undefined, now: number): string {
  if (!publishedAt) return '최근'
  const then = Date.parse(publishedAt)
  if (Number.isNaN(then)) return '최근'
  const days = Math.floor((now - then) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days === 1) return '1일 전'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return `${Math.floor(days / 30)}개월 전`
}

/**
 * 훅 제목을 2줄로 쪼갭니다. 두 줄의 글자 수가 가장 비슷해지는 지점에서 자릅니다.
 * 프리뷰(클라이언트)와 mp4 렌더(서버)가 같은 분리 결과를 쓰도록 공용으로 둡니다.
 */
export function splitHook(title: string): [string, string] {
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return [title, '']
  const total = title.replace(/\s/g, '').length
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i += 1) {
    const head = words.slice(0, i).join('').length
    const diff = Math.abs(total - head * 2)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

/** ISO 8601 duration(PT1H2M3S) → 초. YouTube Data API contentDetails.duration 파싱용 */
export function parseIsoDuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return 0
  const [, d, h, mm, s] = m
  return (
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3_600 +
    Number(mm ?? 0) * 60 +
    Number(s ?? 0)
  )
}

// ── 2단계: 재사용 가능 여부 확인 ──────────────────────────────
//
// 이 단계가 이 구조에서 법적으로 가장 중요한 지점입니다.
// YouTube Data API 의 status.license 가 'creativeCommon' 인 영상만
// 원저작자 표시 조건으로 2차 활용이 허용됩니다. 나머지(=youtube 표준 라이선스)는
// 별도 허락 없이 재편집·재업로드할 수 없습니다.

export function checkEligibility(video: TrendingVideo): EligibilityCheck[] {
  const inRange =
    video.durationSec >= MIN_SOURCE_SEC && video.durationSec <= MAX_SOURCE_SEC

  return [
    {
      id: 'duration',
      label: '원본 길이 3~60분',
      ok: inRange,
      detail: inRange
        ? `${formatDuration(video.durationSec)} — 처리 가능`
        : video.durationSec < MIN_SOURCE_SEC
          ? `${formatDuration(video.durationSec)} — 3분 미만은 하이라이트 추출 대상이 아님`
          : `${formatDuration(video.durationSec)} — 60분 초과`,
      overridable: false,
    },
    {
      id: 'license',
      label: '재사용 허용 라이선스',
      ok: video.license === 'creativeCommon',
      detail:
        video.license === 'creativeCommon'
          ? 'Creative Commons — 출처 표기 조건으로 2차 활용 가능'
          : '표준 YouTube 라이선스 — 권리자 허락 없이는 재편집 불가',
      overridable: true,
    },
    {
      id: 'embeddable',
      label: '외부 재생 허용',
      ok: video.embeddable,
      detail: video.embeddable ? '퍼가기 허용됨' : '퍼가기가 차단된 영상',
      overridable: false,
    },
    {
      id: 'region',
      label: '지역 제한 없음',
      ok: !video.regionBlocked,
      detail: video.regionBlocked ? '일부 지역 차단됨' : '차단 없음',
      overridable: false,
    },
  ]
}

export function isLongform(video: TrendingVideo): boolean {
  return (
    video.durationSec >= MIN_SOURCE_SEC && video.durationSec <= MAX_SOURCE_SEC
  )
}

export function isReusable(video: TrendingVideo): boolean {
  return video.license === 'creativeCommon'
}

// ── 결정적 난수 (같은 영상 → 같은 결과) ───────────────────────

function fnv1a(input: string): number {
  let h = 2_166_136_261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16_777_619)
  }
  return h >>> 0
}

function createRng(seed: number): () => number {
  let state = seed || 1
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

// ── 3단계: 하이라이트 · 훅 제목 · 자막 생성 ────────────────────
//
// 실제 서비스는 [오디오 추출 → 전사 → LLM 스코어링] 순서로 동작합니다.
// 이 데모는 키 없이도 흐름을 검증할 수 있도록 휴리스틱 생성기를 사용합니다.
// generateWithLLM() 을 붙일 지점은 api/generate/route.ts 에 표시해 두었습니다.

const HOOK_PATTERNS: readonly string[] = [
  '{kw} 이거 모르면 손해입니다',
  '결국 이렇게 끝났습니다',
  '{kw}, 3초만 보세요',
  '다들 놓치는 결정적 순간',
  '이 장면 하나로 정리됨',
  '진짜 문제는 여기서 시작됐다',
  '{kw} 실제로 해보니까',
  '아무도 안 알려주는 부분',
  '이거 보고 생각이 바뀌었습니다',
  '{kw} 딱 이 순서대로만 하세요',
]

const SUBTITLE_OPENERS: readonly string[] = [
  '핵심만 먼저 말하면',
  '여기서 중요한 건',
  '결론부터 보면',
  '문제는 이 지점입니다',
  '실제로 확인해보니',
]

const SUBTITLE_BODIES: readonly string[] = [
  '순서를 바꾸면 결과가 완전히 달라집니다',
  '대부분 이 단계에서 포기합니다',
  '숫자로 보면 차이가 명확해집니다',
  '한 번만 제대로 잡아두면 끝납니다',
  '이유는 생각보다 단순했습니다',
  '이 부분만 고쳐도 절반은 해결됩니다',
]

const REASONS: readonly string[] = [
  '발화 밀도 급상승 + 감정 표현 집중 구간',
  '화면 전환 직후 설명이 몰린 구간',
  '질문 → 답변이 한 호흡에 끝나는 구간',
  '수치·비교 표현이 반복되는 구간',
  '결론 문장이 등장하는 마무리 구간',
  '반전 표현("사실은", "그런데")이 포함된 구간',
]

/** 영상 제목에서 훅에 끼울 짧은 키워드 추출 */
function extractKeyword(title: string): string {
  const cleaned = title
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[[\]—·|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(w => w.length >= 2)
  if (words.length === 0) return ''
  const pick = words.slice(0, 2).join(' ')
  return pick.length > 14 ? words[0] : pick
}

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length) % arr.length]
}

export function plannedClipCount(durationSec: number): number {
  // 원본이 길수록 후보가 많아지는 구조 (5분당 1개, 3~10개로 제한)
  return Math.min(10, Math.max(3, Math.round(durationSec / 300)))
}

/**
 * 하이라이트 후보를 만들고 구간별로 댓글을 매칭합니다.
 * commentPool 이 비어 있으면 댓글 캡처 없이 생성합니다.
 */
export function generateClips(
  video: TrendingVideo,
  commentPool: CapturedComment[],
): ShortClip[] {
  const rand = createRng(fnv1a(video.id))
  const count = plannedClipCount(video.durationSec)
  const keyword = extractKeyword(video.title)

  // 인트로/아웃트로를 제외한 본문 구간에 균등 분포 + 지터
  const usableStart = video.durationSec * 0.06
  const usableEnd = video.durationSec * 0.94
  const window = (usableEnd - usableStart) / count

  const usedComments = new Set<number>()

  const clips: ShortClip[] = Array.from({ length: count }, (_, i) => {
    const clipLen = 30 + Math.floor(rand() * 31) // 30~60초
    const jitter = rand() * Math.max(0, window - clipLen)
    const startSec = Math.round(usableStart + window * i + jitter)
    const endSec = Math.min(
      Math.round(startSec + clipLen),
      Math.floor(video.durationSec),
    )

    const hookRaw = pick(HOOK_PATTERNS, rand)
    const hookTitle = hookRaw.includes('{kw}')
      ? hookRaw.replace('{kw}', keyword).replace(/\s+/g, ' ').trim()
      : hookRaw

    // 좋아요 상위 댓글부터 순서대로 배정하고, 풀이 바닥나면 처음부터 재사용합니다.
    let comment: CapturedComment | null = null
    if (commentPool.length > 0) {
      let idx = i % commentPool.length
      let guard = 0
      while (usedComments.has(idx) && guard < commentPool.length) {
        idx = (idx + 1) % commentPool.length
        guard += 1
      }
      usedComments.add(idx)
      comment = commentPool[idx]
    }

    return {
      id: `${video.id}_c${i + 1}`,
      index: i + 1,
      startSec,
      endSec,
      score: 0, // 아래에서 채움
      hookTitle,
      subtitleLines: [pick(SUBTITLE_OPENERS, rand), pick(SUBTITLE_BODIES, rand)],
      reason: pick(REASONS, rand),
      comment,
    }
  })

  // 점수 부여 후 높은 순으로 정렬 (실제 서비스의 하이라이트 랭킹과 동일한 표시 순서)
  const scored = clips.map(clip => ({
    ...clip,
    score: Math.round(62 + rand() * 35),
  }))
  scored.sort((a, b) => b.score - a.score)

  return scored.map((clip, i) => ({ ...clip, index: i + 1 }))
}

/** 사용량은 생성된 쇼츠 길이가 아니라 투입한 원본 길이 기준 (이지컷과 동일한 과금 단위) */
export function usedMinutesFor(video: TrendingVideo): number {
  return Math.round((video.durationSec / 60) * 10) / 10
}
