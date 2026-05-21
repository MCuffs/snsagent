import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../app/actions'
import { dbService } from '../../../../../lib/db-service'
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
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json() as GenerateCampaignRequest
    const validation = validateBody(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const brand = await dbService.getBrand(body.brandId!)
    if (!brand) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (brand.userId !== user.id) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    const usage = await checkMonthlyCampaignUsage(user.id)
    if (!usage.allowed) {
      return NextResponse.json({
        error: `월간 카드뉴스 생성 한도를 초과했습니다. ${usage.current}/${usage.limit} (${usage.plan})`,
      }, { status: 429 })
    }

    if (body.campaignType === 'media') {
      const result = await generateMediaCarousel({
        userId: user.id,
        brandId: brand.id,
        brandName: brand.name,
        brandMainColor: brand.mainColor,
        brandToneOfVoice: brand.toneOfVoice,
        brandIndustry: brand.industry,
        topic: body.topic!,
        category: body.category!,
        title: body.title!,
        keyContent: body.keyContent!,
        tone: body.tone || '차분하고 신뢰감 있게',
        contentType: body.contentType || '정보형 카드뉴스',
        slideCount: normalizeSlideCount(body.slideCount),
        source: body.source || brand.name,
        visualHint: body.visualHint,
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
