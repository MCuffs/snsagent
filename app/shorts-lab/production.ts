import 'server-only'

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { Resvg } from '@resvg/resvg-js'
import OpenAI from 'openai'
import youtubeDl, { create as createYoutubeDl } from 'youtube-dl-exec'
import { z } from 'zod'
import { getLLMClient } from '../../src/lib/ai/llmClient'
import { formatLikes, generateClips } from './pipeline'
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

interface SourceStreams {
  videoUrl: string
  videoHeaders: string
  audioUrl: string | null
  audioHeaders: string | null
}

interface ExtractedFormat {
  url?: string
  vcodec?: string
  acodec?: string
  http_headers?: Record<string, string>
}

interface ExtractedMetadata extends ExtractedFormat {
  requested_formats?: ExtractedFormat[]
}

export class SourceBlockedError extends Error {
  readonly code = 'SOURCE_BLOCKED' as const

  constructor() {
    super(
      'YouTube가 서버의 원본 요청을 차단했습니다. 원본 MP4를 올리면 같은 분석 과정으로 바로 이어서 만들 수 있습니다.',
    )
    this.name = 'SourceBlockedError'
  }
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

async function getSourceStreams(
  videoId: string,
  uploadedSourceUrl?: string,
  cookiePath?: string,
): Promise<SourceStreams> {
  if (uploadedSourceUrl) {
    return {
      videoUrl: uploadedSourceUrl,
      videoHeaders: '',
      audioUrl: null,
      audioHeaders: null,
    }
  }

  const executable =
    process.platform === 'linux' || process.platform === 'darwin'
      ? createYoutubeDl(path.join(process.cwd(), 'vendor', 'yt-dlp'))
      : youtubeDl

  let output: ExtractedMetadata | null = null
  let lastError: unknown = null
  const clients = cookiePath
    ? ['web', 'web_embedded', 'android_vr']
    : ['web_embedded', 'android_vr']
  extraction:
  for (const client of clients) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        output = (await executable(`https://www.youtube.com/watch?v=${videoId}`, {
          ...(cookiePath ? { cookies: cookiePath } : {}),
          ...(process.env.YOUTUBE_COOKIE_USER_AGENT
            ? { userAgent: process.env.YOUTUBE_COOKIE_USER_AGENT }
            : {}),
          dumpSingleJson: true,
          format: 'bv*[vcodec^=avc1][height<=720]+ba[ext=m4a]/18',
          extractorArgs: `youtube:player_client=${client}`,
          jsRuntimes: 'node',
          noPlaylist: true,
          noWarnings: true,
          sleepRequests: 1,
          skipDownload: true,
        } as never)) as unknown as ExtractedMetadata
        break extraction
      } catch (error) {
        lastError = error
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 750))
        }
      }
    }
  }

  if (!output) {
    console.error(
      '[shorts-lab] YouTube source extraction failed after all retries.',
      lastError instanceof Error ? lastError.message : lastError,
    )
    throw new SourceBlockedError()
  }
  const formats = output.requested_formats ?? [output]
  const video = formats.find(format => format.url && format.vcodec !== 'none')
  const audio = formats.find(
    format => format.url && format.acodec !== 'none' && format.vcodec === 'none',
  )
  if (!video?.url) throw new Error('유튜브 원본 스트림을 가져오지 못했습니다.')

  const serializeHeaders = (headers?: Record<string, string>) =>
    Object.entries(headers ?? {})
      .map(([key, value]) => `${key.replace(/[\r\n:]/g, '')}: ${value.replace(/[\r\n]/g, '')}`)
      .join('\r\n')

  return {
    videoUrl: video.url,
    videoHeaders: serializeHeaders(video.http_headers),
    audioUrl: audio?.url ?? null,
    audioHeaders: audio?.url ? serializeHeaders(audio.http_headers) : null,
  }
}

async function createYoutubeCookieFile(workDir: string): Promise<string | undefined> {
  const encoded = process.env.YOUTUBE_COOKIES_B64?.trim()
  if (!encoded) return undefined

  let content: string
  try {
    content = Buffer.from(encoded, 'base64').toString('utf8').replace(/\r\n/g, '\n')
  } catch {
    throw new Error('YOUTUBE_COOKIES_B64 값을 해석할 수 없습니다.')
  }

  if (
    !content.startsWith('# Netscape HTTP Cookie File') &&
    !content.startsWith('# HTTP Cookie File')
  ) {
    throw new Error('YouTube 쿠키가 Netscape 형식이 아닙니다.')
  }

  const cookieLines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))

  if (cookieLines.length === 0) {
    throw new Error('YouTube 쿠키 파일에 인증 쿠키가 없습니다.')
  }

  for (const line of cookieLines) {
    const fields = line.split('\t')
    const domain = fields[0]?.replace(/^#HttpOnly_/, '').replace(/^\./, '')
    if (fields.length < 7 || !domain || (domain !== 'youtube.com' && !domain.endsWith('.youtube.com'))) {
      throw new Error('YouTube 이외의 도메인 쿠키는 사용할 수 없습니다.')
    }
  }

  const cookiePath = path.join(workDir, 'youtube-cookies.txt')
  await fs.writeFile(cookiePath, `${content.trimEnd()}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  })
  return cookiePath
}

function ffmpegInput(url: string, headers?: string | null, startSec?: number): string[] {
  return [
    ...(typeof startSec === 'number' ? ['-ss', String(startSec)] : []),
    ...(headers ? ['-headers', headers] : []),
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
  sourceIsUpload: boolean,
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
      // 업로드된 원본(브라우저 캡처 35초 등)은 원본 영상보다 짧을 수 있어
      // 원본 타임라인 기준 시작점을 그대로 쓰면 파일 끝을 넘어 시킹합니다.
      ...(sourceIsUpload ? { startSec: 0, endSec: 35 } : {}),
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
  sourceIsUpload: boolean,
): Promise<ShortClip> {
  const fallback = () => fallbackClip(video, comments, candidates, sourceIsUpload)
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function fetchAvatarDataUri(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith('https://')) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0 || buffer.length > 1_000_000) return null
    return `data:${type};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

const AVATAR_FALLBACK_COLORS = ['#7c4dff', '#ef5350', '#26a69a', '#ffa726', '#42a5f5']

/**
 * 이지컷 '댓글 캡처' 템플릿과 동일한 전체 화면 오버레이를 SVG로 그려 PNG로
 * 렌더합니다: 훅 2줄 중앙정렬(둘째 줄 블루→퍼플 그라데이션) · 유튜브 다크모드
 * 댓글(원형 아바타 · 작성자·시간 · 본문 · 좋아요/싫어요/답글) · 하단 중앙 워터마크.
 */
async function renderTemplateOverlay(params: {
  clip: ShortClip
  video: TrendingVideo
  workDir: string
}): Promise<string> {
  // 이모지는 로드한 폰트에 글리프가 없어 깨진 사각형으로 보이므로 제거합니다.
  const stripEmoji = (value: string) =>
    value
      .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()

  const hookLines = wrapKoreanText(stripEmoji(params.clip.hookTitle), 14, 2)
    .split('\n')
    .map(escapeXml)
  const hookSvg =
    hookLines.length > 1
      ? `<text x="360" y="126" text-anchor="middle" class="hook" fill="#ffffff">${hookLines[0]}</text>
  <text x="360" y="188" text-anchor="middle" class="hook" fill="url(#hookGrad)">${hookLines[1]}</text>`
      : `<text x="360" y="158" text-anchor="middle" class="hook" fill="#ffffff">${hookLines[0]}</text>`

  let commentSvg = ''
  const comment = params.clip.comment
  if (comment) {
    const avatar = await fetchAvatarDataUri(comment.avatarUrl ?? null)
    const lines = wrapKoreanText(stripEmoji(comment.text), 21, 2).split('\n').map(escapeXml)
    const authorRaw = Array.from(comment.author).slice(0, 22).join('')
    const authorLine = escapeXml(`${authorRaw} · ${comment.publishedLabel}`)
    const initial = escapeXml(Array.from(authorRaw.replace(/^@/, ''))[0]?.toUpperCase() ?? '?')
    const fallbackColor =
      AVATAR_FALLBACK_COLORS[
        Math.abs(fnv1aText(comment.author)) % AVATAR_FALLBACK_COLORS.length
      ]
    const avatarSvg = avatar
      ? `<image x="0" y="0" width="52" height="52" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" href="${avatar}"/>`
      : `<circle cx="26" cy="26" r="26" fill="${fallbackColor}"/><text x="26" y="35" text-anchor="middle" class="initial">${initial}</text>`
    const bodySvg = lines
      .map((line, index) => `<text x="70" y="${66 + index * 33}" class="body">${line}</text>`)
      .join('')
    commentSvg = `<g transform="translate(48,884)">
    ${avatarSvg}
    <text x="70" y="32" class="author">${authorLine}</text>
    ${bodySvg}
    <g transform="translate(70,124)">
      <path transform="scale(0.75)" fill="#aaaaaa" d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/>
      <text x="26" y="15" class="meta">${escapeXml(formatLikes(comment.likeCount))}</text>
      <path transform="translate(96,2) scale(0.75)" fill="#aaaaaa" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2z"/>
      <text x="146" y="15" class="meta">답글</text>
    </g>
  </g>`
  }

  const svg = `<svg width="720" height="1280" viewBox="0 0 720 1280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hookGrad" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#4d9dff"/>
      <stop offset="1" stop-color="#b16cff"/>
    </linearGradient>
    <clipPath id="avatarClip"><circle cx="26" cy="26" r="26"/></clipPath>
    <style>
      .hook { font-family: Pretendard; font-size: 46px; font-weight: 700; }
      .author { font-family: Pretendard; font-size: 19px; font-weight: 400; fill: #aaaaaa; }
      .body { font-family: Pretendard; font-size: 24px; font-weight: 700; fill: #f1f1f1; }
      .meta { font-family: Pretendard; font-size: 18px; font-weight: 400; fill: #aaaaaa; }
      .initial { font-family: Pretendard; font-size: 24px; font-weight: 700; fill: #ffffff; }
      .wm { font-family: Pretendard; font-size: 22px; font-weight: 700; fill: #ffffff; }
      .wmSub { font-family: Pretendard; font-size: 15px; font-weight: 400; fill: #9b9b9b; }
    </style>
  </defs>
  ${hookSvg}
  ${commentSvg}
  <text x="360" y="1216" text-anchor="middle" class="wm">Shuffla</text>
  <text x="360" y="1244" text-anchor="middle" class="wmSub">원본 · ${escapeXml(params.video.channelTitle)}</text>
</svg>`

  const png = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 2 },
    font: {
      fontFiles: [
        path.join(process.cwd(), 'public/fonts/Pretendard-Regular.otf'),
        path.join(process.cwd(), 'public/fonts/Pretendard-Bold.otf'),
      ],
      loadSystemFonts: false,
      defaultFontFamily: 'Pretendard',
    },
  })
    .render()
    .asPng()
  const overlayPath = path.join(params.workDir, 'template-overlay.png')
  await fs.writeFile(overlayPath, png)
  return overlayPath
}

function fnv1aText(input: string): number {
  let hash = 2_166_136_261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash | 0
}

async function renderShort(params: {
  streams: SourceStreams
  clip: ShortClip
  video: TrendingVideo
  workDir: string
  isTabCapture: boolean
  overlayPath: string
}): Promise<string> {
  const outputPath = path.join(params.workDir, 'short.mp4')

  const duration = Math.max(15, params.clip.endSec - params.clip.startSec)
  // 탭 캡처는 뷰포트 전체가 녹화되어 플레이어 레터박스(위아래·좌우 검은 띠)가
  // 섞일 수 있으므로 먼저 중앙 16:9 영역만 잘라냅니다.
  const capturePrecrop = params.isTabCapture
    ? 'crop=min(iw\\,ih*16/9):min(ih\\,iw*16/9),'
    : ''
  // 숏폼답게 화면을 채우도록 원본을 중앙 기준으로 720x640 밴드에 꽉 차게 크롭합니다.
  const mainChain = `[0:v]${capturePrecrop}scale=720:640:force_original_aspect_ratio=increase,crop=720:640[fg]`
  // 템플릿 오버레이 PNG는 마지막 입력으로 붙습니다 (0=영상, 1=오디오(있을 때), 마지막=오버레이)
  const overlayInputIndex = params.streams.audioUrl ? 2 : 1
  const filter = [
    'color=c=0x0f0f0f:s=720x1280:r=30[bgc]',
    mainChain,
    '[bgc][fg]overlay=0:224:shortest=1[composed]',
    `[${overlayInputIndex}:v]scale=720:1280[ui]`,
    '[composed][ui]overlay=0:0[outv]',
  ].join(',')

  const inputs = [
    ...ffmpegInput(
      params.streams.videoUrl,
      params.streams.videoHeaders,
      params.clip.startSec,
    ),
    ...(params.streams.audioUrl
      ? ffmpegInput(
          params.streams.audioUrl,
          params.streams.audioHeaders ?? params.streams.videoHeaders,
          params.clip.startSec,
        )
      : []),
    '-i',
    params.overlayPath,
  ]
  const audioMap = params.streams.audioUrl ? '1:a:0?' : '0:a:0?'

  await runFfmpeg([
    ...inputs,
    '-t',
    String(duration),
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    '-map',
    audioMap,
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
  uploadedSourceUrl?: string
  uploadedSourceKind?: 'capture' | 'file'
  onProgress?: ProductionProgress
}): Promise<ProducedShort> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shuffla-shorts-'))
  try {
    params.onProgress?.('source', '원본을 준비하고 있어요', '재사용 가능한 영상을 불러오는 중')
    const cookiePath = params.uploadedSourceUrl
      ? undefined
      : await createYoutubeCookieFile(workDir)
    const streams = await getSourceStreams(
      params.video.id,
      params.uploadedSourceUrl,
      cookiePath,
    )

    params.onProgress?.('analyze', '가장 좋은 순간을 찾고 있어요', '음성을 분석하는 중')
    let segments: TranscriptSegment[] = []
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length >= 10) {
      const audioPath = path.join(workDir, 'source.mp3')
      await runFfmpeg([
        ...ffmpegInput(
          streams.audioUrl ?? streams.videoUrl,
          streams.audioHeaders ?? streams.videoHeaders,
        ),
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
    const candidates = createCandidateWindows(segments)
    const clip = await selectHook(
      params.video,
      params.comments,
      candidates,
      Boolean(params.uploadedSourceUrl),
    )

    params.onProgress?.('render', '숏폼을 완성하고 있어요', '9:16 영상과 후킹 카피 합성 중')
    const overlayPath = await renderTemplateOverlay({
      clip,
      video: params.video,
      workDir,
    })
    const renderedPath = await renderShort({
      streams,
      clip,
      video: params.video,
      workDir,
      isTabCapture: Boolean(params.uploadedSourceUrl) && params.uploadedSourceKind === 'capture',
      overlayPath,
    })
    const stored = await storeShort(renderedPath, params.userId, params.video.id)
    return { clip, ...stored }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
