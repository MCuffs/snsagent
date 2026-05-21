import { dbService } from '../../../lib/db-service'
import type { ImageProvider } from '../ai/imageProvider'
import { getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutType } from './layoutTypes'
import { generateOverlay } from './overlayEngine'
import { runMediaCardQualityCheck, type MediaCardQualityResult } from './qualityCheck'
import { analyzeReferencePattern } from './referencePatternEngine'
import { renderMediaCard } from './renderer'
import { planTypography } from './typographyEngine'
import { generateVisualDirection } from './visualDirectionEngine'

export interface MediaCarouselInput {
  userId: string
  brandId: string
  brandName: string
  brandMainColor?: string
  brandToneOfVoice?: string
  brandIndustry?: string
  topic: string
  category: string
  title: string
  keyContent: string
  tone: string
  contentType: string
  slideCount: number
  source?: string
  visualHint?: string
  imageProvider?: ImageProvider
}

export interface MediaCarouselSlideResult {
  slideNumber: number
  role: MediaSlideRole
  layoutType: LayoutType
  headline: string
  body: string
  designPrompt: string
  backgroundImageUrl: string
  finalImageUrl: string
  qualityCheck: MediaCardQualityResult
}

export interface MediaCarouselPipelineResult {
  campaignId: string
  postId: string
  status: 'pending_approval' | 'needs_review'
  title: string
  slides: MediaCarouselSlideResult[]
  caption: string
  hashtags: string[]
  qualityCheck: MediaCardQualityResult
}

type MediaSlideRole = 'hook' | 'context' | 'key-point' | 'detail' | 'stat' | 'summary' | 'save-cta'

interface MediaSlidePlan {
  slideNumber: number
  role: MediaSlideRole
  headline: string
  body: string
  layoutType: LayoutType
}

export async function generateMediaCarousel(input: MediaCarouselInput): Promise<MediaCarouselPipelineResult> {
  const slideCount = normalizeSlideCount(input.slideCount)
  const baseLayoutType = selectLayout({
    category: input.category,
    topic: input.topic,
    tone: input.tone,
    contentType: input.contentType,
  })
  const slidePlans = planMediaSlides(input, slideCount, baseLayoutType)
  const imageProvider = input.imageProvider || getPipelineImageProvider()
  const slides: MediaCarouselSlideResult[] = []
  const qualityIssues: string[] = []
  const qualitySuggestions: string[] = []

  for (const slide of slidePlans) {
    const layout = LAYOUT_DEFINITIONS[slide.layoutType]
    const visualDirection = generateVisualDirection({
      layout,
      category: input.category,
      topic: input.topic,
      tone: input.tone,
      visualHint: input.visualHint,
      brandMainColor: input.brandMainColor,
      brandToneOfVoice: input.brandToneOfVoice,
      brandIndustry: input.brandIndustry,
    })
    const background = await imageProvider.generateImage(visualDirection.prompt, {
      size: '1024x1024',
      productImageUrls: [],
    })
    const typography = planTypography({
      headline: slide.headline,
      body: slide.body,
      category: input.category,
      layout,
      brandMainColor: input.brandMainColor,
    })
    const overlay = generateOverlay(layout.overlayStyle)
    analyzeReferencePattern({
      layoutType: slide.layoutType,
      headlineLength: slide.headline.length,
      bodyLength: slide.body.length,
      hasNumericSignal: /[\d%]/.test(`${slide.headline} ${slide.body}`),
    })

    const qualityCheck = runMediaCardQualityCheck({
      layout,
      typography,
      headline: slide.headline,
      body: slide.body,
      backgroundImageUrl: background.imageUrl,
    })
    qualityIssues.push(...qualityCheck.issues.map(issue => `${slide.slideNumber}장: ${issue}`))
    qualitySuggestions.push(...qualityCheck.suggestions.map(suggestion => `${slide.slideNumber}장: ${suggestion}`))

    const finalImageUrl = await renderMediaCard({
      id: `media-card-${Date.now()}-${slide.slideNumber}-${Math.random().toString(36).slice(2, 8)}`,
      layout,
      typography,
      overlay,
      category: input.category,
      headline: slide.headline,
      body: slide.body,
      backgroundImageUrl: background.imageUrl,
      source: input.source || input.brandName,
      pageNumber: slide.slideNumber,
      totalPages: slideCount,
    })

    slides.push({
      slideNumber: slide.slideNumber,
      role: slide.role,
      layoutType: slide.layoutType,
      headline: slide.headline,
      body: slide.body,
      designPrompt: visualDirection.prompt,
      backgroundImageUrl: background.imageUrl,
      finalImageUrl,
      qualityCheck,
    })
  }

  const campaign = await dbService.createCampaign(
    input.userId,
    input.brandId,
    {
      title: input.title,
      productName: input.topic,
      productDescription: input.keyContent,
      keyBenefits: input.category,
      objective: `${input.contentType} / ${input.tone}`,
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

  const qualityCheck: MediaCardQualityResult = {
    passed: qualityIssues.length === 0,
    issues: qualityIssues,
    suggestions: qualitySuggestions,
  }
  const status = qualityCheck.passed ? 'pending_approval' : 'needs_review'
  await dbService.updateCampaignStatus(campaign.id, status)

  const post = await dbService.createPost(input.userId, input.brandId, campaign.id, {
    caption: buildCaption(input),
    hashtags: buildHashtags(input).join(', '),
    scheduledAt: tomorrowAt20(),
  })
  await dbService.updatePostStatus(post.id, 'pending_approval')

  return {
    campaignId: campaign.id,
    postId: post.id,
    status,
    title: input.title,
    slides,
    caption: buildCaption(input),
    hashtags: buildHashtags(input),
    qualityCheck,
  }
}

function planMediaSlides(input: MediaCarouselInput, slideCount: number, baseLayoutType: LayoutType): MediaSlidePlan[] {
  const points = splitKeyPoints(input.keyContent)
  const slides: MediaSlidePlan[] = [
    {
      slideNumber: 1,
      role: 'hook',
      headline: input.title,
      body: `${input.topic}에 대해 지금 알아야 할 핵심만 정리했습니다.`,
      layoutType: firstSlideLayout(input, baseLayoutType),
    },
    {
      slideNumber: 2,
      role: 'context',
      headline: '왜 지금 중요한가',
      body: points[0] || `${input.topic}은 지금 ${input.category}에서 주목받는 이슈입니다.`,
      layoutType: contextLayout(baseLayoutType),
    },
  ]

  for (let index = 3; index < slideCount; index += 1) {
    const point = points[index - 2] || points[(index - 2) % Math.max(points.length, 1)] || input.keyContent
    const hasStat = /[\d%]/.test(point)
    slides.push({
      slideNumber: index,
      role: hasStat ? 'stat' : index % 2 === 0 ? 'detail' : 'key-point',
      headline: hasStat ? '숫자로 보면' : `${index - 2}번째 포인트`,
      body: point,
      layoutType: hasStat ? 'stat-highlight' : supportingLayout(baseLayoutType, index),
    })
  }

  slides.push({
    slideNumber: slideCount,
    role: 'save-cta',
    headline: '핵심만 저장하세요',
    body: `${input.topic}을 다시 볼 수 있도록 저장해두면 좋습니다.`,
    layoutType: baseLayoutType === 'minimal-clean' ? 'quote-focus' : 'minimal-clean',
  })

  return slides.slice(0, slideCount).map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
  }))
}

function splitKeyPoints(content: string) {
  return content
    .split(/\n|\.|;|,/)
    .map(item => item.trim())
    .filter(item => item.length >= 6)
    .slice(0, 8)
}

function firstSlideLayout(input: MediaCarouselInput, baseLayoutType: LayoutType): LayoutType {
  if (/뉴스|이슈|논란|속보/.test(`${input.category} ${input.contentType}`)) return 'dark-editorial'
  if (/통계|실적|데이터|%|\d/.test(`${input.title} ${input.keyContent}`)) return 'stat-highlight'
  return baseLayoutType === 'minimal-clean' ? 'cinematic-headline' : baseLayoutType
}

function contextLayout(baseLayoutType: LayoutType): LayoutType {
  if (baseLayoutType === 'breaking-news') return 'breaking-news'
  if (baseLayoutType === 'trend-feed') return 'community-style'
  return 'minimal-clean'
}

function supportingLayout(baseLayoutType: LayoutType, index: number): LayoutType {
  if (index % 3 === 0) return 'minimal-clean'
  if (baseLayoutType === 'trend-feed') return 'community-style'
  if (baseLayoutType === 'dark-editorial') return 'cinematic-headline'
  return baseLayoutType
}

function buildCaption(input: MediaCarouselInput) {
  return `${input.title}\n\n${input.keyContent.slice(0, 180)}${input.keyContent.length > 180 ? '...' : ''}\n\n저장해두고 다시 확인해보세요.`
}

function buildHashtags(input: MediaCarouselInput) {
  const normalized = [input.category, input.topic, input.contentType]
    .flatMap(item => item.split(/\s+/))
    .map(item => item.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 6)
  return Array.from(new Set(['카드뉴스', '인스타그램콘텐츠', ...normalized])).map(tag => `#${tag}`)
}

function normalizeSlideCount(slideCount: number) {
  return Math.min(Math.max(Math.round(slideCount || 5), 5), 10)
}

function tomorrowAt20() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(20, 0, 0, 0)
  return date
}
