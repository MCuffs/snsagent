import { z } from 'zod'
import { head } from '@vercel/blob'
import { getSessionUser } from '../../../../lib/auth/user'
import {
  hasShortsLabFullAccess,
  isShortsLabUnlimited,
  shortsLabUpgradeResponse,
} from '../../../../lib/auth/shorts-lab-access'
import {
  getShortsLabUsage,
  recordShortsLabGeneration,
  SHORTS_LAB_DAILY_LIMIT,
  SHORTS_LAB_FREE_TRIAL_LIMIT,
  SHORTS_LAB_MONTHLY_LIMIT,
} from '../../../../lib/shorts-lab-usage'
import { loadTopComments } from '../../../shorts-lab/comments'
import { checkEligibility, usedMinutesFor } from '../../../shorts-lab/pipeline'
import { produceShort } from '../../../shorts-lab/production'
import type { PipelineEvent } from '../../../shorts-lab/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

// 서버 측 원본 추출(yt-dlp) 경로는 제거되었습니다.
// 브라우저 캡처 또는 직접 업로드한 원본(sourceUrl)이 항상 필요합니다.
const bodySchema = z.object({
  video: videoSchema,
  sourceUrl: z.string().url(),
})

const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_SOURCE_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // 한도 정책: 무료 1회 체험 → 이후 결제 / 유료 월 60회·일 10회 / 어드민·지정 계정 무제한
  const usage = await getShortsLabUsage(user.id)
  if (!hasShortsLabFullAccess(user)) {
    if (usage.totalUsed >= SHORTS_LAB_FREE_TRIAL_LIMIT) {
      return Response.json(
        { ...shortsLabUpgradeResponse(), reason: 'trial_exhausted' },
        { status: 402 },
      )
    }
  } else if (!isShortsLabUnlimited(user.email)) {
    if (usage.monthUsed >= SHORTS_LAB_MONTHLY_LIMIT) {
      return Response.json(
        {
          error: `이번 달 생성 한도(${SHORTS_LAB_MONTHLY_LIMIT}회)를 모두 사용했습니다. 다음 달에 다시 이용할 수 있습니다.`,
          reason: 'monthly_limit',
        },
        { status: 429 },
      )
    }
    if (usage.dayUsed >= SHORTS_LAB_DAILY_LIMIT) {
      return Response.json(
        {
          error: `오늘 생성 한도(${SHORTS_LAB_DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 이용할 수 있습니다.`,
          reason: 'daily_limit',
        },
        { status: 429 },
      )
    }
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (error) {
    return Response.json(
      { error: `요청 형식 오류: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    )
  }

  const { video, sourceUrl } = body
  if (video.source !== 'youtube-api') {
    return Response.json(
      { error: '데모 영상은 실제 MP4를 만들 수 없습니다. LIVE 목록의 영상을 선택해 주세요.' },
      { status: 422 },
    )
  }

  const failedChecks = checkEligibility(video).filter(check => !check.ok)
  if (failedChecks.length > 0) {
    return Response.json(
      {
        error: `재사용 가능한 영상만 만들 수 있습니다: ${failedChecks
          .map(check => check.label)
          .join(', ')}`,
      },
      { status: 422 },
    )
  }

  try {
    const blob = await head(sourceUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
    const allowedPrefix = `uploads/shorts-lab/${user.id}/`
    if (
      !blob.pathname.startsWith(allowedPrefix) ||
      !ALLOWED_SOURCE_TYPES.has(blob.contentType) ||
      blob.size <= 0 ||
      blob.size > MAX_SOURCE_BYTES
    ) {
      throw new Error('업로드한 원본 파일을 확인할 수 없습니다.')
    }
  } catch (error) {
    console.error('[shorts-lab/generate] invalid uploaded source', error)
    return Response.json(
      { error: '업로드한 원본 파일이 유효하지 않습니다.' },
      { status: 422 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        send({
          type: 'stage',
          id: 'comments',
          label: '제목과 댓글을 읽고 있어요',
          detail: '인기 댓글을 후킹 카피에 반영하는 중',
          status: 'running',
        })
        const pool = await loadTopComments(video.id)

        const produced = await produceShort({
          video,
          comments: pool.comments,
          userId: user.id,
          sourceUrl,
          onProgress: (id, label, detail) => {
            send({ type: 'stage', id, label, detail, status: 'running' })
          },
        })

        // 한도 집계용 사용 기록 — 결과 전송 전에 확정합니다.
        await recordShortsLabGeneration(user.id, video.id)

        send({
          type: 'result',
          video,
          clips: [produced.clip],
          usedMinutes: usedMinutesFor(video),
          engine: 'OpenAI 전사·GPT 후킹 분석 + FFmpeg 9:16 렌더',
          commentSource: pool.source,
          commentNotice: pool.notice,
          downloadUrl: produced.downloadUrl,
          fileName: produced.fileName,
        })
      } catch (error) {
        console.error('[shorts-lab/generate]', error)
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
