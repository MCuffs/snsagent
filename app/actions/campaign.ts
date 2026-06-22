'use server'

import { dbService } from '../../lib/db-service'
import { checkCampaignCreationLimit } from '../../lib/limits'
import { generateCarouselCampaign } from '../../src/lib/carousel/pipeline'
import {
  getSessionUser,
  getErrorMessage,
  forbidden,
  unauthenticated,
  failed,
} from './_shared'

// AI Content & Campaign Planning Action
export async function createCampaignAction(brandId: string, data: {
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
  slideCount: number
}) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  // Limit Check
  const limitCheck = await checkCampaignCreationLimit(user.id)
  if (!limitCheck.allowed) {
    return failed((limitCheck.period as string) === 'lifetime'
      ? '무료 플랜은 최초 2회만 카드뉴스를 생성할 수 있습니다. 계속 생성하시려면 Creator 플랜을 선택해 주세요.'
      : `월간 카드뉴스 생성 한도를 초과했습니다. 이번 달 누적 생성 건수: ${limitCheck.current}/${limitCheck.limit}개 (${user.plan} 플랜)`)
  }

  const brand = await dbService.getBrand(brandId)
  if (!brand) return failed('브랜드를 찾을 수 없습니다.')
  if (brand.userId !== user.id) return forbidden()

  try {
    const result = await generateCarouselCampaign({
      userId: user.id,
      brandProfile: {
        id: brand.id,
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        toneOfVoice: brand.toneOfVoice,
        mainColor: brand.mainColor,
        forbiddenWords: brand.forbiddenWords,
        ctaStyle: brand.ctaStyle,
      },
      campaignInput: {
        ...data,
        productImageUrls: [],
      },
    })

    return {
      success: true as const,
      campaignId: result.campaignId,
      postId: result.postId
    }
  } catch (err: unknown) {
    console.error('Campaign creation failed:', err)
    return failed(getErrorMessage(err, '카드뉴스 기획 생성에 실패했습니다.'))
  }
}
