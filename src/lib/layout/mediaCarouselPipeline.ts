import { dbService } from '../../../lib/db-service'
import type { ImageProvider } from '../ai/imageProvider'
import { getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutType } from './layoutTypes'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from './mediaCardHarness'
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
  const baseLayoutType = toMediaLayout(selectLayout({
    category: input.category,
    topic: input.topic,
    tone: input.tone,
    contentType: input.contentType,
  }))
  const slidePlans = planMediaSlides(input, slideCount, baseLayoutType)
  const imageProvider = input.imageProvider || getPipelineImageProvider()
  const slides: MediaCarouselSlideResult[] = []
  const qualityIssues: string[] = []
  const qualitySuggestions: string[] = []

  for (const slide of slidePlans) {
    const layout = LAYOUT_DEFINITIONS[slide.layoutType]
    const typographyPlan = planTypography({
      headline: slide.headline,
      body: slide.body,
      category: input.category,
      layout,
      brandMainColor: input.brandMainColor,
    })
    const harness = applyMediaCardHarness({ layout, typography: typographyPlan })
    const visualDirection = generateVisualDirection({
      layout: harness.layout,
      category: input.category,
      topic: input.topic,
      tone: input.tone,
      visualHint: input.visualHint,
      brandMainColor: input.brandMainColor,
      brandToneOfVoice: input.brandToneOfVoice,
      brandIndustry: input.brandIndustry,
    })
    const background = await imageProvider.generateImage(buildHarnessedVisualPrompt(visualDirection.prompt), {
      size: '1024x1024',
      productImageUrls: [],
    })
    analyzeReferencePattern({
      layoutType: harness.layout.layoutType,
      headlineLength: slide.headline.length,
      bodyLength: slide.body.length,
      hasNumericSignal: /[\d%]/.test(`${slide.headline} ${slide.body}`),
    })

    const qualityCheck = runMediaCardQualityCheck({
      layout: harness.layout,
      typography: harness.typography,
      headline: slide.headline,
      body: slide.body,
      backgroundImageUrl: background.imageUrl,
      harnessDiagnostics: harness.diagnostics,
    })
    qualityIssues.push(...qualityCheck.issues.map(issue => `${slide.slideNumber}장: ${issue}`))
    qualitySuggestions.push(...qualityCheck.suggestions.map(suggestion => `${slide.slideNumber}장: ${suggestion}`))

    const finalImageUrl = await renderMediaCard({
      id: `media-card-${Date.now()}-${slide.slideNumber}-${Math.random().toString(36).slice(2, 8)}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
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
  const parsed = parseSlideLines(input.keyContent)
  const first = parsed[0]
  const plans: MediaSlidePlan[] = [
    {
      slideNumber: 1,
      role: 'hook',
      headline: trimHeadline(input.title || first?.headline || input.topic),
      body: first?.body || first?.headline || summarize(input.keyContent, 58),
      layoutType: firstSlideLayout(input, baseLayoutType),
    },
  ]

  for (let index = 2; index <= slideCount; index += 1) {
    const item = parsed[index - 1] || parsed[index - 2] || parsed[(index - 2) % Math.max(parsed.length, 1)]
    const fallback = item?.headline || input.topic
    const body = item?.body || summarize(item?.headline || input.keyContent, 64)
    const hasStat = /[\d%]/.test(`${fallback} ${body}`)
    plans.push({
      slideNumber: index,
      role: index === slideCount ? 'summary' : hasStat ? 'stat' : index % 2 === 0 ? 'context' : 'key-point',
      headline: trimHeadline(index === slideCount && !item ? `${input.topic} 핵심 요약` : fallback),
      body,
      layoutType: hasStat ? 'stat-highlight' : supportingLayout(baseLayoutType, index),
    })
  }

  return plans.slice(0, slideCount).map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
  }))
}

function parseSlideLines(content: string) {
  return content
    .split(/\n+/)
    .map(line => line.replace(/^[-*•\d.\s]+/, '').trim())
    .filter(Boolean)
    .map(line => {
      const [rawHeadline, ...rest] = line.split(/\s[-–—:：]\s|:\s|：\s/)
      return {
        headline: trimHeadline(rawHeadline || line),
        body: rest.join(' ').trim() || '',
      }
    })
    .filter(item => item.headline.length > 0)
    .slice(0, 10)
}

function trimHeadline(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^슬라이드\s*\d+\s*/i, '')
    .trim()
    .slice(0, 34)
}

function summarize(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength).replace(/\s+\S*$/, '')}.`
}

function firstSlideLayout(input: MediaCarouselInput, baseLayoutType: LayoutType): LayoutType {
  if (/속보|긴급|정치|사회|논란|이슈/.test(`${input.category} ${input.contentType} ${input.title}`)) return 'breaking-news'
  if (/통계|수치|데이터|%|\d/.test(`${input.title} ${input.keyContent}`)) return 'stat-highlight'
  return baseLayoutType === 'minimal-clean' ? 'dark-editorial' : baseLayoutType
}

function supportingLayout(baseLayoutType: LayoutType, index: number): LayoutType {
  if (baseLayoutType === 'breaking-news') return index % 2 === 0 ? 'breaking-news' : 'dark-editorial'
  if (baseLayoutType === 'trend-feed') return index % 2 === 0 ? 'community-style' : 'dark-editorial'
  if (baseLayoutType === 'stat-highlight') return index % 2 === 0 ? 'dark-editorial' : 'stat-highlight'
  if (baseLayoutType === 'magazine') return index % 2 === 0 ? 'magazine' : 'dark-editorial'
  if (baseLayoutType === 'split-comparison') return index % 2 === 0 ? 'split-comparison' : 'dark-editorial'
  return index % 2 === 0 ? 'dark-editorial' : 'cinematic-headline'
}

function toMediaLayout(layoutType: LayoutType): LayoutType {
  if (layoutType === 'minimal-clean' || layoutType === 'quote-focus') return 'dark-editorial'
  return layoutType
}

function buildCaption(input: MediaCarouselInput) {
  const body = summarize(input.keyContent, 180)
  return `${input.title}\n\n${body}\n\n저장해두고 필요한 순간 다시 확인해보세요.`
}

function buildHashtags(input: MediaCarouselInput) {
  const normalized = [input.category, input.topic, input.contentType]
    .flatMap(item => item.split(/\s+/))
    .map(item => item.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 6)
  return Array.from(new Set(['카드뉴스', '인스타그램콘텐츠', '콘텐츠자동화', ...normalized])).map(tag => `#${tag}`)
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
