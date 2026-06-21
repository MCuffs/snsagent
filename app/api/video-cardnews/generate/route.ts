import { NextRequest } from 'next/server'
import { getSessionUser } from '../../../actions'
import { generateVideoCardCopy, generateVideoCardNews } from '../../../../src/lib/video/videoCardPipeline'
import { canUseSeedance } from '../../../../src/lib/ai/providers/seedanceVideoProvider'
import { dbService } from '../../../../lib/db-service'
import { buildCarouselResearchBrief, formatResearchBriefForPrompt } from '../../../../src/lib/research/carouselResearch'
import { buildRssContext, extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../src/lib/rss/rssFetcher'
import { persistGeneratedVideo } from '../../../../lib/video-storage'

export const runtime = 'nodejs'
export const maxDuration = 600  // 10 minutes — all slides generate in parallel, each up to 270s

function sse(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(payload))
}

function tomorrowAt20() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(20, 0, 0, 0)
  return date
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!canUseSeedance()) {
    return new Response(
      JSON.stringify({ error: '영상 생성 API가 준비되지 않았습니다. 관리자에게 문의하세요.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let body: {
    topic: string
    brandId: string
    slideCount?: number
    durationSeconds?: 3 | 5
    domainLabel?: string
    brandTone?: string
    language?: 'ko' | 'en'
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식이 올바르지 않습니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { topic, brandId, slideCount = 5, durationSeconds = 5, language = 'ko' } = body

  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: '주제를 입력해주세요.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!brandId) {
    return new Response(JSON.stringify({ error: 'brandId가 필요합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (![3, 5, 7].includes(slideCount)) {
    return new Response(JSON.stringify({ error: '슬라이드 수는 3, 5, 7 중 하나여야 합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage 1: Research & RSS context gathering
        sse(controller, 'stage', { stage: 'research', message: '최신 뉴스와 정보를 수집하는 중...' })

        let researchContext = ''
        try {
          const researchBrief = await buildCarouselResearchBrief({
            topic,
            category: body.domainLabel,
            keyContent: topic,
            slideCount,
            language,
          })
          researchContext = formatResearchBriefForPrompt(researchBrief, language)
          if (researchContext) {
            console.log(`[VideoCardNews:Research] ${researchBrief?.verifiedFacts.length ?? 0} facts, ${researchBrief?.sources.length ?? 0} sources for "${topic}"`)
          }
        } catch (err) {
          console.warn('[VideoCardNews:Research] Research brief failed, continuing without it:', err)
        }

        // RSS fallback if research returned nothing
        if (!researchContext) {
          try {
            const keywords = extractGenerationKeywords(topic, [body.domainLabel || ''])
            const rssResult = await fetchRssForGeneration({
              category: inferRssCategory(topic, body.domainLabel || 'information'),
              keywords,
              topic,
              limit: 5,
              language,
            })
            const rssCtx = buildRssContext(rssResult, language)
            if (rssCtx) {
              researchContext = rssCtx
              console.log(`[VideoCardNews:RSS] Injected ${rssResult.articles.length} articles for "${topic}"`)
            }
          } catch (err) {
            console.warn('[VideoCardNews:RSS] RSS fetch failed, continuing without it:', err)
          }
        }

        // Stage 2: Copy generation
        sse(controller, 'stage', { stage: 'copy', message: '슬라이드 카피 기획 중...' })

        let slides: Awaited<ReturnType<typeof generateVideoCardCopy>>
        try {
          slides = await generateVideoCardCopy({
            topic,
            slideCount,
            brandTone: body.brandTone,
            language,
            researchContext: researchContext || undefined,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          sse(controller, 'error', { stage: 'copy', error: `카피 생성 실패: ${msg}` })
          controller.close()
          return
        }

        sse(controller, 'copy_done', {
          slides: slides.map(s => ({ slideNumber: s.slideNumber, role: s.role, headline: s.headline })),
        })

        // Stage 2: Video generation
        sse(controller, 'stage', {
          stage: 'video',
          message: `${slides.length}개 영상 동시 생성 시작 (슬라이드당 약 1~4분)...`,
          total: slides.length,
        })

        const result = await generateVideoCardNews({
          userId: user.id,
          brandId,
          topic,
          slides,
          domainLabel: body.domainLabel,
          brandTone: body.brandTone,
          durationSeconds,
          onProgress: (event) => {
            if (event.type === 'video_start') {
              sse(controller, 'slide_start', {
                slideNumber: event.slideNumber,
                total: event.total,
                message: `슬라이드 ${event.slideNumber}/${event.total} 영상 생성 시작...`,
              })
            } else if (event.type === 'video_polling') {
              sse(controller, 'slide_polling', {
                slideNumber: event.slideNumber,
                elapsed: event.elapsed,
                message: `슬라이드 ${event.slideNumber} 렌더링 중... (${event.elapsed}초)`,
              })
            } else if (event.type === 'video_done') {
              sse(controller, 'slide_done', {
                slideNumber: event.slideNumber,
                message: `슬라이드 ${event.slideNumber} 완료 ✓`,
              })
            } else if (event.type === 'video_error') {
              sse(controller, 'slide_error', {
                slideNumber: event.slideNumber,
                error: event.error,
                message: `슬라이드 ${event.slideNumber} 실패: ${event.error}`,
              })
            }
          },
        })

        // Provider URLs may expire. Persist each successful result before saving the campaign.
        sse(controller, 'stage', { stage: 'saving', message: '생성 영상을 영구 저장소로 옮기는 중...' })
        const durableSlides: typeof result.slides = []
        for (const slide of result.slides) {
          if (!slide.videoUrl) {
            durableSlides.push(slide)
            continue
          }
          try {
            const durableUrl = await persistGeneratedVideo({
              sourceUrl: slide.videoUrl,
              userId: user.id,
              slideNumber: slide.slideNumber,
            })
            durableSlides.push({ ...slide, videoUrl: durableUrl })
          } catch (error) {
            const message = error instanceof Error ? error.message : '영상 영구 저장 실패'
            console.error(`[VideoCardNews] Slide ${slide.slideNumber} persistence failed:`, message)
            durableSlides.push({ ...slide, videoUrl: null, error: message })
            sse(controller, 'slide_error', {
              slideNumber: slide.slideNumber,
              error: message,
              message: `슬라이드 ${slide.slideNumber} 저장 실패: ${message}`,
            })
          }
        }

        const successSlides = durableSlides.filter(s => s.videoUrl)
        const failedSlides = durableSlides.filter(s => !s.videoUrl)

        if (successSlides.length === 0) {
          const firstError = failedSlides[0]?.error ?? '알 수 없는 오류'
          console.error('[VideoCardNews] All slides failed:', failedSlides.map(s => s.error))
          sse(controller, 'error', {
            stage: 'video',
            error: `모든 영상 생성에 실패했습니다: ${firstError}`,
          })
          controller.close()
          return
        }

        if (failedSlides.length > 0) {
          console.warn(`[VideoCardNews] Partial failures: ${failedSlides.length}/${result.totalSlides}`)
        }

        // Stage 3: Save to DB and redirect to campaign editor
        sse(controller, 'stage', { stage: 'saving', message: '캠페인 저장 중...' })

        const campaign = await dbService.createCampaign(
          user.id,
          brandId,
          {
            title: `${topic} 영상 카드뉴스`,
            productName: topic,
            productDescription: topic,
            keyBenefits: '영상 카드뉴스',
            objective: '영상 카드뉴스',
            slideCount: durableSlides.length,
            imageModel: 'seedance-1-5-pro-251215',
            initialImageCount: successSlides.length,
            mediaType: 'video',
          },
          durableSlides.map(s => ({
            slideNumber: s.slideNumber,
            headline: s.headline,
            body: s.body,
            designPrompt: s.videoPrompt,
            // imageUrl: rendered png/svg (none for video — use videoUrl as background)
            imageUrl: null,
            backgroundImageUrl: null,
            mediaType: s.videoUrl ? 'video' : 'image',
            videoUrl: s.videoUrl,
            videoStartSec: 0,
            videoDurationSec: s.durationSeconds,
          }))
        )

        await dbService.updateCampaignStatus(campaign.id, 'pending_approval')

        const post = await dbService.createPost(user.id, brandId, campaign.id, {
          caption: `${topic} 영상 카드뉴스`,
          hashtags: '#카드뉴스 #영상카드뉴스 #숏폼',
          scheduledAt: tomorrowAt20(),
        })
        void dbService.updatePostStatus(post.id, 'pending_approval')

        sse(controller, 'done', {
          success: true,
          campaignId: campaign.id,
          topic: result.topic,
          totalSlides: durableSlides.length,
          partialFailures: failedSlides.length,
          slides: durableSlides.map(s => ({
            slideNumber: s.slideNumber,
            headline: s.headline,
            body: s.body,
            role: s.role,
            videoUrl: s.videoUrl,
            durationSeconds: s.durationSeconds,
            error: s.error ?? null,
          })),
        })

      } catch (error) {
        const msg = error instanceof Error ? error.message : '영상 생성 중 오류가 발생했습니다.'
        console.error('[VideoCardNews] Unhandled error:', error)
        sse(controller, 'error', { stage: 'unknown', error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
