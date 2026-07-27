import { z } from 'zod'
import { loadTopComments, type CommentPool } from '../../../shorts-lab/comments'
import {
  checkEligibility,
  generateClips,
  plannedClipCount,
  usedMinutesFor,
} from '../../../shorts-lab/pipeline'
import type { PipelineEvent } from '../../../shorts-lab/types'

// 3~4단계: 숏폼 자동 생성 + 인기 댓글 캡처
//
// 진행 상황을 NDJSON 으로 스트리밍합니다. 실제 파이프라인도 단계가 길기 때문에
// (다운로드 → 전사 → 스코어링 → 렌더) 처음부터 스트리밍 구조로 잡아두는 편이
// 나중에 실 구현으로 갈아끼울 때 UI 를 다시 안 만들어도 됩니다.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const videoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  channelTitle: z.string(),
  durationSec: z.number().int().nonnegative(),
  viewCount: z.number().nonnegative(),
  publishedLabel: z.string(),
  category: z.string(),
  license: z.enum(['creativeCommon', 'youtube']),
  embeddable: z.boolean(),
  regionBlocked: z.boolean(),
  thumbnailUrl: z.string().nullable(),
  source: z.enum(['fixture', 'youtube-api']),
})

const bodySchema = z.object({
  video: videoSchema,
  withCommentCapture: z.boolean(),
  acknowledgedRights: z.boolean().default(false),
})

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

const EMPTY_POOL: CommentPool = { comments: [], source: 'none', notice: null }

interface StageSpec {
  id: string
  label: string
  detail: string
  ms: number
  /** 이 단계에서 실제로 수행할 작업. 반환값은 완료 시 표시할 detail */
  run?: () => Promise<string>
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (error) {
    return Response.json(
      { error: `요청 형식 오류: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    )
  }

  const { video, withCommentCapture, acknowledgedRights } = body

  // 서버에서도 권리 확인을 다시 검증합니다. 클라이언트 토글만 믿으면 안 되는 지점.
  const checks = checkEligibility(video)
  const blocking = checks.filter(c => !c.ok && !c.overridable)
  if (blocking.length > 0) {
    return Response.json(
      { error: `처리할 수 없는 영상입니다: ${blocking.map(c => c.label).join(', ')}` },
      { status: 422 },
    )
  }
  const overridable = checks.filter(c => !c.ok && c.overridable)
  if (overridable.length > 0 && !acknowledgedRights) {
    return Response.json(
      { error: `권리 확인이 필요합니다: ${overridable.map(c => c.label).join(', ')}` },
      { status: 428 },
    )
  }

  // 댓글 단계에서 채워지는 실제 결과
  let pool: CommentPool = EMPTY_POOL

  const stages: StageSpec[] = [
    {
      id: 'source',
      label: '원본 메타 확인',
      detail: `${video.channelTitle} · ${Math.round(video.durationSec / 60)}분 영상`,
      ms: 320,
    },
    {
      id: 'rights',
      label: '재사용 권리 재검증',
      detail:
        video.license === 'creativeCommon'
          ? 'Creative Commons 확인'
          : '표준 라이선스 — 이용자 권리 확인 기록',
      ms: 260,
    },
    {
      id: 'audio',
      label: '오디오 추출 · 청크 분할',
      detail: `${Math.max(1, Math.ceil(video.durationSec / 600))}개 청크`,
      ms: 520,
    },
    {
      id: 'transcribe',
      label: '음성 전사',
      detail: 'Whisper 계열 STT (데모: 스킵)',
      ms: 680,
    },
    {
      id: 'score',
      label: '하이라이트 스코어링',
      detail: `${plannedClipCount(video.durationSec)}개 후보 구간 산출`,
      ms: 620,
    },
    {
      id: 'copy',
      label: '훅 제목 · 자막 생성',
      detail: '구간별 카피 초안',
      ms: 540,
    },
  ]

  if (withCommentCapture) {
    stages.push({
      id: 'comments',
      label: '인기 댓글 수집 · 캡처',
      detail: 'commentThreads 조회 중…',
      ms: 200,
      run: async () => {
        pool = await loadTopComments(video.id)
        if (pool.source === 'youtube-api') {
          const top = pool.comments[0]
          return `실제 댓글 ${pool.comments.length}개 · 최다 좋아요 ${top?.likeCount ?? 0}`
        }
        if (pool.source === 'none') return pool.notice ?? '댓글 없음'
        return `데모 댓글 ${pool.comments.length}개 (${pool.notice ?? '폴백'})`
      },
    })
  }

  stages.push({
    id: 'render',
    label: '9:16 합성',
    detail: '템플릿 · 자막 · 댓글 레이어 결합',
    ms: 600,
  })

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        for (const stage of stages) {
          send({
            type: 'stage',
            id: stage.id,
            label: stage.label,
            detail: stage.detail,
            status: 'running',
          })

          // 실제 작업과 최소 표시 시간을 함께 기다립니다.
          const [detail] = await Promise.all([stage.run?.(), sleep(stage.ms)])

          send({
            type: 'stage',
            id: stage.id,
            label: stage.label,
            detail: detail ?? stage.detail,
            status: 'done',
          })
        }

        // ── 실 구현 교체 지점 ──────────────────────────────────
        // GEMINI_API_KEY / OPENAI_API_KEY 가 준비되면 이 자리에서
        // 전사문 기반 LLM 호출로 교체합니다. 반환 타입(ShortClip[])만 맞추면
        // UI 는 수정할 필요가 없습니다.
        const clips = generateClips(video, pool.comments)

        send({
          type: 'result',
          video,
          clips,
          usedMinutes: usedMinutesFor(video),
          engine: 'heuristic-v1 (키 없이 동작하는 데모 생성기)',
          commentSource: pool.source,
          commentNotice: pool.notice,
        })
      } catch (error) {
        send({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
