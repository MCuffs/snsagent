import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'
import ffmpegStatic from 'ffmpeg-static'
import type { StockVideoCandidate, YouTubeScenePlan } from './automation'

interface RenderYouTubeShortsParams {
  userId: string
  dayId: string
  title: string
  script: string
  scenes: YouTubeScenePlan[]
  sourceClips: StockVideoCandidate[]
}

interface StoredRenderedAsset {
  mp4Url: string
  thumbnailUrl: string | null
  ttsAudioUrl: string | null
  ttsProvider: string
}

const MAX_SOURCE_VIDEO_BYTES = 180 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 90_000
const TTS_MAX_CHARS = 3900
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(MODULE_DIR, '../../..')

export async function renderYouTubeShortsFromStock(params: RenderYouTubeShortsParams): Promise<StoredRenderedAsset> {
  const usableClips = params.sourceClips.filter(clip => clip.videoUrl)
  if (usableClips.length === 0) {
    throw new Error('Pexels/Pixabay 영상 후보가 없습니다. API 키 또는 검색 키워드를 확인해 주세요.')
  }

  const workDir = path.join(os.tmpdir(), 'shuffla-youtube-automation', params.dayId)
  await fs.rm(workDir, { recursive: true, force: true })
  await fs.mkdir(workDir, { recursive: true })

  try {
    const fontsDir = path.join(workDir, 'fonts')
    await fs.mkdir(fontsDir, { recursive: true })
    await copyFontIfAvailable(fontsDir)

    const normalizedClips: string[] = []
    for (let index = 0; index < params.scenes.length; index += 1) {
      const scene = params.scenes[index]
      const clip = usableClips[index % usableClips.length]
      const rawPath = path.join(workDir, `source-${index + 1}.mp4`)
      const normalizedPath = path.join(workDir, `clip-${index + 1}.mp4`)
      await downloadVideo(clip.videoUrl!, rawPath)
      await normalizeClip({
        inputPath: rawPath,
        outputPath: normalizedPath,
        durationSeconds: scene.durationSeconds,
      })
      normalizedClips.push(normalizedPath)
    }

    const concatPath = path.join(workDir, 'concat.txt')
    await fs.writeFile(
      concatPath,
      normalizedClips.map(filePath => `file '${filePath.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`).join('\n'),
      'utf8',
    )

    const subtitlePath = path.join(workDir, 'subtitles.ass')
    await fs.writeFile(subtitlePath, buildAssSubtitles(params.scenes), 'utf8')

    const speechPath = path.join(workDir, 'speech.mp3')
    const ttsProvider = await createSpeechAudio(params.script, speechPath, params.scenes)

    const outputPath = path.join(workDir, 'output.mp4')
    await runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-i', speechPath,
      '-vf', 'subtitles=subtitles.ass:fontsdir=fonts',
      '-shortest',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ], workDir)

    const thumbnailPath = path.join(workDir, 'thumbnail.jpg')
    await runFfmpeg([
      '-y',
      '-ss', '00:00:01',
      '-i', outputPath,
      '-frames:v', '1',
      '-q:v', '3',
      thumbnailPath,
    ], workDir).catch(() => undefined)

    const [mp4Url, thumbnailUrl, ttsAudioUrl] = await Promise.all([
      storeAsset({
        userId: params.userId,
        fileName: `youtube-short-${safeFilePart(params.title)}-${randomUUID()}.mp4`,
        contentType: 'video/mp4',
        buffer: await fs.readFile(outputPath),
      }),
      readIfExists(thumbnailPath).then(buffer => buffer
        ? storeAsset({
          userId: params.userId,
          fileName: `youtube-short-${safeFilePart(params.title)}-${randomUUID()}.jpg`,
          contentType: 'image/jpeg',
          buffer,
        })
        : null),
      storeAsset({
        userId: params.userId,
        fileName: `youtube-short-tts-${randomUUID()}.mp3`,
        contentType: 'audio/mpeg',
        buffer: await fs.readFile(speechPath),
      }).catch(() => null),
    ])

    return { mp4Url, thumbnailUrl, ttsAudioUrl, ttsProvider }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function downloadVideo(url: string, outputPath: string) {
  const response = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`무료 영상 다운로드 실패: HTTP ${response.status}`)
  }
  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > MAX_SOURCE_VIDEO_BYTES) {
    throw new Error('무료 영상 파일이 너무 큽니다.')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_SOURCE_VIDEO_BYTES) {
    throw new Error('무료 영상 파일 크기가 올바르지 않습니다.')
  }
  await fs.writeFile(outputPath, buffer)
}

async function normalizeClip(params: {
  inputPath: string
  outputPath: string
  durationSeconds: number
}) {
  await runFfmpeg([
    '-y',
    '-stream_loop', '2',
    '-i', params.inputPath,
    '-t', String(params.durationSeconds),
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    params.outputPath,
  ])
}

async function createSpeechAudio(script: string, outputPath: string, scenes: YouTubeScenePlan[]) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.length < 10) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TTS 생성을 위한 OPENAI_API_KEY가 설정되어 있지 않습니다.')
    }
    await createSilentAudio(outputPath, scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0))
    return 'silent-dev'
  }

  const openai = new OpenAI({
    apiKey,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
  })
  const response = await openai.audio.speech.create({
    model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: process.env.OPENAI_TTS_VOICE || 'alloy',
    input: script.slice(0, TTS_MAX_CHARS),
    response_format: 'mp3',
  })
  await fs.writeFile(outputPath, Buffer.from(await response.arrayBuffer()))
  return process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
}

async function createSilentAudio(outputPath: string, durationSeconds: number) {
  await runFfmpeg([
    '-y',
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    '-t', String(Math.max(1, durationSeconds)),
    '-q:a', '9',
    '-acodec', 'libmp3lame',
    outputPath,
  ])
}

function buildAssSubtitles(scenes: YouTubeScenePlan[]) {
  let cursor = 0
  const events = scenes.map(scene => {
    const start = cursor
    const end = cursor + scene.durationSeconds
    cursor = end
    return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${escapeAssText(scene.narration)}`
  })

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Pretendard,72,&H00FFFFFF,&H000000FF,&HCC000000,&H88000000,-1,0,0,0,100,100,0,0,1,5,2,2,72,72,210,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
  ].join('\n')
}

function formatAssTime(totalSeconds: number) {
  const centiseconds = Math.round(totalSeconds * 100)
  const cs = centiseconds % 100
  const total = Math.floor(centiseconds / 100)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function escapeAssText(text: string) {
  return text
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, '\\N')
}

async function copyFontIfAvailable(fontsDir: string) {
  const source = path.join(REPO_ROOT, 'public', 'fonts', 'Pretendard-Bold.otf')
  try {
    await fs.copyFile(source, path.join(fontsDir, 'Pretendard-Bold.otf'))
  } catch {
    // FFmpeg will fall back to a system font when the bundled font is unavailable.
  }
}

async function runFfmpeg(args: string[], cwd?: string) {
  const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg'
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { cwd, windowsHide: true })
    let stderr = ''
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.slice(-1200) || `ffmpeg exited with code ${code}`))
    })
  })
}

async function storeAsset(params: {
  userId: string
  fileName: string
  contentType: 'video/mp4' | 'image/jpeg' | 'audio/mpeg'
  buffer: Buffer
}) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`generated/youtube/${params.userId}/${params.fileName}`, params.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: params.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return blob.url
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('렌더링 결과 저장을 위한 BLOB_READ_WRITE_TOKEN이 설정되어 있지 않습니다.')
  }

  const directory = path.join(REPO_ROOT, 'public', 'generated', 'youtube', params.userId)
  await fs.mkdir(directory, { recursive: true })
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
  await fs.writeFile(path.join(directory, safeName), params.buffer)
  return `/generated/youtube/${params.userId}/${safeName}`
}

async function readIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

function safeFilePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9가-힣._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'shorts'
}
