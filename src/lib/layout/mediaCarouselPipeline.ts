import { dbService } from '../../../lib/db-service'
import type { ImageProvider } from '../ai/imageProvider'
import { getPipelineImageModel, getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutType } from './layoutTypes'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from './mediaCardHarness'
import { buildBrandHarnessPrompt, checkBrandFit, reinforceSlidesWithBrandDna } from './brandHarness'
import { runMediaCardQualityCheck, type MediaCardQualityResult } from './qualityCheck'
import { analyzeReferencePattern } from './referencePatternEngine'
import { renderMediaCard } from './renderer'
import { planTypography } from './typographyEngine'
import { generateVisualDirection } from './visualDirectionEngine'
import { getLLMClient } from '../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import {
  BrandIdentityAgent,
  CopywritingAgent,
  VisualConceptAgent,
  QualityGuardAgent,
  type AgentReport,
  type AgentReportItem,
  type AgentSlideData
} from '../carousel/agents'

export interface MediaCarouselInput {
  userId: string
  brandId: string
  brandName: string
  brandMainColor?: string
  brandToneOfVoice?: string
  brandIndustry?: string
  brandForbiddenWords?: string
  brandCtaStyle?: string
  brandDna?: string | null
  topic: string
  category: string
  title: string
  keyContent: string
  tone: string
  contentType: string
  objective?: string
  slideCount: number
  source?: string
  visualHint?: string
  productImageUrls?: string[]
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
  let plannedSlides = planMediaSlides(input, slideCount, baseLayoutType)

  // LLM copy generation — replaces rule-based placeholder copy with AI-written slide text
  plannedSlides = await generateMediaSlideCopies(input, plannedSlides)

  const brandHarnessPrompt = buildBrandHarnessPrompt({
    brandName: input.brandName,
    brandIndustry: input.brandIndustry,
    brandToneOfVoice: input.brandToneOfVoice,
    brandMainColor: input.brandMainColor,
    brandDna: input.brandDna,
  })

  // 1. Initialize Agents
  const brandAgent = new BrandIdentityAgent()
  const copyAgent = new CopywritingAgent()
  const visualAgent = new VisualConceptAgent()
  const qualityAgent = new QualityGuardAgent()

  const agentReportLogs: AgentReportItem[] = []

  let agentSlides: AgentSlideData[] = plannedSlides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role,
    headline: s.headline,
    body: s.body,
    layoutType: s.layoutType,
  }))

  // 2. Execute BrandIdentityAgent
  const brandRes = brandAgent.run({
    brandName: input.brandName,
    brandToneOfVoice: input.brandToneOfVoice,
    forbiddenWords: input.brandForbiddenWords,
    ctaStyle: input.brandCtaStyle,
    brandDna: input.brandDna,
    slides: agentSlides,
  })
  agentSlides = brandRes.slides
  agentReportLogs.push(...brandRes.logs)

  // 3. Execute CopywritingAgent
  const copyRes = copyAgent.run({
    title: input.title,
    topic: input.topic,
    category: input.category,
    brandName: input.brandName,
    slides: agentSlides,
  })
  agentSlides = copyRes.slides
  agentReportLogs.push(...copyRes.logs)

  // 4. Execute VisualConceptAgent
  const visualRes = visualAgent.run({
    category: input.category,
    topic: input.topic,
    tone: input.tone,
    brandMainColor: input.brandMainColor,
    brandIndustry: input.brandIndustry,
    slides: agentSlides,
  })
  agentSlides = visualRes.slides
  agentReportLogs.push(...visualRes.logs)
  agentSlides = reinforceSlidesWithBrandDna(agentSlides, input.brandDna)
  agentReportLogs.push({
    agentName: 'BrandHarness',
    role: 'brand-fit',
    status: 'info',
    message: 'Brand DNA harness applied to slide copy and visual prompt.',
    timestamp: new Date().toISOString(),
  })

  const imageProvider = input.imageProvider || getPipelineImageProvider()
  const slides: MediaCarouselSlideResult[] = []
  let hasFallbackImage = false

  // 5. Render slides and evaluate quality metrics
  for (const slide of agentSlides) {
    const layout = LAYOUT_DEFINITIONS[slide.layoutType as LayoutType] || LAYOUT_DEFINITIONS['dark-editorial']
    const typographyPlan = planTypography({
      headline: slide.headline,
      body: slide.body,
      category: input.category,
      layout,
      brandMainColor: input.brandMainColor,
    })
    const harness = applyMediaCardHarness({
      layout,
      typography: typographyPlan,
      slideNumber: slide.slideNumber,
      totalSlides: slideCount,
      role: slide.role as MediaSlideRole,
    })
    const visualDirection = generateVisualDirection({
      layout: harness.layout,
      category: input.category,
      topic: input.topic,
      tone: input.tone,
      visualHint: input.visualHint,
      brandMainColor: input.brandMainColor,
      brandToneOfVoice: input.brandToneOfVoice,
      brandIndustry: input.brandIndustry,
      brandDna: input.brandDna,
    })

    let backgroundImageUrl = ''
    try {
      const background = await imageProvider.generateImage(buildHarnessedVisualPrompt(`${visualDirection.prompt}, brand harness: ${brandHarnessPrompt}`, harness.template), {
        size: '1024x1024',
        productImageUrls: input.productImageUrls || [],
      })
      backgroundImageUrl = background.imageUrl
    } catch (err) {
      console.error('[MediaCarouselPipeline] Background image generation failed', err)
      hasFallbackImage = true
      // Use mock image fallback
      const fallbackImage = await new (await import('../ai/providers/mockImageProvider')).MockImageProvider().generateImage(`fallback ${visualDirection.prompt}`)
      backgroundImageUrl = fallbackImage.imageUrl
    }

    analyzeReferencePattern({
      layoutType: harness.layout.layoutType,
      headlineLength: slide.headline.length,
      bodyLength: slide.body.length,
      hasNumericSignal: /[\d%]/.test(`${slide.headline} ${slide.body}`),
    })

    const baseSlideQualityCheck = runMediaCardQualityCheck({
      layout: harness.layout,
      typography: harness.typography,
      headline: slide.headline,
      body: slide.body,
      backgroundImageUrl,
      harnessDiagnostics: harness.diagnostics,
    })
    const slideQualityCheck = checkBrandFit({
      headline: slide.headline,
      body: slide.body,
      designPrompt: visualDirection.prompt,
      brandDna: input.brandDna,
      qualityCheck: baseSlideQualityCheck,
    })

    // Feed slide diagnostics to Quality Agent
    slide.diagnostics = slideQualityCheck.issues
    slide.backgroundImageUrl = backgroundImageUrl

    const finalImageUrl = await renderMediaCard({
      id: `media-card-${Date.now()}-${slide.slideNumber}-${Math.random().toString(36).slice(2, 8)}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
      category: input.category,
      headline: slide.headline,
      body: slide.body,
      backgroundImageUrl,
      source: input.source || input.brandName,
      pageNumber: slide.slideNumber,
      totalPages: slideCount,
    })

    slides.push({
      slideNumber: slide.slideNumber,
      role: slide.role as MediaSlideRole,
      layoutType: slide.layoutType as LayoutType,
      headline: slide.headline,
      body: slide.body,
      designPrompt: visualDirection.prompt,
      backgroundImageUrl,
      finalImageUrl,
      qualityCheck: slideQualityCheck,
    })
  }

  // 6. Execute QualityGuardAgent
  const qualityRes = qualityAgent.run({
    slides: agentSlides,
    hasFallbackImage,
  })
  agentReportLogs.push(...qualityRes.logs)

  const agentReport: AgentReport = {
    timestamp: new Date().toISOString(),
    status: qualityRes.passed ? 'passed' : 'needs_review',
    score: qualityRes.score,
    logs: agentReportLogs,
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

  const qualityCheck: MediaCardQualityResult = {
    passed: qualityRes.passed,
    issues: agentReportLogs.filter(l => l.status === 'error' || l.status === 'warn').map(l => l.message),
    suggestions: agentReportLogs.filter(l => l.status === 'info').map(l => l.message),
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

async function generateMediaSlideCopies(input: MediaCarouselInput, slides: MediaSlidePlan[]): Promise<MediaSlidePlan[]> {
  const client = getLLMClient()

  const slideDescriptions = slides
    .map(s => `슬라이드 ${s.slideNumber} [${s.role}]`)
    .join('\n')

  const brandDnaSection = input.brandDna
    ? `\n브랜드 DNA (카피에 반드시 반영):\n${formatBrandDnaForPrompt(input.brandDna)}\n`
    : ''

  const prompt = `한국 인스타그램 카드뉴스 카피를 작성해주세요.

브랜드 정보:
- 브랜드명: ${input.brandName}
- 업종: ${input.brandIndustry || '미지정'}
- 톤앤매너: ${input.brandToneOfVoice || '전문적이고 신뢰감 있게'}
- 금지어: ${input.brandForbiddenWords || '없음'}
${brandDnaSection}
콘텐츠 기획:
- 주제(상품): ${input.topic}
- 캠페인 목표: ${input.objective || input.contentType}
- 콘텐츠 유형: ${input.contentType}
- 비주얼 스타일: ${input.visualHint || 'dark-editorial'}

슬라이드 구성:
${slideDescriptions}

규칙:
- headline: 20자 이하, 강렬하고 구체적 (공백 포함)
- body: 58자 이하, 핵심 메시지 전달 (공백 포함)
- hook 슬라이드: 독자의 시선을 즉시 잡는 강렬한 한 줄
- save-cta / summary 슬라이드: 저장·팔로우를 유도하는 행동 촉구 문구
- 금지어·과장표현(혁신적인, 최고의, 완벽한) 사용 금지
- 캠페인 목표는 카피의 방향성으로만 사용하고, 목표 문구 자체를 카피에 쓰지 마세요
- 모든 카피는 한국어로 작성

JSON 응답 형식:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "..." }
  ]
}`

  const result = await client.generateJson<{ slides: Array<{ slideNumber: number; headline: string; body: string }> }>(
    'media slide copy generation',
    prompt,
    () => ({ slides: slides.map(s => ({ slideNumber: s.slideNumber, headline: s.headline, body: s.body })) })
  )

  const generatedSlides = Array.isArray(result?.slides) ? result.slides : []
  const copyMap = new Map(generatedSlides.map(s => [s.slideNumber, s]))

  return slides.map(slide => {
    const generated = copyMap.get(slide.slideNumber)
    if (!generated?.headline) return slide
    return {
      ...slide,
      headline: generated.headline.trim().slice(0, 34),
      body: generated.body?.trim().slice(0, 64) || slide.body,
    }
  })
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
