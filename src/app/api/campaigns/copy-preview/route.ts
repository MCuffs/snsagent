import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../app/actions'
import { dbService } from '../../../../../lib/db-service'
import { previewMediaCarouselCopy } from '../../../../lib/layout/mediaCarouselPipeline'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../../lib/rateLimiter'
import { collectBrandUrlContext } from '../../../../../lib/brand-url-collector'
import { analyzePurchasePersuasionWithOpenAI, formatPurchasePersuasionForPrompt } from '../../../../../lib/purchase-persuasion'
import { buildRssContext, extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../lib/rss/rssFetcher'
import { buildCarouselResearchBrief, formatResearchBriefForPrompt } from '../../../../lib/research/carouselResearch'
import OpenAI from 'openai'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const rateLimitResult = checkRateLimit(`copy-preview:${user.id}`, RATE_LIMIT_PRESETS.aiGeneration)
  if (rateLimitResult.limited) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }

  const body = await request.json() as {
    brandId: string
    topic: string
    category: string
    title: string
    keyContent: string
    tone: string
    contentType: string
    objective?: string
    slideCount?: number
    productUrl?: string
    visualHint?: string
    brandAnalysis?: string
    targetEmotion?: string
    hookDirection?: string
    recommendedCta?: string
    reasonForStyle?: string
    structurePreview?: { slideNumber: number; role: string; description: string }[]
    language?: 'ko' | 'en'
    generationMode?: 'brand' | 'general'
  }

  if (!body.brandId || !body.topic || !body.keyContent) {
    return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
  }

  const requestedBrand = await dbService.getBrand(body.brandId)
  const brand = requestedBrand?.userId === user.id
    ? requestedBrand
    : (await dbService.getBrands(user.id))[0]
  if (!brand) return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })

  const language = body.language || 'ko'
  const productContextPromise = body.productUrl
    ? (async () => {
      const productContext = await collectBrandUrlContext(body.productUrl!)
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
          locale: language,
        })
        productSummary = formatPurchasePersuasionForPrompt(persuasion)
      }
      return `[Product Page Purchase Persuasion]\n${productSummary}`
    })().catch(() => '')
    : ''

  const researchContextPromise = (async () => {
    const researchBrief = await buildCarouselResearchBrief({
      topic: body.topic,
      category: body.category,
      keyContent: body.keyContent,
      contentType: body.contentType,
      slideCount: body.slideCount ?? 5,
      language,
      mode: 'fast',
    })
    return formatResearchBriefForPrompt(researchBrief, language)
  })().catch(() => '')

  const [productContext, researchContext] = await Promise.all([productContextPromise, researchContextPromise])
  const baseKeyContent = [body.keyContent, productContext].filter(Boolean).join('\n\n')

  const rssContext = researchContext
    ? ''
    : await (async () => {
      const keywords = extractGenerationKeywords(body.topic, [body.category || '', body.contentType || ''])
      const rssResult = await fetchRssForGeneration({
        category: inferRssCategory(body.topic, body.category || brand.industry || 'information'),
        keywords,
        topic: body.topic,
        limit: 5,
        language,
      })
      return buildRssContext(rssResult, language)
    })().catch(() => '')

  const enrichedKeyContent = [baseKeyContent, researchContext, rssContext].filter(Boolean).join('\n\n')

  const slides = await previewMediaCarouselCopy({
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
    topic: body.topic,
    category: body.category,
    title: body.title,
    keyContent: enrichedKeyContent,
    tone: body.tone,
    contentType: body.contentType,
    objective: body.objective,
    slideCount: body.slideCount ?? 5,
    visualHint: body.visualHint,
    productImageUrls: [],
    briefing: {
      brandAnalysis: body.brandAnalysis,
      targetEmotion: body.targetEmotion,
      hookDirection: body.hookDirection,
      recommendedCta: body.recommendedCta,
      reasonForStyle: body.reasonForStyle,
      structurePreview: body.structurePreview,
    },
    language: body.language,
    generationMode: body.generationMode,
  })

  return NextResponse.json({ slides })
}
