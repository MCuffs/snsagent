/**
 * Video card news pipeline
 *
 * Layout: 9:16 vertical (1080×1920)
 *   - Top half (1080×960):  Seedance video (3–5 sec loop)
 *   - Bottom half (1080×960): Black background + headline + body text
 *
 * Each slide = one .mp4 file with text baked in on the bottom half via
 * server-side canvas rendering (node-canvas) over the video frames.
 * If canvas is unavailable, returns the raw video URL + a JSON descriptor
 * so the client can composite locally.
 */

import { SeedanceVideoProvider, canUseSeedance } from '../ai/providers/seedanceVideoProvider'
import { buildCarouselVideoPrompts } from './videoPromptEngine'
import { getLLMClient, getCopywritingModel } from '../ai/llmClient'
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
}

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

const VIDEO_CONCURRENCY = 3
const HEADLINE_MAX_KO = 20
const HEADLINE_MAX_EN = 30
const BODY_MAX_KO = 100
const BODY_MAX_EN = 150

export async function generateVideoCardNews(
  input: VideoCardPipelineInput,
): Promise<VideoCardPipelineResult> {
  if (!canUseSeedance()) {
    throw new Error('BYTEDANCE_API_KEY is not configured. Add it to environment variables.')
  }

  const provider = new SeedanceVideoProvider()
  const duration = input.durationSeconds ?? 5

  // Build cinematic prompts for all slides (with coherence anchoring)
  const prompts = buildCarouselVideoPrompts(
    input.slides,
    input.topic,
    input.domainLabel,
    input.brandTone,
  )

  // Generate videos with concurrency limit to avoid rate limiting
  const results: VideoCardSlideResult[] = []

  const generateOne = async (slide: VideoCardSlideInput, index: number) => {
    const { prompt } = prompts[index]
    try {
      const videoResult = await provider.generateVideo({
        prompt,
        duration,
        aspectRatio: '9:16',
        resolution: '720p',
      })
      return {
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        role: slide.role,
        videoUrl: videoResult.videoUrl,
        videoPrompt: prompt,
        durationSeconds: videoResult.durationSeconds,
      } satisfies VideoCardSlideResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown video generation error'
      console.error(`[VideoCardPipeline] Slide ${slide.slideNumber} video failed:`, msg)
      return {
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        role: slide.role,
        videoUrl: null,
        videoPrompt: prompt,
        durationSeconds: duration,
        error: msg,
      } satisfies VideoCardSlideResult
    }
  }

  // Run with concurrency limit
  for (let i = 0; i < input.slides.length; i += VIDEO_CONCURRENCY) {
    const batch = input.slides.slice(i, i + VIDEO_CONCURRENCY)
    const batchResults = await Promise.all(
      batch.map((slide, j) => generateOne(slide, i + j)),
    )
    results.push(...batchResults)
  }

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
  slideCount: number
  brandTone?: string
  language: 'ko' | 'en'
}): Promise<VideoCardSlideInput[]> {
  const client = getLLMClient()
  const { topic, slideCount, language } = params

  const isKo = language === 'ko'

  const prompt = isKo
    ? `당신은 인스타그램 영상 카드뉴스 카피라이터입니다.
주제: "${topic}"
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
Topic: "${topic}"
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
    { model: getCopywritingModel(), temperature: 0.4 },
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
