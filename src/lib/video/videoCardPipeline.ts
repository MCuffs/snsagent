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
  videoUrl: string          // Seedance raw video URL (top half content)
  videoPrompt: string       // prompt used
  durationSeconds: number
}

export interface VideoCardPipelineResult {
  slides: VideoCardSlideResult[]
  topic: string
  totalSlides: number
}

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

  // Generate all videos in parallel
  const results = await Promise.all(
    input.slides.map(async (slide, index) => {
      const { prompt } = prompts[index]

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
    }),
  )

  return {
    slides: results,
    topic: input.topic,
    totalSlides: input.slides.length,
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
- headline: 15자 이하, 강렬하고 구체적
- body: 50~90자, 2~3문장, 완성된 문장

역할 순서: hook → context → key-point → detail → summary → save-cta (슬라이드 수에 맞게 조정)

JSON으로만 응답:
{ "slides": [{ "slideNumber": 1, "role": "hook", "headline": "...", "body": "..." }] }`
    : `You are a vertical video card news copywriter for Instagram.
Topic: "${topic}"
Slides: ${slideCount}

Write short, punchy copy for each slide.
- headline: under 25 chars, specific and bold
- body: 60-120 chars, 2 complete sentences

Role order: hook → context → key-point → detail → summary → save-cta (adjusted to slide count)

Respond with JSON only:
{ "slides": [{ "slideNumber": 1, "role": "hook", "headline": "...", "body": "..." }] }`

  const result = await client.generateJson<{
    slides: Array<{ slideNumber: number; role: string; headline: string; body: string }>
  }>(
    'video-card-copy-generation',
    prompt,
    () => ({
      slides: Array.from({ length: slideCount }, (_, i) => ({
        slideNumber: i + 1,
        role: i === 0 ? 'hook' : i === slideCount - 1 ? 'save-cta' : 'detail',
        headline: `슬라이드 ${i + 1}`,
        body: topic,
      })),
    }),
    { model: getCopywritingModel(), temperature: 0.4 },
  )

  const validRoles = new Set(['hook', 'context', 'key-point', 'detail', 'stat', 'summary', 'save-cta'])

  return result.slides.slice(0, slideCount).map(s => ({
    slideNumber: s.slideNumber,
    role: (validRoles.has(s.role) ? s.role : 'detail') as EditorialSlideRole,
    headline: s.headline,
    body: s.body,
  }))
}
