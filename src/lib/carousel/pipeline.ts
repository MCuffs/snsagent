import { dbService } from '../../../lib/db-service'
import { MockImageProvider } from '../ai/providers/mockImageProvider'
import { getPipelineImageModel, getPipelineImageProvider } from '../ai/providers'
import { sanitizeImagePrompt } from '../ai/imageProvider'
import { generateCaption } from './captionEngine'
import { generateSlideCopies } from './copyEngine'
import { generateDesignPrompts } from './designPromptEngine'
import { generateHooks, selectBestHook } from './hookEngine'
import { renderSlide } from './renderer'
import { generateStrategy } from './strategyEngine'
import { generateStructure } from './structureEngine'
import { runQualityCheck } from './qualityCheckEngine'
import {
  BrandIdentityAgent,
  CopywritingAgent,
  VisualConceptAgent,
  QualityGuardAgent,
  type AgentReport,
  type AgentReportItem,
  type AgentSlideData
} from './agents'
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

    // Initialize Agents
    const brandAgent = new BrandIdentityAgent()
    const copyAgent = new CopywritingAgent()
    const visualAgent = new VisualConceptAgent()
    const qualityAgent = new QualityGuardAgent()

    const agentReportLogs: AgentReportItem[] = []

    // Convert copies to AgentSlideData for agent chain
    let agentSlides: AgentSlideData[] = copies.map(c => {
      const isFirst = c.slideNumber === 1
      const isLast = c.slideNumber === copies.length
      const role = isFirst ? 'hook' : isLast ? 'save-cta' : 'key-point'
      return {
        slideNumber: c.slideNumber,
        role,
        headline: c.headline,
        body: c.body,
        layoutType: 'commerce-standard',
      }
    })

    // Execute BrandIdentityAgent
    const brandRes = brandAgent.run({
      brandName: params.brandProfile.name,
      brandToneOfVoice: params.brandProfile.toneOfVoice,
      forbiddenWords: params.brandProfile.forbiddenWords,
      ctaStyle: params.brandProfile.ctaStyle,
      brandDna: params.brandProfile.brandDna,
      slides: agentSlides,
    })
    agentSlides = brandRes.slides
    agentReportLogs.push(...brandRes.logs)

    // Execute CopywritingAgent
    const copyRes = copyAgent.run({
      title: `${params.campaignInput.productName} 카드뉴스`,
      topic: params.campaignInput.productName,
      category: params.campaignInput.objective,
      brandName: params.brandProfile.name,
      slides: agentSlides,
    })
    agentSlides = copyRes.slides
    agentReportLogs.push(...copyRes.logs)

    // Sync adjusted copies back to pipeline copies array
    copies.forEach((c) => {
      const updated = agentSlides.find(s => s.slideNumber === c.slideNumber)
      if (updated) {
        c.headline = updated.headline
        c.body = updated.body
      }
    })

    // Execute VisualConceptAgent
    const visualRes = visualAgent.run({
      category: params.campaignInput.objective,
      topic: params.campaignInput.productName,
      tone: params.brandProfile.toneOfVoice || '전문적이고 신뢰감 있게',
      brandMainColor: params.brandProfile.mainColor,
      brandIndustry: params.brandProfile.industry,
      slides: agentSlides,
    })
    agentSlides = visualRes.slides
    agentReportLogs.push(...visualRes.logs)

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

      const sanitizedPrompt = sanitizeImagePrompt(design.backgroundPrompt)
      let backgroundImageUrl = ''
      try {
        const image = await imageProvider.generateImage(sanitizedPrompt, {
          size: '1024x1024',
          productImageUrls: params.campaignInput.productImageUrls,
        })
        backgroundImageUrl = image.imageUrl
      } catch (error) {
        imageFallbackUsed = true
        log(`Image generation failed for slide ${copy.slideNumber}; using mock placeholder`)
        const fallbackImage = await new MockImageProvider().generateImage(`fallback ${sanitizedPrompt}`)
        backgroundImageUrl = fallbackImage.imageUrl
        console.error('[CarouselPipeline] Image generation error', error)
      }

      // Sync sanitized prompt back to design object for renderer
      design.backgroundPrompt = sanitizedPrompt

      const finalImageUrl = await renderSlide({
        campaignKey,
        brand: params.brandProfile,
        copy,
        design,
        backgroundImageUrl,
        showSlideNumber: true,
      })

      // [DEBUG LOGGING]
      console.log(`[DEBUG] Slide ${copy.slideNumber} - Background Prompt: "${sanitizedPrompt}" | Headline: "${copy.headline}" | Body: "${copy.body}" | Final Image URL: "${finalImageUrl}"`)

      // Sync background url to agent slides for diagnostics
      const matchingAgentSlide = agentSlides.find(s => s.slideNumber === copy.slideNumber)
      if (matchingAgentSlide) {
        matchingAgentSlide.backgroundImageUrl = backgroundImageUrl
      }

      slides.push({
        slideNumber: copy.slideNumber,
        headline: copy.headline,
        body: copy.body,
        designPrompt: sanitizedPrompt,
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

    // Populate diagnostics into agent slides
    agentSlides.forEach(as => {
      // Find matching issues/suggestions to record in agent report
      as.diagnostics = qualityCheck.issues.filter(issue => issue.includes(`슬라이드 ${as.slideNumber}`) || issue.includes(`Slide ${as.slideNumber}`))
    })

    // Execute QualityGuardAgent
    const qualityRes = qualityAgent.run({
      slides: agentSlides,
      hasFallbackImage: imageFallbackUsed,
    })
    agentReportLogs.push(...qualityRes.logs)

    const agentReport: AgentReport = {
      timestamp: new Date().toISOString(),
      status: qualityRes.passed ? 'passed' : 'needs_review',
      score: qualityRes.score,
      logs: agentReportLogs,
    }

    log(qualityRes.passed ? 'Quality check passed' : 'Quality check needs review')

    const status = qualityRes.passed ? 'pending_approval' : 'needs_review'
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
        agentReport: JSON.stringify(agentReport), // Save agent report to DB
        imageModel: getPipelineImageModel(),
        initialImageCount: slides.length,
      },
      slides.map(slide => ({
        slideNumber: slide.slideNumber,
        headline: slide.headline,
        body: slide.body,
        designPrompt: slide.designPrompt,
        imageUrl: slide.finalImageUrl,
        backgroundImageUrl: slide.backgroundImageUrl,
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
      qualityCheck: {
        passed: qualityRes.passed,
        issues: agentReportLogs.filter(l => l.status === 'error' || l.status === 'warn').map(l => l.message),
        suggestions: agentReportLogs.filter(l => l.status === 'info').map(l => l.message),
      },
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
