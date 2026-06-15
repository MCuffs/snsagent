import { dbService } from '../../../lib/db-service'
import { renderMediaCard } from './renderer'
import { applyMediaCardHarness } from './mediaCardHarness'
import { planTypography } from './typographyEngine'
import { LAYOUT_DEFINITIONS } from './layoutTypes'

export interface TestCampaignInput {
  userId: string
  brandId: string
  brandName: string
  slideCount: number
}

export interface TestCampaignResult {
  campaignId: string
  postId: string
  status: 'pending_approval'
}

// 1x1 검정 PNG — 외부 이미지 호출 없이 배경 자리만 채움
const BLANK_BG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const SLIDE_ROLES = ['hook', 'key-point', 'key-point', 'key-point', 'save-cta'] as const

export async function generateTestCampaign(input: TestCampaignInput): Promise<TestCampaignResult> {
  const slideCount = Math.min(Math.max(input.slideCount, 5), 10)
  const layout = LAYOUT_DEFINITIONS['dark-editorial']

  const slideResults = await Promise.all(
    Array.from({ length: slideCount }, async (_, i) => {
      const slideNumber = i + 1
      const role = SLIDE_ROLES[Math.min(i, SLIDE_ROLES.length - 1)]
      const headline = 'test'
      const body = 'test'

      const typography = planTypography({
        headline,
        body,
        category: 'information',
        layout,
      })

      const harness = applyMediaCardHarness({
        layout,
        typography,
        slideNumber,
        totalSlides: slideCount,
        role,
      })

      const finalImageUrl = await renderMediaCard({
        id: `test-card-${input.userId}-${slideNumber}-${Date.now()}`,
        layout: harness.layout,
        typography: harness.typography,
        overlay: harness.overlay,
        category: 'information',
        headline,
        body,
        backgroundImageUrl: BLANK_BG_DATA_URI,
        source: input.brandName,
        pageNumber: slideNumber,
        totalPages: slideCount,
      })

      return {
        slideNumber,
        headline,
        body,
        designPrompt: 'test',
        imageUrl: finalImageUrl,
        backgroundImageUrl: BLANK_BG_DATA_URI,
      }
    })
  )

  const campaign = await dbService.createCampaign(
    input.userId,
    input.brandId,
    {
      title: 'test',
      productName: 'test',
      productDescription: 'test',
      keyBenefits: 'test',
      objective: 'test / test',
      slideCount: slideResults.length,
      agentReport: JSON.stringify({ status: 'test-mode', score: 100, logs: [] }),
      imageModel: 'test',
      initialImageCount: slideResults.length,
    },
    slideResults
  )

  await dbService.updateCampaignStatus(campaign.id, 'pending_approval')

  const post = await dbService.createPost(input.userId, input.brandId, campaign.id, {
    caption: 'test',
    hashtags: '#test',
    scheduledAt: new Date(Date.now() + 86400000),
  })
  void dbService.updatePostStatus(post.id, 'pending_approval')

  return {
    campaignId: campaign.id,
    postId: post.id,
    status: 'pending_approval',
  }
}
