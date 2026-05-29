import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../app/actions'
import { dbService, type User } from '../../../../../lib/db-service'
import { saveErrorLog } from '../../../../../lib/errorLogger'
import { generateCarouselCampaign } from '../../../../lib/carousel/pipeline'
import type { BrandProfile, CampaignInput } from '../../../../lib/carousel/types'
import { generateMediaCarousel } from '../../../../lib/layout/mediaCarouselPipeline'
import { checkCampaignUsage } from '../../../../lib/usageLimit'
import { collectBrandUrlContext } from '../../../../../lib/brand-url-collector'
import { getUserFacingGenerationError } from '../../../../../lib/runtime-diagnostics'

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
  language?: 'ko' | 'en'
}

export async function POST(request: Request) {
  let user: User | null = null
  let body: GenerateCampaignRequest | null = null
  try {
    user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
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
        error: usage.plan === 'LITE'
          ? 'AI 재생성 1회권은 기존 결과물의 배경 재생성에 사용할 수 있습니다. 작업 히스토리에서 결과물을 열어 사용해주세요.'
          : usage.period === 'day'
          ? '무료 플랜은 하루에 카드뉴스 1개를 생성할 수 있습니다. 내일 다시 시도하거나 Creator 플랜을 선택해주세요.'
          : `월간 카드뉴스 생성 한도를 초과했습니다. ${usage.current}/${usage.limit} (${usage.plan})`,
      }, { status: 429 })
    }

    if (body.campaignType === 'media') {
      const account = await dbService.getInstagramAccount(user.id, brand.id)
      const source = body.source || account?.username || brand.name

      // Scrape product URL if provided and append to keyContent for AI context
      let enrichedKeyContent = body.keyContent!
      if (body.productUrl) {
        try {
          const productContext = await collectBrandUrlContext(body.productUrl)
          const productSummary = productContext.sourceText.slice(0, 2000)
          enrichedKeyContent = `${enrichedKeyContent}\n\n[상품 페이지 정보]\n${productSummary}`
        } catch {
          // scraping failed — continue without it
        }
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
        language: body.language,
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

    const campaignInput: CampaignInput = {
      productName: body.productName!,
      productDescription: body.productDescription!,
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
