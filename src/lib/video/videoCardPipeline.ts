/**
 * Video card news pipeline
 *
 * Layout: 9:16 vertical (1080×1920)
 *   - Top half (1080×960):  Seedance video (3–5 sec loop)
 *   - Bottom half (1080×960): Black background + headline + body text
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
}

interface VideoProviderFallbackInput {
  prompt: string
  duration: 3 | 5
  referenceImageUrls?: string[]
  signal?: AbortSignal
  klingProvider: KlingVideoProvider | null
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
    aspectRatio: '16:9' as const,
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

  const result = await client.generateJson<{
    slides: Array<{ slideNumber: number; role: string; headline: string; body: string }>
  }>(
    'video-card-copy-generation',
    prompt,
    () => ({
      slides: buildFallbackSlides(slideCount, topic, isKo),
    }),
    {
      model: getQwenModel(),
      temperature: 0.35,
      systemPrompt: isKo
        ? '짧은 한국어 SNS 영상 카드뉴스 카피라이터입니다. JSON만 반환하세요.'
        : 'You write concise vertical video card news copy. Return JSON only.',
    },
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

