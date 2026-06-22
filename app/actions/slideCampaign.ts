'use server'

import { dbService } from '../../lib/db-service'
import { getPipelineImageModel, getPipelineImageProvider } from '../../src/lib/ai/providers'
import { LAYOUT_DEFINITIONS } from '../../src/lib/layout/layoutTypes'
import { renderMediaCard } from '../../src/lib/layout/renderer'
import { planTypography } from '../../src/lib/layout/typographyEngine'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from '../../src/lib/layout/mediaCardHarness'
import {
  getSessionUser,
  getErrorMessage,
  forbidden,
  unauthenticated,
  failed,
  hasAiRegenerationAccess,
  regenerationPurchaseRequired,
  inferLayoutType,
} from './_shared'

// Regenerate campaign images using a specific style preset
export async function regenerateCampaignImagesAction(campaignId: string, styleName: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const campaign = await dbService.getCampaign(campaignId)
  if (!campaign) return failed('캠페인을 찾을 수 없습니다.')
  if (campaign.userId !== user.id) return forbidden()
  if (!hasAiRegenerationAccess(user.plan, user.email)) return regenerationPurchaseRequired()

  const brand = await dbService.getBrand(campaign.brandId)
  if (!brand) return failed('브랜드 정보를 찾을 수 없습니다.')
  const source = brand.name

  const styleKeywords: Record<string, string> = {
    minimalist: 'Korean media documentary photo, subdued realistic scene, dark editorial contrast, no generated text',
    gradients: 'dark cinematic editorial photography, high contrast colored lighting, no abstract gradient background, no generated text',
    cyberpunk: 'futuristic documentary city photography, dark cyber lighting, realistic scene, no generated text',
    vector: 'realistic editorial photo with strong graphic composition, not illustration, no generated text',
    photo: 'photojournalism, Korean magazine news photography, realistic full-bleed scene, no generated text',
  }

  const keyword = styleKeywords[styleName] || styleKeywords.photo

  try {
    const regenerationUsage = await dbService.reserveRegenerationImages(
      campaign.id,
      campaign.slides.length,
      getPipelineImageModel(),
    )
    if (!regenerationUsage.allowed) {
      return failed(`전체 스타일 재생성에는 ${campaign.slides.length}장의 AI 배경 크레딧이 필요합니다. 남은 크레딧이 부족합니다. (${Math.max(regenerationUsage.limit - regenerationUsage.used, 0)}장 남음)`)
    }

    const provider = getPipelineImageProvider()
    const updatedSlides = await Promise.all(
      campaign.slides.map(async (slide) => {
        const layout = LAYOUT_DEFINITIONS[inferLayoutType(slide.designPrompt)]
        const typography = planTypography({
          headline: slide.headline,
          body: slide.body,
          category: campaign.keyBenefits || '카드뉴스',
          layout,
          brandMainColor: brand.mainColor,
        })
        const harness = applyMediaCardHarness({
          layout,
          typography,
          slideNumber: slide.slideNumber,
          totalSlides: campaign.slideCount,
        })
        const finalPrompt = `${keyword}, ${slide.designPrompt}`
        const imgResult = await provider.generateImage(buildHarnessedVisualPrompt(finalPrompt, harness.template), {
          size: '1024x1536',
          productImageUrls: [],
        })

        const finalImageUrl = await renderMediaCard({
          id: `media-card-style-${Date.now()}-${slide.slideNumber}`,
          layout: harness.layout,
          typography: harness.typography,
          overlay: harness.overlay,
          category: campaign.keyBenefits || '카드뉴스',
          headline: slide.headline,
          body: slide.body,
          backgroundImageUrl: imgResult.imageUrl,
          source,
          pageNumber: slide.slideNumber,
          totalPages: campaign.slideCount,
        })

        // Save to DB
        const updated = await dbService.updateSlideCustomization(slide.id, {
          headline: slide.headline,
          body: slide.body,
          imageUrl: finalImageUrl,
          backgroundImageUrl: imgResult.imageUrl,
        })

        // Return matching format
        return {
          id: updated.id,
          campaignId: updated.campaignId,
          slideNumber: updated.slideNumber,
          headline: updated.headline,
          body: updated.body,
          designPrompt: updated.designPrompt,
          imageUrl: updated.imageUrl,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt
        }
      })
    )

    return {
      success: true as const,
      slides: updatedSlides.sort((a, b) => a.slideNumber - b.slideNumber),
      regenerationUsage,
    }
  } catch (err: unknown) {
    console.error('Failed to regenerate style images:', err)
    return failed(getErrorMessage(err, '이미지 스타일 일괄 재생성에 실패했습니다.'))
  }
}
