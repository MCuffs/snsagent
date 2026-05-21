import { dbService } from '../../../lib/db-service'
import { MockImageProvider } from '../ai/providers/mockImageProvider'
import { getPipelineImageProvider } from '../ai/providers'
import { generateCaption } from './captionEngine'
import { generateSlideCopies } from './copyEngine'
import { generateDesignPrompts } from './designPromptEngine'
import { generateHooks, selectBestHook } from './hookEngine'
import { renderSlide } from './renderer'
import { generateStrategy } from './strategyEngine'
import { generateStructure } from './structureEngine'
import { runQualityCheck } from './qualityCheckEngine'
import type {
  BrandProfile,
  CampaignInput,
  CarouselPipelineResult,
  GeneratedSlide,
  QualityCheckResult,
} from './types'

export async function generateCarouselCampaign(params: {
  userId: string
  brandProfile: BrandProfile
  campaignInput: CampaignInput
}): Promise<CarouselPipelineResult> {
  const logs: string[] = []
  let imageFallbackUsed = false
  let qualityCheck: QualityCheckResult = { passed: false, issues: [], suggestions: [] }

  const log = (message: string) => {
    const line = `[CarouselPipeline] ${message}`
    logs.push(line)
    console.log(line)
  }

  try {
    const strategy = await runStep('Strategy generation', () =>
      generateStrategy(params.brandProfile, params.campaignInput)
    )
    log('Strategy generated')

    const hooks = await runStep('Hook generation', () =>
      generateHooks(params.brandProfile, params.campaignInput, strategy)
    )
    log('Hooks generated')

    const selectedHook = selectBestHook(hooks)
    log('Best hook selected')

    const structure = await runStep('Structure generation', () =>
      generateStructure(strategy, selectedHook, strategy.recommendedSlideCount)
    )
    log('Structure generated')

    const copies = await runStep('Slide copy generation', () =>
      generateSlideCopies(params.brandProfile, params.campaignInput, structure, selectedHook)
    )
    log('Slide copies generated')

    const designPrompts = await runStep('Design prompt generation', () =>
      generateDesignPrompts(params.brandProfile, params.campaignInput, copies, structure)
    )
    log('Design prompts generated')

    const imageProvider = getPipelineImageProvider()
    const campaignKey = `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const slides: GeneratedSlide[] = []

    for (const copy of copies) {
      const design = designPrompts.find(item => item.slideNumber === copy.slideNumber)
      if (!design) {
        throw new Error(`Design prompt missing for slide ${copy.slideNumber}`)
      }

      let backgroundImageUrl = ''
      try {
        const image = await imageProvider.generateImage(design.backgroundPrompt, {
          size: '1024x1024',
          productImageUrls: params.campaignInput.productImageUrls,
        })
        backgroundImageUrl = image.imageUrl
      } catch (error) {
        imageFallbackUsed = true
        log(`Image generation failed for slide ${copy.slideNumber}; using mock placeholder`)
        const fallbackImage = await new MockImageProvider().generateImage(`fallback ${design.backgroundPrompt}`)
        backgroundImageUrl = fallbackImage.imageUrl
        console.error('[CarouselPipeline] Image generation error', error)
      }

      const finalImageUrl = await renderSlide({
        campaignKey,
        brand: params.brandProfile,
        copy,
        design,
        backgroundImageUrl,
        showSlideNumber: true,
      })

      slides.push({
        slideNumber: copy.slideNumber,
        headline: copy.headline,
        body: copy.body,
        designPrompt: design.backgroundPrompt,
        backgroundImageUrl,
        finalImageUrl,
      })
    }
    log('Images generated')
    log('Slides rendered')

    const captionResult = await runStep('Caption generation', () =>
      generateCaption(params.brandProfile, params.campaignInput, strategy, selectedHook)
    )
    log('Caption generated')

    qualityCheck = await runStep('Quality check', () =>
      runQualityCheck({
        brand: params.brandProfile,
        input: params.campaignInput,
        slides,
        caption: captionResult,
      })
    )

    if (imageFallbackUsed) {
      qualityCheck = {
        ...qualityCheck,
        passed: false,
        issues: [...qualityCheck.issues, '이미지 생성 실패로 placeholder가 사용되었습니다.'],
        suggestions: [...qualityCheck.suggestions, '배경 이미지를 운영자가 확인하세요.'],
      }
    }

    log(qualityCheck.passed ? 'Quality check passed' : 'Quality check needs review')

    const status = qualityCheck.passed ? 'pending_approval' : 'needs_review'
    const title = `${params.campaignInput.productName} 카드뉴스`

    const campaign = await dbService.createCampaign(
      params.userId,
      params.brandProfile.id,
      {
        title,
        productName: params.campaignInput.productName,
        productDescription: params.campaignInput.productDescription,
        keyBenefits: params.campaignInput.keyBenefits,
        objective: params.campaignInput.objective,
        slideCount: slides.length,
      },
      slides.map(slide => ({
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        designPrompt: slide.designPrompt,
        imageUrl: slide.finalImageUrl,
      }))
    )

    await dbService.updateCampaignStatus(campaign.id, status)

    const scheduledAt = tomorrowAt20()
    const post = await dbService.createPost(params.userId, params.brandProfile.id, campaign.id, {
      caption: captionResult.caption,
      hashtags: captionResult.hashtags.join(', '),
      scheduledAt,
    })
    await dbService.updatePostStatus(post.id, 'pending_approval')
    log('Campaign, slides, and post saved')

    return {
      campaignId: campaign.id,
      postId: post.id,
      status,
      title,
      strategy,
      hooks,
      selectedHook,
      structure,
      slides,
      caption: captionResult.caption,
      hashtags: captionResult.hashtags,
      recommendedPostTime: captionResult.recommendedPostTime,
      qualityCheck,
      logs,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown carousel pipeline failure'
    log(`Failed: ${message}`)
    throw new Error(`[CarouselPipeline] ${message}`)
  }
}

async function runStep<T>(stepName: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`${stepName} failed: ${message}`)
  }
}

function tomorrowAt20() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(20, 0, 0, 0)
  return date
}
