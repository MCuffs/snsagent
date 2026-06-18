import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../app/actions'
import { dbService, type User } from '../../../../../lib/db-service'
import { saveErrorLog } from '../../../../../lib/errorLogger'
import { generateCarouselCampaign } from '../../../../lib/carousel/pipeline'
import type { BrandProfile, CampaignInput } from '../../../../lib/carousel/types'
import { generateMediaCarousel } from '../../../../lib/layout/mediaCarouselPipeline'
import { checkCampaignUsage } from '../../../../lib/usageLimit'
import { collectBrandUrlContext } from '../../../../../lib/brand-url-collector'
import { analyzePurchasePersuasionWithOpenAI, formatPurchasePersuasionForPrompt } from '../../../../../lib/purchase-persuasion'
import { getUserFacingGenerationError } from '../../../../../lib/runtime-diagnostics'
import { buildRssContext, extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../lib/rss/rssFetcher'
import { buildCarouselResearchBrief, formatResearchBriefForPrompt } from '../../../../lib/research/carouselResearch'
import OpenAI from 'openai'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../../lib/rateLimiter'
import { isTestAccount } from '../../../../../lib/auth/test-accounts'
import { generateTestCampaign } from '../../../../lib/layout/testCampaignPipeline'

export const runtime = 'nodejs'

interface GenerateCampaignRequest {
  campaignType?: 'commerce' | 'media'
  brandId?: string
  productName?: string
  productDescription?: string
  keyBenefits?: string
  objective?: string
  slideCount?: number
  productImageUrls?: string[]
  topic?: string
  category?: string
  title?: string
  keyContent?: string
  tone?: string
  contentType?: string
  visualHint?: string
  source?: string
  productUrl?: string
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  structurePreview?: { slideNumber: number; role: string; description: string }[]
  confirmedSlides?: { slideNumber: number; role: string; headline: string; body: string }[]
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
}

export async function POST(request: Request) {
  let user: User | null = null
  let body: GenerateCampaignRequest | null = null
  try {
    user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // Rate limiting: 5 requests per 10 minutes per user
    const rateLimitResult = await checkRateLimit(`campaign-generate:${user.id}`, RATE_LIMIT_PRESETS.aiGeneration)
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_PRESETS.aiGeneration.maxRequests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          }
        }
      )
    }

    body = await request.json() as GenerateCampaignRequest
    const validation = validateBody(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const requestedBrand = await dbService.getBrand(body.brandId!)
    const brand = requestedBrand?.userId === user.id
      ? requestedBrand
      : (await dbService.getBrands(user.id))[0]
    if (!brand) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const usage = await checkCampaignUsage(user.id)
    if (!usage.allowed) {
      return NextResponse.json({
        error: (usage.period as string) === 'lifetime'
          ? '무료 플랜은 최초 2회만 카드뉴스를 생성할 수 있습니다. 계속 생성하시려면 Creator 플랜을 선택해 주세요.'
          : `월간 카드뉴스 생성 한도를 초과했습니다. ${usage.current}/${usage.limit} (${usage.plan})`,
      }, { status: 429 })
    }

    if (body.campaignType === 'media') {
      // ── 테스트 계정: AI/이미지 호출 없이 고정 카드 즉시 반환 ──
      if (isTestAccount(user.email)) {
        const testResult = await generateTestCampaign({
          userId: user.id,
          brandId: brand.id,
          brandName: brand.name,
          slideCount: normalizeSlideCount(body.slideCount),
        })
        return NextResponse.json({
          campaignId: testResult.campaignId,
          postId: testResult.postId,
          status: testResult.status,
        })
      }
      const account = await dbService.getInstagramAccount(user.id, brand.id)
      const source = body.source || account?.username || brand.name

      // Scrape product URL if provided and append to keyContent for AI context
      let enrichedKeyContent = body.keyContent!
      if (body.productUrl) {
        try {
          const productContext = await collectBrandUrlContext(body.productUrl)
          const apiKey = process.env.OPENAI_API_KEY
          let productSummary = productContext.promptContext.slice(0, 3500)
          if (apiKey && apiKey.length > 10) {
            const openai = new OpenAI({
              apiKey,
              ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
            })
            const persuasion = await analyzePurchasePersuasionWithOpenAI({
              openai,
              collected: productContext,
              locale: body.language || 'ko',
            })
            productSummary = formatPurchasePersuasionForPrompt(persuasion)
          }
          enrichedKeyContent = `${enrichedKeyContent}\n\n[Product Page Purchase Persuasion]\n${productSummary}`
        } catch {
          // scraping failed — continue without it
        }
      }

      let researchContext = ''
      const hasConfirmedSlides = Boolean(body.confirmedSlides?.length)
      if (hasConfirmedSlides) {
        console.log(`[ResearchBrief] Skipped because confirmed copy was provided for topic "${body.topic}"`)
      } else {
        try {
          const researchBrief = await buildCarouselResearchBrief({
            topic: body.topic!,
            category: body.category,
            keyContent: enrichedKeyContent,
            contentType: body.contentType,
            slideCount: normalizeSlideCount(body.slideCount),
            language: body.language || 'ko',
          })
          researchContext = formatResearchBriefForPrompt(researchBrief, body.language || 'ko')
          if (researchContext) {
            enrichedKeyContent = `${enrichedKeyContent}\n\n${researchContext}`
            console.log(`[ResearchBrief] Injected ${researchBrief?.verifiedFacts.length || 0} facts and ${researchBrief?.sources.length || 0} sources for topic "${body.topic}"`)
          } else {
            console.log(`[ResearchBrief] No topic-matched external research found for "${body.topic}"`)
          }
        } catch (researchErr) {
          console.warn('[ResearchBrief] Failed to build external research brief, continuing without it:', researchErr)
        }
      }

      // RSS is now a fallback only. Raw news blocks can add weakly related health/trend items,
      // so prefer the topic-filtered Web search research brief whenever it exists.
      if (!researchContext && !hasConfirmedSlides) {
        try {
          const keywords = extractGenerationKeywords(body.topic, [
            body.category || '',
            body.contentType || '',
          ])

          const rssResult = await fetchRssForGeneration({
            category: inferRssCategory(body.topic, body.category || brand.industry || 'information'),
            keywords,
            topic: body.topic,
            limit: 5,
            language: body.language || 'ko',
          })

          const rssContext = buildRssContext(rssResult, body.language || 'ko')
          if (rssContext) {
            enrichedKeyContent = `${enrichedKeyContent}\n\n${rssContext}`
            console.log(`[RSS] Injected fallback ${rssResult.articles.length} articles (matched: ${rssResult.matched}) into keyContent`)
          } else {
            console.log(`[RSS] Skipped unrelated articles for topic "${body.topic}"`)
          }
        } catch (rssErr) {
          console.warn('[RSS] Failed to fetch RSS context, continuing without it:', rssErr)
        }
      } else {
        console.log(`[RSS] Skipped raw RSS because ${hasConfirmedSlides ? 'confirmed copy was provided' : 'research brief exists'} for topic "${body.topic}"`)
      }

      const result = await generateMediaCarousel({
        userId: user.id,
        brandId: brand.id,
        brandName: brand.name,
        brandMainColor: brand.mainColor,
        brandToneOfVoice: brand.toneOfVoice,
        brandIndustry: brand.industry,
        brandTargetAudience: brand.targetAudience,
        brandForbiddenWords: brand.forbiddenWords,
        brandCtaStyle: brand.ctaStyle,
        brandDna: brand.brandDna,
        topic: body.topic!,
        category: body.category!,
        title: body.title!,
        keyContent: enrichedKeyContent,
        tone: body.tone || '감성적이고 따뜻하게',
        contentType: body.contentType || '신상품 홍보',
        objective: body.objective,
        slideCount: normalizeSlideCount(body.slideCount),
        source,
        visualHint: body.visualHint,
        productImageUrls: body.productImageUrls || [],
        briefing: {
          brandAnalysis: body.brandAnalysis,
          targetEmotion: body.targetEmotion,
          hookDirection: body.hookDirection,
          recommendedCta: body.recommendedCta,
          reasonForStyle: body.reasonForStyle,
          structurePreview: body.structurePreview,
        },
        confirmedSlides: body.confirmedSlides,
        language: body.language,
        generationMode: body.generationMode,
      })

      return NextResponse.json({
        campaignId: result.campaignId,
        postId: result.postId,
        status: result.status,
        slides: result.slides.map(slide => ({
          slideNumber: slide.slideNumber,
          headline: slide.headline,
          body: slide.body,
          finalImageUrl: slide.finalImageUrl,
        })),
        caption: result.caption,
        hashtags: result.hashtags,
        qualityCheck: result.qualityCheck,
      })
    }

    const brandProfile: BrandProfile = {
      id: brand.id,
      name: brand.name,
      industry: brand.industry,
      targetAudience: brand.targetAudience,
      toneOfVoice: brand.toneOfVoice,
      mainColor: brand.mainColor,
      forbiddenWords: brand.forbiddenWords,
      ctaStyle: brand.ctaStyle,
      brandDna: brand.brandDna,
    }

    // Enrich commerce campaign with RSS news context relevant to the brand industry
    let productDescription = body.productDescription!
    try {
      const keywords = extractGenerationKeywords(body.productName, [body.productDescription || ''])
      const rssResult = await fetchRssForGeneration({
        category: inferRssCategory(body.productName || body.productDescription, brand.industry || 'information'),
        keywords,
        topic: body.productName,
        limit: 3,
      })
      const rssContext = buildRssContext(rssResult, body.language || 'ko')
      if (rssContext) {
        productDescription = `${productDescription}\n\n${rssContext}`
      }
    } catch {
      // RSS failure is non-fatal
    }

    const campaignInput: CampaignInput = {
      productName: body.productName!,
      productDescription,
      keyBenefits: body.keyBenefits!,
      objective: body.objective!,
      slideCount: normalizeSlideCount(body.slideCount),
      productImageUrls: body.productImageUrls || [],
    }

    const result = await generateCarouselCampaign({
      userId: user.id,
      brandProfile,
      campaignInput,
    })

    return NextResponse.json({
      campaignId: result.campaignId,
      postId: result.postId,
      status: result.status,
      slides: result.slides.map(slide => ({
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        finalImageUrl: slide.finalImageUrl,
      })),
      caption: result.caption,
      hashtags: result.hashtags,
      qualityCheck: result.qualityCheck,
    })
  } catch (error) {
    console.error('[CampaignGeneration] API generation failed', error)
    await saveErrorLog(user?.id, 'api/campaigns/generate', error, { body })
    return NextResponse.json({ error: getUserFacingGenerationError(error) }, { status: 500 })
  }
}

function validateBody(body: GenerateCampaignRequest) {
  const required: (keyof GenerateCampaignRequest)[] = body.campaignType === 'media'
    ? ['brandId', 'topic', 'category', 'title', 'keyContent']
    : ['brandId', 'productName', 'productDescription', 'keyBenefits', 'objective']

  for (const key of required) {
    if (!body[key] || String(body[key]).trim().length === 0) {
      return { valid: false, error: `${key} 값이 필요합니다.` }
    }
  }

  if (body.slideCount !== undefined && (body.slideCount < 5 || body.slideCount > 10)) {
    return { valid: false, error: 'slideCount는 5~10 사이여야 합니다.' }
  }

  if (body.productImageUrls && !Array.isArray(body.productImageUrls)) {
    return { valid: false, error: 'productImageUrls는 배열이어야 합니다.' }
  }

  return { valid: true }
}

function normalizeSlideCount(slideCount: number | undefined) {
  if (!slideCount) return 5
  return Math.min(Math.max(Math.round(slideCount), 5), 10)
}
