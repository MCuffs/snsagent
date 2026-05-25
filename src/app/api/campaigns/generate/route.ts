import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../app/actions'
import { dbService, type User } from '../../../../../lib/db-service'
import { saveErrorLog } from '../../../../../lib/errorLogger'
import { generateCarouselCampaign } from '../../../../lib/carousel/pipeline'
import type { BrandProfile, CampaignInput } from '../../../../lib/carousel/types'
import { generateMediaCarousel } from '../../../../lib/layout/mediaCarouselPipeline'
import { checkMonthlyCampaignUsage } from '../../../../lib/usageLimit'

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

    const usage = await checkMonthlyCampaignUsage(user.id)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `월간 카드뉴스 생성 한도를 초과했습니다. ${usage.current}/${usage.limit} (${usage.plan})`,
      }, { status: 429 })
    }

    if (body.campaignType === 'media') {
      const account = await dbService.getInstagramAccount(user.id, brand.id)
      const source = body.source || account?.username || brand.name
      const result = await generateMediaCarousel({
        userId: user.id,
        brandId: brand.id,
        brandName: brand.name,
        brandMainColor: brand.mainColor,
        brandToneOfVoice: brand.toneOfVoice,
        brandIndustry: brand.industry,
        brandForbiddenWords: brand.forbiddenWords,
        brandCtaStyle: brand.ctaStyle,
        brandDna: brand.brandDna,
        topic: body.topic!,
        category: body.category!,
        title: body.title!,
        keyContent: body.keyContent!,
        tone: body.tone || '감성적이고 따뜻하게',
        contentType: body.contentType || '신상품 홍보',
        slideCount: normalizeSlideCount(body.slideCount),
        source,
        visualHint: body.visualHint,
        productImageUrls: body.productImageUrls || [],
      })

      return NextResponse.json({
        campaignId: result.campaignId,
        postId: result.postId,
        status: result.status,
        slides: result.slides,
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
      slides: result.slides,
      caption: result.caption,
      hashtags: result.hashtags,
      qualityCheck: result.qualityCheck,
    })
  } catch (error) {
    console.error('[CampaignGeneration] API generation failed', error)
    await saveErrorLog(user?.id, 'api/campaigns/generate', error, { body })
    const message = error instanceof Error ? error.message : '카드뉴스 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
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
