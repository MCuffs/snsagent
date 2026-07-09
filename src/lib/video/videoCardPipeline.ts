/**
 * Video card news pipeline
 *
 * Layout: 4:5 vertical card (1080×1350)
 *   - Top half (1080×675):  Kling video (3–5 sec loop)
 *   - Bottom half (1080×675): Black background + headline + body text
 */

import { KlingVideoProvider, canUseKling } from '../ai/providers/klingVideoProvider'
import { buildCarouselVideoPrompts } from './videoPromptEngine'
import { getLightClient, getQwenModel } from '../ai/llmClient'
import type { EditorialSlideRole } from '../editorial/editorialDirector'

export interface VideoCardSlideInput {
  slideNumber: number
  role: EditorialSlideRole
  headline: string
  body: string
  videoPrompt?: string
}

export interface VideoCardPipelineInput {
  userId: string
  brandId: string
  topic: string
  slides: VideoCardSlideInput[]
  domainLabel?: string
  brandTone?: string
  durationSeconds?: 3 | 5
  videoContinuityMode?: 'separate' | 'continuous'
  referenceImageUrls?: string[]
  signal?: AbortSignal
  // Absolute time (Date.now() basis) by which video generation must finish.
  // Keeps sequential Kling polling inside the serverless function budget so the
  // user gets an explicit error instead of the function being killed mid-stream.
  deadlineAt?: number
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
  videoStartSec?: number
  durationSeconds: number
  error?: string
}

export interface VideoCardPipelineResult {
  slides: VideoCardSlideResult[]
  topic: string
  totalSlides: number
}

interface VideoProviderFallbackInput {
  prompt: string
  duration: 3 | 5 | 10
  referenceImageUrls?: string[]
  signal?: AbortSignal
  klingProvider: KlingVideoProvider | null
  timeoutMs?: number
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
const CONTINUOUS_SEGMENT_SECONDS = 3
const CONTINUOUS_SOURCE_SECONDS = 10

async function generateWithProviderFallback(input: VideoProviderFallbackInput): Promise<UnifiedVideoResult> {
  const options = {
    prompt: input.prompt,
    duration: input.duration,
    aspectRatio: '16:9' as const,
    referenceImageUrls: input.referenceImageUrls,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
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
      console.warn('[VideoCardPipeline] Kling generation failed; Seedance fallback is disabled:', message)
      throw new Error(`Kling generation failed: ${message}`)
    }
  }

  throw new Error('Kling is not configured. Seedance fallback is currently disabled.')
}

export async function generateVideoCardNews(
  input: VideoCardPipelineInput,
): Promise<VideoCardPipelineResult> {
  const useKling = canUseKling()
  if (!useKling) {
    throw new Error('Kling video provider is not configured. Add KLINGAI_API_KEY or KLINGAI_ACCESS_KEY/KLINGAI_SECRET_KEY.')
  }

  const klingProvider = useKling ? new KlingVideoProvider() : null
  const duration = input.durationSeconds ?? 5
  const shouldGenerateContinuousSource = input.videoContinuityMode === 'continuous' && input.slides.length === 3
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
    videoContinuityMode: input.videoContinuityMode ?? 'separate',
    topicPreview: input.topic.slice(0, 100),
    firstPromptPreview: prompts[0]?.prompt.slice(0, 200) ?? '(empty)',
  })

  const MIN_CLIP_BUDGET_MS = 45_000
  const remainingBudgetMs = () => (input.deadlineAt ? input.deadlineAt - Date.now() : null)
  const ensureClipBudget = (completedCount: number) => {
    const remaining = remainingBudgetMs()
    if (remaining !== null && remaining < MIN_CLIP_BUDGET_MS) {
      throw new Error(
        `서버 처리 시간 예산이 부족해 영상 생성을 중단했습니다 (${completedCount}/${input.slides.length}개 완료). ` +
        '슬라이드 수를 줄이거나 잠시 후 다시 시도해 주세요.',
      )
    }
    return remaining
  }

  const generateOne = async (slide: VideoCardSlideInput, index: number): Promise<VideoCardSlideResult> => {
    input.signal?.throwIfAborted()
    const remaining = ensureClipBudget(index)
    const prompt = slide.videoPrompt?.trim() || prompts[index].prompt
    onProgress?.({ type: 'video_start', slideNumber: slide.slideNumber, total: input.slides.length })

    try {
      const videoResult = await generateWithProviderFallback({
        prompt,
        duration,
        referenceImageUrls: input.referenceImageUrls,
        signal: input.signal,
        klingProvider,
        timeoutMs: remaining ?? undefined,
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
      throw new Error(`슬라이드 ${slide.slideNumber} 영상 생성 실패: ${msg}`)
    }
  }

  const results: VideoCardSlideResult[] = []
  if (shouldGenerateContinuousSource) {
    const continuousPrompt = buildContinuousVideoPrompt(input.slides, prompts.map(prompt => prompt.prompt), input.topic)
    try {
      input.signal?.throwIfAborted()
      for (const slide of input.slides) {
        onProgress?.({ type: 'video_start', slideNumber: slide.slideNumber, total: input.slides.length })
      }
      const videoResult = await generateWithProviderFallback({
        prompt: continuousPrompt,
        duration: CONTINUOUS_SOURCE_SECONDS,
        referenceImageUrls: input.referenceImageUrls,
        signal: input.signal,
        klingProvider,
        timeoutMs: ensureClipBudget(0) ?? undefined,
        onPoll: (elapsed) => {
          onProgress?.({ type: 'video_polling', slideNumber: input.slides[0].slideNumber, elapsed })
        },
      })
      for (const slide of input.slides) {
        onProgress?.({ type: 'video_done', slideNumber: slide.slideNumber })
      }
      return {
        slides: input.slides.map((slide, index) => ({
          slideNumber: slide.slideNumber,
          headline: slide.headline,
          body: slide.body,
          role: slide.role,
          videoUrl: videoResult.videoUrl,
          videoPrompt: continuousPrompt,
          videoStartSec: index * CONTINUOUS_SEGMENT_SECONDS,
          durationSeconds: CONTINUOUS_SEGMENT_SECONDS,
        })),
        topic: input.topic,
        totalSlides: input.slides.length,
      }
    } catch (error) {
      if (input.signal?.aborted) throw error
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VideoCardPipeline] Continuous source generation failed; falling back to separate clips:', message)
      for (const slide of input.slides) {
        onProgress?.({ type: 'video_error', slideNumber: slide.slideNumber, error: `연결 영상 생성 실패, 개별 생성으로 전환: ${message}` })
      }
    }
  }

  for (let i = 0; i < input.slides.length; i += 1) {
    input.signal?.throwIfAborted()
    results.push(await generateOne(input.slides[i], i))
  }

  return {
    slides: results,
    topic: input.topic,
    totalSlides: input.slides.length,
  }
}

function buildContinuousVideoPrompt(
  slides: VideoCardSlideInput[],
  generatedPrompts: string[],
  topic: string,
) {
  const timeline = slides
    .map((slide, index) => {
      const start = index * CONTINUOUS_SEGMENT_SECONDS
      const end = start + CONTINUOUS_SEGMENT_SECONDS
      const sourcePrompt = slide.videoPrompt?.trim() || generatedPrompts[index] || ''
      return `${start}-${end}s / Card ${slide.slideNumber} (${slide.role})
Headline overlay planned by app: "${slide.headline}"
Body overlay planned by app: "${slide.body}"
Visual direction only: ${sourcePrompt.slice(0, 1200)}`
    })
    .join('\n\n')

  return `Create one continuous ${CONTINUOUS_SOURCE_SECONDS}-second cinematic video source for a 3-card video card news sequence.
The final app will split this single video into three 3-second card segments at 0s, 3s, and 6s. Do not make three unrelated clips.
Keep the same visual world, subject identity, lighting, camera language, and motion continuity across the full sequence.
Use smooth transitions between each timeline beat. Avoid abrupt scene resets unless the user explicitly requested an impact moment.
All readable Korean/English text, subtitles, titles, URLs, logos, UI, and card body copy will be added by the app overlay. Do not render readable text inside the generated video unless the visual direction explicitly requires a physical object with text.
Topic: ${topic.slice(0, 500)}

Timeline:
${timeline}

Output: wide 16:9 cinematic video, clean composition, subtle realistic motion, no unrelated stock footage, no extra captions.`
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
      ? `\n참고: ${researchContext.slice(0, 1200)}\n`
      : `\nReference: ${researchContext.slice(0, 1200)}\n`)
    : ''

  const audienceBlock = targetAndMessage
    ? (isKo
      ? `\n타겟/메시지: ${targetAndMessage.slice(0, 500)}`
      : `\nAudience/message: ${targetAndMessage.slice(0, 500)}`)
    : ''
  const moodBlock = mood
    ? (isKo
      ? `\n분위기: ${mood.slice(0, 300)}`
      : `\nMood: ${mood.slice(0, 300)}`)
    : ''

  const prompt = isKo
    ? `영상 카드뉴스 카피 생성.
입력: 주제="${topic.slice(0, 700)}"${audienceBlock}${moodBlock}${researchBlock}
슬라이드=${slideCount}, 역할=${getRoleSequence(slideCount).join(',')}
규칙: headline ${HEADLINE_MAX_KO}자 이하, body ${BODY_MAX_KO}자 이하의 완성문. 근거 없는 수치/사실 금지. 내부 기획 라벨 금지.
JSON만: {"slides":[{"slideNumber":1,"role":"hook","headline":"...","body":"..."}]}`
    : `Create vertical video card news copy.
Input: topic="${topic.slice(0, 700)}"${audienceBlock}${moodBlock}${researchBlock}
slides=${slideCount}, roles=${getRoleSequence(slideCount).join(',')}
Rules: headline <=${HEADLINE_MAX_EN} chars, body <=${BODY_MAX_EN} chars, complete sentences. No unsupported facts or internal planning labels.
JSON only: {"slides":[{"slideNumber":1,"role":"hook","headline":"...","body":"..."}]}`

  // Precompute the fallback so we can detect (by identity) that the LLM call failed.
  // Placeholder copy must never reach the expensive video-generation stage.
  const fallbackSlides = buildFallbackSlides(slideCount, topic, isKo)
  const result = await client.generateJson<{
    slides: Array<{ slideNumber: number; role: string; headline: string; body: string }>
  }>(
    'video-card-copy-generation',
    prompt,
    () => ({
      slides: fallbackSlides,
    }),
    {
      model: getQwenModel(),
      temperature: 0.35,
      systemPrompt: isKo
        ? '짧은 한국어 SNS 영상 카드뉴스 카피라이터입니다. JSON만 반환하세요.'
        : 'You write concise vertical video card news copy. Return JSON only.',
    },
  )

  if (!result || !Array.isArray(result.slides) || result.slides === fallbackSlides) {
    throw new Error(isKo
      ? 'AI 카피 생성에 실패했습니다. 영상 생성은 시작되지 않았으니 잠시 후 다시 시도해 주세요.'
      : 'AI copy generation failed. Video generation was not started — please retry in a moment.')
  }
  const rawSlides = result.slides

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
  const roles = getRoleSequence(slideCount)
  return Array.from({ length: slideCount }, (_, i) => ({
    slideNumber: i + 1,
    role: roles[i] || 'detail',
    headline: isKo ? `슬라이드 ${i + 1}` : `Slide ${i + 1}`,
    body: topic,
  }))
}

function getRoleSequence(slideCount: number) {
  const roleSequences: Record<number, string[]> = {
    3: ['hook', 'key-point', 'save-cta'],
    5: ['hook', 'context', 'key-point', 'detail', 'save-cta'],
    7: ['hook', 'context', 'key-point', 'detail', 'detail', 'summary', 'save-cta'],
  }
  return roleSequences[slideCount] || ['hook', ...Array(Math.max(0, slideCount - 2)).fill('detail'), 'save-cta']
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1).trimEnd() + '…'
}
