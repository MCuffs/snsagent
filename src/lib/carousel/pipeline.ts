import { dbService } from '../../../lib/db-service'
import { getPipelineImageModel, getPipelineImageProvider } from '../ai/providers'
import { sanitizeImagePrompt } from '../ai/imageProvider'
import { generateCaption } from './captionEngine'
import { generateSlideCopies } from './copyEngine'
import { runNarrativePipeline } from './narrativePipeline'
import { generateHooks, selectBestHook } from './hookEngine'
import { renderSlide } from './renderer'
import { generateStrategy } from './strategyEngine'
import { generateStructure } from './structureEngine'
import { runQualityCheck } from './qualityCheckEngine'
import { buildCopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import {
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

    const knowledgeCtx = buildCopyKnowledgeContext({
      brand: params.brandProfile,
      input: params.campaignInput,
      strategy,
    })

    const hooks = await runStep('Hook generation', () =>
      generateHooks(params.brandProfile, params.campaignInput, strategy, knowledgeCtx)
    )
    log('Hooks generated')

    const selectedHook = selectBestHook(hooks)
    log('Best hook selected')

    const structure = await runStep('Structure generation', () =>
      generateStructure(strategy, selectedHook, strategy.recommendedSlideCount)
    )
    log('Structure generated')

    const narrativeResult = await runStep('Narrative pipeline', () =>
      runNarrativePipeline({
        brand: params.brandProfile,
        input: params.campaignInput,
        strategy,
        knowledgeCtx,
        selectedHook,
        structure,
      })
    )
    const copies = narrativeResult.copies
    const designPrompts = narrativeResult.designPrompts
    const copyQualityReport = narrativeResult.copyQualityReport
    log('Narrative pipeline complete')

    // Initialize Agents for report/quality tracking only
    const qualityAgent = new QualityGuardAgent()
    const agentReportLogs: AgentReportItem[] = []

    // Build AgentSlideData for downstream quality reporting
    const structureRoleMap = new Map(structure.slides.map(s => [s.slideNumber, s.role]))
    const agentSlides: AgentSlideData[] = copies.map(c => ({
      slideNumber: c.slideNumber,
      role: structureRoleMap.get(c.slideNumber) ?? 'feature',
      headline: c.headline,
      body: c.body,
      layoutType: 'commerce-standard',
    }))

    const imageProvider = getPipelineImageProvider()
    const campaignKey = `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const [slideResults, captionResult] = await Promise.all([
      Promise.all(
        copies.map(async (copy) => {
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
            console.error('[CarouselPipeline] Image generation error', error)
            throw new Error(`Image generation failed for slide ${copy.slideNumber}. Please try again.`)
          }

          design.backgroundPrompt = sanitizedPrompt

          const finalImageUrl = await renderSlide({
            campaignKey,
            brand: params.brandProfile,
            copy,
            design,
            backgroundImageUrl,
            showSlideNumber: true,
          })

          debugSlideRender(copy.slideNumber, {
            prompt: sanitizedPrompt,
            headline: copy.headline,
            body: copy.body,
            imageUrl: finalImageUrl,
          })

          return { copy, sanitizedPrompt, backgroundImageUrl, finalImageUrl }
        })
      ),
      runStep('Caption generation', () =>
        generateCaption(params.brandProfile, params.campaignInput, strategy, selectedHook)
      ),
    ])

    let slides: GeneratedSlide[] = slideResults
      .sort((a, b) => a.copy.slideNumber - b.copy.slideNumber)
      .map(({ copy, sanitizedPrompt, backgroundImageUrl, finalImageUrl }) => {
        const matchingAgentSlide = agentSlides.find(s => s.slideNumber === copy.slideNumber)
        if (matchingAgentSlide) {
          matchingAgentSlide.backgroundImageUrl = backgroundImageUrl
        }
        return {
          slideNumber: copy.slideNumber,
          headline: copy.headline,
          body: copy.body,
          designPrompt: sanitizedPrompt,
          backgroundImageUrl,
          finalImageUrl,
        }
      })

    log('Images generated')
    log('Slides rendered')
    log('Caption generated')

    qualityCheck = await runStep('Quality check', () =>
      runQualityCheck({
        brand: params.brandProfile,
        input: params.campaignInput,
        slides,
        caption: captionResult,
      })
    )

    // Copy-only regeneration for fixable copy issues (no image regeneration cost)
    const copySlidesWithIssues = extractCopyIssueSlides(qualityCheck.issues)
    if (copySlidesWithIssues.size > 0) {
      log(`Copy-only regeneration triggered for ${copySlidesWithIssues.size} slide(s)`)
      try {
        const regenResult = await generateSlideCopies(
          params.brandProfile, params.campaignInput, structure, selectedHook, knowledgeCtx
        )
        const regenCopies = regenResult.copies
        const regenMap = new Map(regenCopies.map(c => [c.slideNumber, c]))
        slides = await Promise.all(
          slides.map(async slide => {
            if (!copySlidesWithIssues.has(slide.slideNumber)) return slide
            const newCopy = regenMap.get(slide.slideNumber)
            if (!newCopy) return slide
            const design = designPrompts.find(d => d.slideNumber === slide.slideNumber)
            if (!design) return slide
            const finalImageUrl = await renderSlide({
              campaignKey,
              brand: params.brandProfile,
              copy: newCopy,
              design,
              backgroundImageUrl: slide.backgroundImageUrl,
              showSlideNumber: true,
            })
            return { ...slide, headline: newCopy.headline, body: newCopy.body, finalImageUrl }
          })
        )
        qualityCheck = await runQualityCheck({
          brand: params.brandProfile,
          input: params.campaignInput,
          slides,
          caption: captionResult,
        })
        log('Copy-only regeneration complete')
      } catch {
        log('Copy-only regeneration failed, keeping original slides')
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
      hasFallbackImage: false,
      copyQualityReport,
    })
    agentReportLogs.push(...qualityRes.logs)

    // LLM failures fall back to canned copy that passes rule checks by design —
    // surface them explicitly and never ship a fallback campaign as "passed".
    const fallbackSlideNumbers = copies.filter(c => c.usedFallback).map(c => c.slideNumber)
    const usedFallbackCopy = fallbackSlideNumbers.length > 0 || selectedHook.usedFallback === true
    if (usedFallbackCopy) {
      agentReportLogs.push({
        agentName: 'CopyGenerationGuard',
        role: 'copy-generation',
        status: 'error',
        message: fallbackSlideNumbers.length > 0
          ? `AI 카피 생성이 실패해 슬라이드 ${fallbackSlideNumbers.join(', ')}에 기본 문구가 사용되었습니다. 내용을 검토하고 재생성을 권장합니다.`
          : 'AI 훅 생성이 실패해 기본 훅 문구가 사용되었습니다. 내용을 검토하고 재생성을 권장합니다.',
        timestamp: new Date().toISOString(),
      })
      log(`Fallback copy detected (slides: ${fallbackSlideNumbers.join(', ') || 'hook only'})`)
    }
    const finalPassed = qualityRes.passed && !usedFallbackCopy

    const agentReport: AgentReport = {
      timestamp: new Date().toISOString(),
      status: finalPassed ? 'passed' : 'needs_review',
      score: qualityRes.score,
      logs: agentReportLogs,
    }

    log(finalPassed ? 'Quality check passed' : 'Quality check needs review')

    const status = finalPassed ? 'pending_approval' : 'needs_review'
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

function extractCopyIssueSlides(issues: string[]): Set<number> {
  const nums = new Set<number>()
  for (const issue of issues) {
    const match = issue.match(/^(\d+)번/)
    if (match && /headline.*25자|body.*150자|금지어|과장 표현/.test(issue)) {
      nums.add(parseInt(match[1], 10))
    }
  }
  return nums
}

function debugSlideRender(
  slideNumber: number,
  details: { prompt: string; headline: string; body: string; imageUrl: string }
) {
  if (process.env.NODE_ENV === 'production') return

  const summarize = (value: string) => value.length > 120 ? `${value.slice(0, 120)}...` : value
  console.log(
    `[DEBUG] Slide ${slideNumber} rendered`,
    {
      prompt: summarize(details.prompt),
      headline: summarize(details.headline),
      body: summarize(details.body),
      imageUrl: summarize(details.imageUrl),
    }
  )
}
