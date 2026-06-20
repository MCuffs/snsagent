import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { generateVideoCardCopy, generateVideoCardNews } from '../../../../src/lib/video/videoCardPipeline'
import { canUseSeedance } from '../../../../src/lib/ai/providers/seedanceVideoProvider'

export const runtime = 'nodejs'
export const maxDuration = 300  // 5 minutes — video generation takes time

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  if (!canUseSeedance()) {
    return NextResponse.json(
      { error: '영상 생성 API가 준비되지 않았습니다. 관리자에게 문의하세요.' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json() as {
      topic: string
      brandId: string
      slideCount?: number
      durationSeconds?: 3 | 5
      domainLabel?: string
      brandTone?: string
      language?: 'ko' | 'en'
    }

    const { topic, brandId, slideCount = 5, durationSeconds = 5, language = 'ko' } = body

    if (!topic?.trim()) {
      return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 })
    }
    if (!brandId) {
      return NextResponse.json({ error: 'brandId가 필요합니다.' }, { status: 400 })
    }
    if (![3, 5, 7].includes(slideCount)) {
      return NextResponse.json({ error: '슬라이드 수는 3, 5, 7 중 하나여야 합니다.' }, { status: 400 })
    }

    // 1. Generate copy for all slides
    console.log(`[VideoCardNews] Copy generation: topic="${topic}", slides=${slideCount}, lang=${language}`)
    const slides = await generateVideoCardCopy({
      topic,
      slideCount,
      brandTone: body.brandTone,
      language,
    })

    console.log(`[VideoCardNews] Copy ready: ${slides.length} slides`, slides.map(s => `[${s.role}] ${s.headline}`).join(' | '))

    // 2. Generate Seedance videos with concurrency limit + partial failure tolerance
    console.log(`[VideoCardNews] Video generation start: ${slides.length} slides, ${durationSeconds}s each`)
    const result = await generateVideoCardNews({
      userId: user.id,
      brandId,
      topic,
      slides,
      domainLabel: body.domainLabel,
      brandTone: body.brandTone,
      durationSeconds,
    })

    const successSlides = result.slides.filter(s => s.videoUrl)
    const failedSlides = result.slides.filter(s => !s.videoUrl)

    if (successSlides.length === 0) {
      console.error('[VideoCardNews] All slides failed')
      return NextResponse.json(
        { error: '모든 영상 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 },
      )
    }

    if (failedSlides.length > 0) {
      console.warn(`[VideoCardNews] Partial failures: ${failedSlides.length}/${result.totalSlides} — slides ${failedSlides.map(s => s.slideNumber).join(', ')}`)
    }

    console.log(`[VideoCardNews] Done: ${successSlides.length}/${result.totalSlides} succeeded`)

    return NextResponse.json({
      success: true,
      topic: result.topic,
      totalSlides: result.totalSlides,
      partialFailures: result.partialFailures,
      slides: result.slides.map(s => ({
        slideNumber: s.slideNumber,
        headline: s.headline,
        body: s.body,
        role: s.role,
        videoUrl: s.videoUrl,
        durationSeconds: s.durationSeconds,
        error: s.error || null,
      })),
    })

  } catch (error) {
    console.error('[VideoCardNews] Generation failed:', error)
    const msg = error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
