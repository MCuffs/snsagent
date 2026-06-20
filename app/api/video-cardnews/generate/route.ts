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
    const slides = await generateVideoCardCopy({
      topic,
      slideCount,
      brandTone: body.brandTone,
      language,
    })

    // 2. Generate Seedance videos for all slides in parallel
    const result = await generateVideoCardNews({
      userId: user.id,
      brandId,
      topic,
      slides,
      domainLabel: body.domainLabel,
      brandTone: body.brandTone,
      durationSeconds,
    })

    return NextResponse.json({
      success: true,
      topic: result.topic,
      totalSlides: result.totalSlides,
      slides: result.slides.map(s => ({
        slideNumber: s.slideNumber,
        headline: s.headline,
        body: s.body,
        role: s.role,
        videoUrl: s.videoUrl,
        durationSeconds: s.durationSeconds,
      })),
    })

  } catch (error) {
    console.error('[VideoCardNews] Generation failed:', error)
    const msg = error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
