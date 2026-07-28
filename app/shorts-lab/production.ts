import 'server-only'

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import OpenAI from 'openai'
import { z } from 'zod'
import { getLLMClient } from '../../src/lib/ai/llmClient'
import { generateClips } from './pipeline'
import type { CapturedComment, ShortClip, TrendingVideo } from './types'

interface TranscriptSegment {
  start: number
  end: number
  text: string
}

interface CandidateWindow {
  index: number
  startSec: number
  endSec: number
  text: string
}

// 브라우저 탭 캡처는 seek·재생 지연 때문에 첫 1~2초에 플레이어 UI가 찍힙니다.
// 캡처 원본은 이 길이만큼 머리를 무조건 잘라내고 시작합니다.
const CAPTURE_LEAD_TRIM_SEC = 2.5
/** 클라이언트 BROWSER_CAPTURE_SEC(35초)와 동기화된 캡처 길이 상한 */
const CAPTURE_MAX_SEC = 35

/** 브라우저 캡처 업로드인지 (임의의 원본 MP4 업로드와 구분) */
function isBrowserCapture(sourceUrl: string): boolean {
  return sourceUrl.includes('shuffla-capture-')
}

const selectionSchema = z.object({
  candidateIndex: z.number().int().nonnegative(),
  hookTitle: z.string().min(4).max(42),
  reason: z.string().min(2).max(100),
})

export interface ProducedShort {
  clip: ShortClip
  downloadUrl: string
  fileName: string
}

export type ProductionProgress = (
  id: string,
  label: string,
  detail: string,
) => void

function runFfmpeg(args: string[], timeoutMs = 240_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegInstaller.path, ['-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('영상 처리 시간이 초과되었습니다. 더 짧은 원본으로 다시 시도해 주세요.'))
    }, timeoutMs)

    child.stderr.on('data', chunk => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000)
    })
    child.once('error', error => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `ffmpeg가 코드 ${code}로 종료되었습니다.`))
    })
  })
}

function ffmpegInput(url: string, startSec?: number): string[] {
  return [
    ...(typeof startSec === 'number' ? ['-ss', String(startSec)] : []),
    '-i',
    url,
  ]
}

async function transcribeAudio(audioPath: string): Promise<TranscriptSegment[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.length < 10) {
    console.warn('[shorts-lab] OPENAI_API_KEY가 없어 제목·댓글 기반 fallback을 사용합니다.')
    return []
  }

  const client = new OpenAI({
    apiKey,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  })
  let transcription
  try {
    transcription = await client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })
  } catch (error) {
    console.warn(
      '[shorts-lab] 음성 전사에 실패해 제목·댓글 기반 fallback을 사용합니다.',
      error instanceof Error ? error.message : error,
    )
    return []
  }

  return (transcription.segments ?? [])
    .map(segment => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.replace(/\s+/g, ' ').trim(),
    }))
    .filter(segment => segment.text.length > 0 && segment.end > segment.start)
}

function createCandidateWindows(segments: TranscriptSegment[]): CandidateWindow[] {
  if (segments.length === 0) return []

  const raw: CandidateWindow[] = []
  let cursor = 0
  while (cursor < segments.length) {
    const first = segments[cursor]
    const targetEnd = first.start + 30
    let end = cursor
    while (end + 1 < segments.length && segments[end + 1].start < targetEnd) end += 1
    raw.push({
      index: raw.length,
      startSec: Math.max(0, Math.floor(first.start)),
      endSec: Math.ceil(Math.min(segments[end].end, first.start + 38)),
      text: segments
        .slice(cursor, end + 1)
        .map(segment => segment.text)
        .join(' ')
        .slice(0, 700),
    })
    cursor = Math.max(cursor + 1, end + 1)
  }

  // 긴 영상도 프롬프트가 과도해지지 않도록 전체 구간에서 최대 20개를 균등 샘플링합니다.
  if (raw.length <= 20) return raw.map((window, index) => ({ ...window, index }))
  const sampled = Array.from({ length: 20 }, (_, index) => {
    const at = Math.round((index * (raw.length - 1)) / 19)
    return raw[at]
  })
  return sampled.map((window, index) => ({ ...window, index }))
}

function fallbackClip(
  video: TrendingVideo,
  comments: CapturedComment[],
  candidates: CandidateWindow[],
): ShortClip {
  const heuristic = generateClips(video, comments)[0]
  const candidate = candidates[0]
  const titleHook = video.title
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[ㅋㅎ]{2,}|[!?]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const conciseTitle =
    titleHook.length > 29
      ? `${titleHook.slice(0, 28).replace(/\s+\S*$/, '')}…`
      : titleHook
  const topComment = comments[0] ?? null

  if (!candidate) {
    return {
      ...heuristic,
      hookTitle: conciseTitle || heuristic.hookTitle,
      subtitleLines: topComment?.text
        ? [topComment.text.replace(/\s+/g, ' ').trim().slice(0, 84)]
        : heuristic.subtitleLines,
      reason: '원본 제목과 인기 댓글을 반영한 자동 후킹 구간',
      comment: topComment,
    }
  }
  return {
    ...heuristic,
    startSec: candidate.startSec,
    endSec: candidate.endSec,
    hookTitle: conciseTitle || heuristic.hookTitle,
    subtitleLines: [candidate.text.slice(0, 80)],
    reason: '원본 제목과 실제 전사 내용을 반영한 자동 후킹 구간',
    comment: topComment,
  }
}

async function selectHook(
  video: TrendingVideo,
  comments: CapturedComment[],
  candidates: CandidateWindow[],
): Promise<ShortClip> {
  const fallback = () => fallbackClip(video, comments, candidates)
  if (candidates.length === 0) return fallback()

  const commentText = comments
    .slice(0, 8)
    .map((comment, index) => `${index + 1}. (${comment.likeCount} likes) ${comment.text}`)
    .join('\n')
  const candidateText = candidates
    .map(
      candidate =>
        `[${candidate.index}] ${candidate.startSec}-${candidate.endSec}초: ${candidate.text}`,
    )
    .join('\n')

  const raw = await getLLMClient().generateJson(
    'shorts-lab-hook-selection',
    `다음 유튜브 원본에서 바로 업로드 가능한 쇼츠 1개를 고르세요.

원본 제목: ${video.title}
채널: ${video.channelTitle}

인기 댓글:
${commentText || '(댓글 없음)'}

후보 전사 구간:
${candidateText}

요구사항:
- candidateIndex는 반드시 위 후보 번호 중 하나
- 첫 2초에 궁금증을 만드는 20~35초 구간을 우선
- hookTitle은 원본 제목과 댓글의 실제 맥락을 반영한 자연스러운 한국어
- 낚시성 허위 사실, 원본에 없는 수치와 단정은 금지
- hookTitle은 화면 2줄에 들어가도록 4~24자 권장
- JSON 형식: {"candidateIndex":0,"hookTitle":"...","reason":"..."}`,
    () => ({
      candidateIndex: 0,
      hookTitle: fallback().hookTitle,
      reason: fallback().reason,
    }),
    {
      systemPrompt:
        '당신은 한국 숏폼 콘텐츠 편집자입니다. 원본 제목, 인기 댓글, 실제 전사문만 근거로 가장 강한 후킹 구간과 제목을 고르고 유효한 JSON만 반환하세요.',
    },
  )

  const parsed = selectionSchema.safeParse(raw)
  if (!parsed.success) return fallback()
  const candidate = candidates[parsed.data.candidateIndex]
  if (!candidate) return fallback()

  const topComment = comments[0] ?? null
  const caption = candidate.text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 105)

  return {
    id: `${video.id}-${candidate.startSec}`,
    index: 1,
    startSec: candidate.startSec,
    endSec: Math.min(candidate.endSec, candidate.startSec + 35),
    score: 95,
    hookTitle: parsed.data.hookTitle.trim(),
    subtitleLines: caption ? [caption] : [],
    reason: parsed.data.reason.trim(),
    comment: topComment,
  }
}

function wrapKoreanText(text: string, maxChars = 15, maxLines = 2): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || current.length === 0) current = next
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length > maxLines) {
    lines[maxLines - 1] = `${lines.slice(maxLines - 1).join(' ').slice(0, maxChars - 1)}…`
  }
  return lines.slice(0, maxLines).join('\n')
}

function escapeFilterPath(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

async function renderShort(params: {
  sourceUrl: string
  clip: ShortClip
  video: TrendingVideo
  workDir: string
}): Promise<string> {
  const outputPath = path.join(params.workDir, 'short.mp4')
  const hookPath = path.join(params.workDir, 'hook.txt')
  const captionPath = path.join(params.workDir, 'caption.txt')
  const creditPath = path.join(params.workDir, 'credit.txt')
  const fontBold = path.join(process.cwd(), 'public/fonts/Pretendard-ExtraBold.otf')
  const fontRegular = path.join(process.cwd(), 'public/fonts/Pretendard-Bold.otf')

  await Promise.all([
    fs.writeFile(hookPath, wrapKoreanText(params.clip.hookTitle)),
    fs.writeFile(
      captionPath,
      wrapKoreanText(params.clip.subtitleLines[0] ?? '', 21, 3),
    ),
    fs.writeFile(creditPath, `원본 · ${params.video.channelTitle}`),
  ])

  const duration = Math.max(15, params.clip.endSec - params.clip.startSec)
  const filter = [
    '[0:v]split=2[base][main]',
    '[base]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=12:4,eq=brightness=-0.25[bg]',
    '[main]scale=720:720:force_original_aspect_ratio=decrease[fg]',
    '[bg][fg]overlay=(W-w)/2:(H-h)/2[composed]',
    `[composed]drawbox=x=36:y=48:w=648:h=180:color=black@0.72:t=fill,drawtext=fontfile='${escapeFilterPath(fontBold)}':textfile='${escapeFilterPath(hookPath)}':fontcolor=white:fontsize=45:line_spacing=11:x=(w-text_w)/2:y=79`,
    `drawbox=x=36:y=1007:w=648:h=173:color=black@0.68:t=fill,drawtext=fontfile='${escapeFilterPath(fontRegular)}':textfile='${escapeFilterPath(captionPath)}':fontcolor=white:fontsize=28:line_spacing=8:x=(w-text_w)/2:y=1040`,
    `drawtext=fontfile='${escapeFilterPath(fontRegular)}':textfile='${escapeFilterPath(creditPath)}':fontcolor=white@0.82:fontsize=17:x=48:y=1219[outv]`,
  ].join(',')

  await runFfmpeg([
    ...ffmpegInput(params.sourceUrl, params.clip.startSec),
    '-t',
    String(duration),
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    '-map',
    '0:a:0?',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-r',
    '30',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    '-y',
    outputPath,
  ])
  return outputPath
}

async function storeShort(
  filePath: string,
  userId: string,
  videoId: string,
): Promise<{ downloadUrl: string; fileName: string }> {
  const fileName = `shuffla-${videoId}-${Date.now()}.mp4`
  const buffer = await fs.readFile(filePath)

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`generated/shorts-lab/${userId}/${fileName}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'video/mp4',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { downloadUrl: blob.downloadUrl, fileName }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('BLOB_READ_WRITE_TOKEN이 없어 생성 영상을 저장할 수 없습니다.')
  }
  const directory = path.join(process.cwd(), 'public', 'generated', 'shorts-lab', userId)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, fileName), buffer)
  return {
    downloadUrl: `/generated/shorts-lab/${userId}/${fileName}`,
    fileName,
  }
}

export async function produceShort(params: {
  video: TrendingVideo
  comments: CapturedComment[]
  userId: string
  sourceUrl: string
  onProgress?: ProductionProgress
}): Promise<ProducedShort> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shuffla-shorts-'))
  try {
    const capture = isBrowserCapture(params.sourceUrl)

    params.onProgress?.('analyze', '가장 좋은 순간을 찾고 있어요', '음성을 분석하는 중')
    let segments: TranscriptSegment[] = []
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length >= 10) {
      const audioPath = path.join(workDir, 'source.mp3')
      await runFfmpeg([
        ...ffmpegInput(params.sourceUrl),
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '32k',
        '-y',
        audioPath,
      ])
      segments = await transcribeAudio(audioPath)
    }
    if (capture) {
      // 트림될 머리 구간에서 끝나는 발화는 후보에서 제외합니다.
      segments = segments.filter(segment => segment.end > CAPTURE_LEAD_TRIM_SEC)
    }
    const candidates = createCandidateWindows(segments)
    let clip = await selectHook(params.video, params.comments, candidates)

    if (capture) {
      // 캡처 첫 1~2초의 플레이어 UI 노출 방지: 시작점을 최소 트림 이후로 강제.
      // 전사 실패 시 폴백이 원본 전체 길이 기준으로 시작점을 잡는 경우도
      // 캡처 길이(35초) 안으로 되돌립니다.
      const start =
        clip.startSec > CAPTURE_MAX_SEC - 15
          ? CAPTURE_LEAD_TRIM_SEC
          : Math.max(clip.startSec, CAPTURE_LEAD_TRIM_SEC)
      clip = {
        ...clip,
        startSec: start,
        endSec: Math.min(Math.max(clip.endSec, start + 15), CAPTURE_MAX_SEC),
      }
    }

    params.onProgress?.('render', '숏폼을 완성하고 있어요', '9:16 영상과 후킹 카피 합성 중')
    const renderedPath = await renderShort({
      sourceUrl: params.sourceUrl,
      clip,
      video: params.video,
      workDir,
    })
    const stored = await storeShort(renderedPath, params.userId, params.video.id)
    return { clip, ...stored }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
