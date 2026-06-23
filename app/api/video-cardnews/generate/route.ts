import { NextRequest } from 'next/server'
import { getSessionUser } from '../../../actions/auth'
import { generateVideoCardCopy, generateVideoCardNews } from '../../../../src/lib/video/videoCardPipeline'
import { canUseKling, getKlingVideoModel } from '../../../../src/lib/ai/providers/klingVideoProvider'
import { dbService } from '../../../../lib/db-service'
import { buildCarouselResearchBrief, formatResearchBriefForPrompt } from '../../../../src/lib/research/carouselResearch'
import { buildRssContext, extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../src/lib/rss/rssFetcher'
import { persistGeneratedVideo } from '../../../../lib/video-storage'
import { checkVideoCardNewsLimit } from '../../../../lib/limits'
import { inferContentDomain } from '../../../../src/lib/content/domainProfile'
import type { ContentDomain } from '../../../../src/lib/content/domainProfile'
import { getLightClient, getQwenModel } from '../../../../src/lib/ai/llmClient'

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

function cleanCaptionLine(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[#*_`~]/g, '')
    .trim()
}

function truncateCaption(text: string, maxLength = 700) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function shouldUseNewsResearch(input: {
  topic: string
  targetAndMessage?: string
  mood?: string
  domainLabel?: string
}) {
  const text = [
    input.topic,
    input.targetAndMessage ?? '',
    input.mood ?? '',
    input.domainLabel ?? '',
  ].join(' ')
    .replace(/영상\s*카드뉴스|카드\s*뉴스|카드뉴스|video\s*card\s*news|card\s*news/gi, ' ')
    .toLowerCase()

  const explicitNewsSignals = [
    /최신|최근|요즘|오늘|어제|이번\s*(주|달|분기|해|년도)|\b202[0-9]\b/u,
    /뉴스|이슈|속보|논란|쟁점|동향|트렌드|시장|정책|정부|국회|대통령|선거|법원|검찰|경찰/u,
    /발표|공시|보고서|통계|자료|연구|조사|리서치|랭킹|순위|비교|전망/u,
    /\b(news|latest|recent|today|trend|issue|market|policy|report|survey|research|statistics|ranking|forecast)\b/i,
  ]
  const internalBriefSignals = [
    /사용법|방법|가이드|튜토리얼|온보딩|안내|소개|홍보|브랜딩|브랜드|제품|서비스|메뉴|이벤트|캠페인/u,
    /쉽게|빠르게|만드는 법|활용법|시작하기|예약|접수|구매|혜택|쿠폰|프로모션/u,
    /\b(how to|guide|tutorial|onboarding|intro|promotion|brand|product|service|campaign|event)\b/i,
  ]

  const hasExplicitNewsSignal = explicitNewsSignals.some(pattern => pattern.test(text))
  if (hasExplicitNewsSignal) {
    return { useNews: true, reason: 'explicit-current-or-factual-signal' }
  }

  if ((input.domainLabel ?? '').toLowerCase() === 'news') {
    return { useNews: true, reason: 'news-domain' }
  }

  const looksLikeInternalBrief = internalBriefSignals.some(pattern => pattern.test(text))
  if (looksLikeInternalBrief) {
    return { useNews: false, reason: 'internal-brief-or-how-to' }
  }

  return { useNews: false, reason: 'no-current-context-needed' }
}

function buildVideoCardSummaryCaption(
  topic: string,
  slides: Array<{ headline: string; body: string; role: string; videoUrl: string | null }>,
  language: 'ko' | 'en',
) {
  const summarySlides = slides.filter(slide => slide.videoUrl && slide.role !== 'save-cta')
  const sourceSlides = summarySlides.length > 0 ? summarySlides : slides.filter(slide => slide.videoUrl)
  const lines = sourceSlides
    .map(slide => cleanCaptionLine(`${slide.headline}. ${slide.body}`))
    .filter(Boolean)
    .slice(0, 4)

  if (language === 'en') {
    return truncateCaption([
      `${topic} is summarized as a video card news story.`,
      ...lines,
    ].join('\n\n'))
  }

  return truncateCaption([
    `${topic}에 대한 핵심 내용을 영상 카드뉴스로 요약했습니다.`,
    ...lines,
  ].join('\n\n'))
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!canUseKling()) {
    return new Response(
      JSON.stringify({ error: '영상 생성 API가 준비되지 않았습니다. 관리자에게 문의하세요.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Quota check
  const videoUsage = await checkVideoCardNewsLimit(user.id)
  if (!videoUsage.allowed) {
    const msg = videoUsage.period === 'lifetime'
      ? `무료 플랜은 영상 카드뉴스를 ${videoUsage.limit}회만 생성할 수 있습니다. 계속 생성하려면 Creator 플랜을 선택해 주세요.`
      : `이번 달 영상 카드뉴스 생성 횟수(${videoUsage.limit}회)를 초과했습니다. (${videoUsage.current}/${videoUsage.limit})`
    return new Response(JSON.stringify({ error: msg }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    topic: string
    targetAndMessage?: string
    mood?: string
    brandId: string
    slideCount?: number
    durationSeconds?: 3 | 5
    domainLabel?: string
    brandTone?: string
    language?: 'ko' | 'en'
    referenceImageUrls?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식이 올바르지 않습니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { topic, targetAndMessage, mood, brandId, slideCount = 5, durationSeconds = 5, language = 'ko' } = body

  // Resolve domain from topic + industry + target/message using the shared domainProfile engine.
  // This maps Korean industry labels (e.g. "카페/F&B") to English domain keys (e.g. "food")
  // that DOMAIN_VISUAL_STYLE in videoPromptEngine understands.
  const resolvedDomain: ContentDomain = inferContentDomain(topic, body.domainLabel, targetAndMessage)
  const domainLabel = resolvedDomain === 'general' ? (body.domainLabel ?? 'general') : resolvedDomain
  console.log(`[VideoCardNews] domain resolution: industry="${body.domainLabel}" → domain="${resolvedDomain}"`)
  const referenceImageUrls = Array.isArray(body.referenceImageUrls)
    ? body.referenceImageUrls.filter(url => typeof url === 'string' && /^https?:\/\//.test(url)).slice(0, 3)
    : []

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
        let researchContext = ''
        const newsDecision = shouldUseNewsResearch({ topic, targetAndMessage, mood, domainLabel })
        console.log(`[VideoCardNews:ResearchDecision] useNews=${newsDecision.useNews} reason=${newsDecision.reason} topic="${topic.slice(0, 120)}"`)

        if (newsDecision.useNews) {
          // Stage 1: Research & RSS context gathering
          sse(controller, 'stage', { stage: 'research', message: '최신 뉴스와 정보를 수집하는 중...' })

          try {
            const researchBrief = await buildCarouselResearchBrief({
              topic,
              category: domainLabel,
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
              const keywords = extractGenerationKeywords(topic, [domainLabel])
              const rssResult = await fetchRssForGeneration({
                category: inferRssCategory(topic, domainLabel),
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
        }

        // Stage 2: Copy generation
        sse(controller, 'stage', { stage: 'copy', message: '슬라이드 카피 기획 중...' })

        let slides: Awaited<ReturnType<typeof generateVideoCardCopy>>
        try {
          slides = await generateVideoCardCopy({
            topic,
            targetAndMessage,
            mood,
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
          slides: slides.map(s => ({
            slideNumber: s.slideNumber,
            role: s.role,
            headline: s.headline,
            body: s.body,
          })),
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
          domainLabel,
          brandTone: body.brandTone,
          durationSeconds,
          referenceImageUrls,
          signal: request.signal,
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

        // Summarize the topic into a short title (max 20 chars)
        let summarizedTitle = topic
        try {
          const client = getLightClient()
          const titleRes = await client.generateJson<{ title: string }>(
            'video-card-title-summary',
            `주제: "${topic}"\n\n이 주제를 15자 내외의 직관적이고 깔끔한 제목(한글 명사형 종결 추천)으로 요약해 주세요. JSON으로 반환해 주세요. 예시: { "title": "식물성 에센스 소개" }`,
            () => ({ title: topic.slice(0, 20) }),
            { model: getQwenModel(), temperature: 0.1 }
          )
          if (titleRes?.title) {
            summarizedTitle = titleRes.title.replace(/["']/g, '').trim()
          }
        } catch (err) {
          console.warn('[VideoCardNews] Failed to summarize title:', err)
        }

        const campaign = await dbService.createCampaign(
          user.id,
          brandId,
          {
            title: `${summarizedTitle} 영상 카드뉴스`,
            productName: summarizedTitle,
            productDescription: topic,
            keyBenefits: '영상 카드뉴스',
            objective: '영상 카드뉴스',
            slideCount: durableSlides.length,
            imageModel: getKlingVideoModel(),
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
          caption: buildVideoCardSummaryCaption(topic, durableSlides, language),
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
        if (request.signal.aborted) {
          console.log('[VideoCardNews] generation aborted by client')
          return
        }
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
