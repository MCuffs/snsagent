/**
 * Video card news pipeline
 *
 * Layout: 9:16 vertical (1080×1920)
 *   - Top half (1080×960):  Seedance video (3–5 sec loop)
 *   - Bottom half (1080×960): Black background + headline + body text
 */

import { SeedanceVideoProvider, canUseSeedance } from '../ai/providers/seedanceVideoProvider'
import { KlingVideoProvider, canUseKling } from '../ai/providers/klingVideoProvider'
import { buildCarouselVideoPrompts } from './videoPromptEngine'
import { getLightClient, getQwenModel } from '../ai/llmClient'
import type { EditorialSlideRole } from '../editorial/editorialDirector'

export interface VideoCardSlideInput {
  slideNumber: number
  role: EditorialSlideRole
  headline: string
  body: string
}

export interface VideoCardPipelineInput {
  userId: string
  brandId: string
  topic: string
  slides: VideoCardSlideInput[]
  domainLabel?: string
  brandTone?: string
  durationSeconds?: 3 | 5
  referenceImageUrls?: string[]
  signal?: AbortSignal
  onProgress?: (event: VideoCardProgressEvent) => void
}

export type VideoCardProgressEvent =
  | { type: 'copy_done'; slides: Array<{ slideNumber: number; role: string; headline: string; body: string }> }
  | { type: 'video_start'; slideNumber: number; total: number }
  | { type: 'video_polling'; slideNumber: number; elapsed: number }
  | { type: 'video_done'; slideNumber: number }
  | { type: 'video_error'; slideNumber: number; error: string }

export interface VideoCardSlideResult {
  slideNumber: number
  headline: string
  body: string
  role: EditorialSlideRole
  videoUrl: string | null
  videoPrompt: string
  durationSeconds: number
  error?: string
}

export interface VideoCardPipelineResult {
  slides: VideoCardSlideResult[]
  topic: string
  totalSlides: number
  partialFailures: number
}

interface VideoProviderFallbackInput {
  prompt: string
  duration: 3 | 5
  referenceImageUrls?: string[]
  signal?: AbortSignal
  klingProvider: KlingVideoProvider | null
  seedanceProvider: SeedanceVideoProvider | null
  onPoll: (elapsed: number) => void
}

interface UnifiedVideoResult {
  videoUrl: string
  durationSeconds: number
}

const HEADLINE_MAX_KO = 20
const HEADLINE_MAX_EN = 30
const BODY_MAX_KO = 100
const BODY_MAX_EN = 150

async function generateWithProviderFallback(input: VideoProviderFallbackInput): Promise<UnifiedVideoResult> {
  const options = {
    prompt: input.prompt,
    duration: input.duration,
    aspectRatio: '9:16' as const,
    referenceImageUrls: input.referenceImageUrls,
    signal: input.signal,
  }

  if (input.klingProvider) {
    try {
      console.log('[VideoCardPipeline] Trying Kling 3.0 video provider first')
      return await input.klingProvider.generateVideo(options, (event) => {
        if (event.type === 'poll') input.onPoll(event.elapsed)
      })
    } catch (error) {
      if (input.signal?.aborted) throw error
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VideoCardPipeline] Kling generation failed; falling back to Seedance:', message)
      if (!input.seedanceProvider) {
        throw new Error(`Kling generation failed and Seedance is not configured: ${message}`)
      }
    }
  }

  if (!input.seedanceProvider) {
    throw new Error('Seedance is not configured.')
  }

  const seedanceResult = await input.seedanceProvider.generateVideo(
    {
      ...options,
      resolution: '720p',
    },
    (event) => {
      if (event.type === 'poll') input.onPoll(event.elapsed)
    },
  )
  return seedanceResult
}

export async function generateVideoCardNews(
  input: VideoCardPipelineInput,
): Promise<VideoCardPipelineResult> {
  const useKling = canUseKling()
  const useSeedance = canUseSeedance()
  if (!useKling && !useSeedance) {
    throw new Error('No video provider is configured. Add KLINGAI_ACCESS_KEY/KLINGAI_SECRET_KEY or BYTEDANCE_API_KEY.')
  }

  const klingProvider = useKling ? new KlingVideoProvider() : null
  const seedanceProvider = useSeedance ? new SeedanceVideoProvider() : null
  const duration = input.durationSeconds ?? 5
  const onProgress = input.onProgress

  const prompts = buildCarouselVideoPrompts(
    input.slides,
    input.topic,
    input.domainLabel,
    input.brandTone,
    input.referenceImageUrls,
  )

  // Diagnostic: log pipeline inputs and first prompt for debugging
  console.log(`[VideoCardPipeline] generateVideoCardNews started`, {
    slideCount: input.slides.length,
    domainLabel: input.domainLabel ?? '(none)',
    brandTone: input.brandTone ?? '(none)',
    durationSeconds: duration,
    topicPreview: input.topic.slice(0, 100),
    firstPromptPreview: prompts[0]?.prompt.slice(0, 200) ?? '(empty)',
  })

  const generateOne = async (slide: VideoCardSlideInput, index: number): Promise<VideoCardSlideResult> => {
    input.signal?.throwIfAborted()
    const { prompt } = prompts[index]
    onProgress?.({ type: 'video_start', slideNumber: slide.slideNumber, total: input.slides.length })

    try {
      const videoResult = await generateWithProviderFallback({
        prompt,
        duration,
        referenceImageUrls: input.referenceImageUrls,
        signal: input.signal,
        klingProvider,
        seedanceProvider,
        onPoll: (elapsed) => {
          onProgress?.({ type: 'video_polling', slideNumber: slide.slideNumber, elapsed })
        },
      })
      onProgress?.({ type: 'video_done', slideNumber: slide.slideNumber })
      return {
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        role: slide.role,
        videoUrl: videoResult.videoUrl,
        videoPrompt: prompt,
        durationSeconds: videoResult.durationSeconds,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown video generation error'
      console.error(`[VideoCardPipeline] Slide ${slide.slideNumber} failed:`, msg)
      onProgress?.({ type: 'video_error', slideNumber: slide.slideNumber, error: msg })
      return {
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        role: slide.role,
        videoUrl: null,
        videoPrompt: prompt,
        durationSeconds: duration,
        error: msg,
      }
    }
  }

  // Process slides with a concurrency limit to avoid BytePlus API rate limits (429).
  // Each slide has its own 270s timeout; we allow at most 3 concurrent submissions.
  const MAX_CONCURRENCY = 3
  const results: VideoCardSlideResult[] = new Array(input.slides.length)

  let nextIndex = 0
  const worker = async () => {
    while (true) {
      input.signal?.throwIfAborted()
      const i = nextIndex++
      if (i >= input.slides.length) break
      results[i] = await generateOne(input.slides[i], i)
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENCY, input.slides.length) },
    () => worker(),
  )
  await Promise.all(workers)

  const partialFailures = results.filter(r => !r.videoUrl).length

  return {
    slides: results,
    topic: input.topic,
    totalSlides: input.slides.length,
    partialFailures,
  }
}

// LLM을 이용해 영상 카드뉴스용 슬라이드 카피 생성
export async function generateVideoCardCopy(params: {
  topic: string
  targetAndMessage?: string   // 사용자 입력: 타겟 독자층 + 핵심 메시지
  mood?: string               // 사용자 입력: 영상 분위기 (예: "감성적·따뜻한")
  slideCount: number
  brandTone?: string
  language: 'ko' | 'en'
  researchContext?: string   // injected from carouselResearch + RSS
}): Promise<VideoCardSlideInput[]> {
  const client = getLightClient()
  const { topic, targetAndMessage, mood, slideCount, language, researchContext } = params

  const isKo = language === 'ko'

  const researchBlock = researchContext
    ? (isKo
      ? `\n참고 자료 (최신 뉴스 및 리서치):\n${researchContext.slice(0, 2000)}\n`
      : `\nReference material (latest news & research):\n${researchContext.slice(0, 2000)}\n`)
    : ''

  // 구조화된 사용자 입력을 프롬프트에 명확하게 주입
  const audienceBlock = targetAndMessage
    ? (isKo
      ? `\n타겟 독자 및 핵심 메시지: ${targetAndMessage}\n`
      : `\nTarget audience & key message: ${targetAndMessage}\n`)
    : ''
  const moodBlock = mood
    ? (isKo
      ? `\n영상 분위기: ${mood}\n`
      : `\nVideo mood: ${mood}\n`)
    : ''

  const prompt = isKo
    ? `당신은 인스타그램 영상 카드뉴스 카피라이터입니다.
주제: "${topic}"${audienceBlock}${moodBlock}${researchBlock}
슬라이드 수: ${slideCount}장

각 슬라이드에 어울리는 짧고 강렬한 카피를 작성하세요.
- headline: 최대 ${HEADLINE_MAX_KO}자, 강렬하고 구체적
- body: 50~90자, 2~3문장, 완성된 문장

역할 순서: hook → context → key-point → detail → summary → save-cta (슬라이드 수에 맞게 조정)
- 3장: hook, key-point, save-cta
- 5장: hook, context, key-point, detail, save-cta
- 7장: hook, context, key-point, detail, detail, summary, save-cta

JSON으로만 응답:
{ "slides": [{ "slideNumber": 1, "role": "hook", "headline": "...", "body": "..." }] }`
    : `You are a vertical video card news copywriter for Instagram.
Topic: "${topic}"${audienceBlock}${moodBlock}${researchBlock}
Slides: ${slideCount}

Write short, punchy copy for each slide.
- headline: max ${HEADLINE_MAX_EN} chars, specific and bold
- body: 60-120 chars, 2 complete sentences

Role order: hook → context → key-point → detail → summary → save-cta (adjusted to slide count)
- 3 slides: hook, key-point, save-cta
- 5 slides: hook, context, key-point, detail, save-cta
- 7 slides: hook, context, key-point, detail, detail, summary, save-cta

Respond with JSON only:
{ "slides": [{ "slideNumber": 1, "role": "hook", "headline": "...", "body": "..." }] }`

  const result = await client.generateJson<{
    slides: Array<{ slideNumber: number; role: string; headline: string; body: string }>
  }>(
    'video-card-copy-generation',
    prompt,
    () => ({
      slides: buildFallbackSlides(slideCount, topic, isKo),
    }),
    { model: getQwenModel(), temperature: 0.4 },
  )

  const rawSlides = (result && Array.isArray(result.slides))
    ? result.slides
    : buildFallbackSlides(slideCount, topic, isKo)

  const validRoles = new Set(['hook', 'context', 'key-point', 'detail', 'stat', 'summary', 'save-cta'])
  const maxHeadline = isKo ? HEADLINE_MAX_KO : HEADLINE_MAX_EN
  const maxBody = isKo ? BODY_MAX_KO : BODY_MAX_EN

  return rawSlides.slice(0, slideCount).map(s => ({
    slideNumber: s.slideNumber,
    role: (validRoles.has(s.role) ? s.role : 'detail') as EditorialSlideRole,
    headline: truncate(s.headline || `슬라이드 ${s.slideNumber}`, maxHeadline),
    body: truncate(s.body || topic, maxBody),
  }))
}

function buildFallbackSlides(slideCount: number, topic: string, isKo: boolean) {
  const roleSequences: Record<number, string[]> = {
    3: ['hook', 'key-point', 'save-cta'],
    5: ['hook', 'context', 'key-point', 'detail', 'save-cta'],
    7: ['hook', 'context', 'key-point', 'detail', 'detail', 'summary', 'save-cta'],
  }
  const roles = roleSequences[slideCount] || ['hook', ...Array(slideCount - 2).fill('detail'), 'save-cta']
  return Array.from({ length: slideCount }, (_, i) => ({
    slideNumber: i + 1,
    role: roles[i] || 'detail',
    headline: isKo ? `슬라이드 ${i + 1}` : `Slide ${i + 1}`,
    body: topic,
  }))
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + '…'
}

