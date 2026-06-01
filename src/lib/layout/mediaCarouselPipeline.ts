import { dbService } from '../../../lib/db-service'
import { type ImageProvider, sanitizeImagePrompt } from '../ai/imageProvider'
import { getPipelineImageModel, getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutType } from './layoutTypes'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from './mediaCardHarness'
import { checkBrandFit, reinforceSlidesWithBrandDna } from './brandHarness'
import { runMediaCardQualityCheck, type MediaCardQualityResult } from './qualityCheck'
import { analyzeReferencePattern } from './referencePatternEngine'
import { renderMediaCard } from './renderer'
import { planTypography } from './typographyEngine'
import { generateVisualDirection } from './visualDirectionEngine'
import { getCopywritingModel, getLLMClient } from '../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import { repairRenderableCopy, validateRenderableCopy } from '../copywriting/renderableCopy'
import { buildSemanticFallback, evaluateSemanticCopy } from '../copywriting/semanticCopyCritic'
import {
  BrandIdentityAgent,
  CopywritingAgent,
  VisualConceptAgent,
  QualityGuardAgent,
  type AgentReport,
  type AgentReportItem,
  type AgentSlideData
} from '../carousel/agents'
import { buildCopyKnowledgeContext, formatKnowledgeContextForPrompt } from '../copywriting/copyKnowledgeBase'
import type { BrandProfile, CampaignInput } from '../carousel/types'
import {
  buildEditorialDirectorPlan,
  evaluateEditorialCarousel,
  formatEditorialPlanForPrompt,
  type EditorialBriefing,
  type EditorialDirectorPlan,
  type EditorialQualityReport,
  type EditorialSlideRole,
} from '../editorial/editorialDirector'

export interface MediaCarouselInput {
  userId: string
  brandId: string
  brandName: string
  brandMainColor?: string
  brandToneOfVoice?: string
  brandIndustry?: string
  brandTargetAudience?: string
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
  briefing?: EditorialBriefing
  imageProvider?: ImageProvider
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
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

type MediaSlideRole = EditorialSlideRole

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
  // LLM copy generation — replaces rule-based placeholder copy with AI-written slide text
  // Build knowledge context before copy generation
  const mediaBrand: BrandProfile = {
    id: input.brandId,
    name: input.brandName,
    industry: input.brandIndustry || '',
    targetAudience: input.brandTargetAudience || '',
    toneOfVoice: input.brandToneOfVoice || '',
    mainColor: input.brandMainColor || '',
    forbiddenWords: input.brandForbiddenWords || '',
    ctaStyle: input.brandCtaStyle || '',
    brandDna: input.brandDna,
  }
  const mediaCampaignInput: CampaignInput = {
    productName: input.topic,
    productDescription: input.keyContent,
    keyBenefits: input.category,
    objective: input.objective || input.contentType,
    slideCount: input.slideCount,
    productImageUrls: input.productImageUrls || [],
  }
  const knowledgeCtx = buildCopyKnowledgeContext({
    brand: mediaBrand,
    input: mediaCampaignInput,
    strategy: {
      strategyType: 'problem_solution',
      targetEmotion: input.briefing?.targetEmotion || '',
      contentGoal: input.objective || input.contentType,
      angle: input.briefing?.hookDirection || '',
      recommendedSlideCount: input.slideCount,
      reason: '',
    },
  })

  const personalizationMemory = await dbService.getSummarizedPreference(input.brandId)
  const editorialPlan = buildEditorialDirectorPlan({
    productName: input.topic,
    sourceMaterial: input.keyContent,
    category: input.category,
    objective: input.objective || input.contentType,
    contentType: input.contentType,
    tone: input.tone,
    brandName: input.brandName,
    targetAudience: input.brandTargetAudience || '',
    brandCtaStyle: input.brandCtaStyle,
    slideCount,
    baseLayoutType,
    briefing: input.briefing,
    memory: personalizationMemory,
    knowledgeContext: knowledgeCtx,
  })
  let plannedSlides = planMediaSlides(input, editorialPlan)
  plannedSlides = await generateMediaSlideCopies(input, plannedSlides, editorialPlan, knowledgeCtx)

  // 1. Initialize Agents
  const brandAgent = new BrandIdentityAgent()
  const copyAgent = new CopywritingAgent()
  const visualAgent = new VisualConceptAgent()
  const qualityAgent = new QualityGuardAgent()

  const agentReportLogs: AgentReportItem[] = []
  agentReportLogs.push({
    agentName: 'EditorialDirector',
    role: 'strategy-orchestration',
    status: 'info',
    message: `Editorial plan established: ${editorialPlan.carouselStrategy.emotionCurve.join(' -> ')}.`,
    details: editorialPlan,
    timestamp: new Date().toISOString(),
  })

  let agentSlides: AgentSlideData[] = plannedSlides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role,
    headline: s.headline,
    body: s.body,
    layoutType: s.layoutType,
  }))

  const brandRes = brandAgent.run({
    brandName: input.brandName,
    brandToneOfVoice: input.brandToneOfVoice,
    forbiddenWords: input.brandForbiddenWords,
    ctaStyle: input.brandCtaStyle,
    brandDna: input.brandDna,
    slides: agentSlides,
    isGeneralMode: input.generationMode === 'general',
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

  // 5. Render slides and evaluate quality metrics
  const slideResults = await Promise.all(
    agentSlides.map(async (slide) => {
      const slidePlan = editorialPlan.slides.find(plan => plan.slideNumber === slide.slideNumber)
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
        role: slide.role as MediaSlideRole,
        editorialDirection: slidePlan?.visualDirection,
      })

      const sanitizedVisualPrompt = sanitizeImagePrompt(visualDirection.prompt)

      let backgroundImageUrl = ''
      try {
        const background = await imageProvider.generateImage(buildHarnessedVisualPrompt(sanitizedVisualPrompt, harness.template, slidePlan?.visualDirection), {
          size: '1024x1536',
          productImageUrls: input.productImageUrls || [],
        })
        backgroundImageUrl = background.imageUrl
      } catch (err) {
        console.error('[MediaCarouselPipeline] Background image generation failed', err)
        throw new Error(`Background image generation failed for slide ${slide.slideNumber}. Please try again.`)
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
        designPrompt: sanitizedVisualPrompt,
        harnessDiagnostics: harness.diagnostics,
      })
      const renderableCheck = validateRenderableCopy({
        headline: slide.headline,
        body: slide.body,
        constraints: {
          maxHeadlineChars: slidePlan?.copyConstraints.maxHeadlineChars || 25,
          maxBodyChars: slidePlan?.copyConstraints.maxBodyChars || 220,
          maxBodyLines: 6,
          lineLength: 32,
        },
      })
      if (!renderableCheck.passed) {
        baseSlideQualityCheck.issues.push(...renderableCheck.issues)
      }
      const slideQualityCheck = checkBrandFit({
        headline: slide.headline,
        body: slide.body,
        designPrompt: sanitizedVisualPrompt,
        brandDna: input.brandDna,
        qualityCheck: baseSlideQualityCheck,
      })

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

      console.log(`[DEBUG] Slide ${slide.slideNumber} - Background Prompt: "${sanitizedVisualPrompt}" | Headline: "${slide.headline}" | Body: "${slide.body}" | Final Image URL: "${finalImageUrl}"`)

      return { slide, harness, sanitizedVisualPrompt, backgroundImageUrl, finalImageUrl, slideQualityCheck }
    })
  )

  for (const result of slideResults) {
    const { slide, sanitizedVisualPrompt, backgroundImageUrl, finalImageUrl, slideQualityCheck } = result

    // Feed slide diagnostics to Quality Agent
    slide.diagnostics = slideQualityCheck.issues
    slide.backgroundImageUrl = backgroundImageUrl

    slides.push({
      slideNumber: slide.slideNumber,
      role: slide.role as MediaSlideRole,
      layoutType: slide.layoutType as LayoutType,
      headline: slide.headline,
      body: slide.body,
      designPrompt: sanitizedVisualPrompt,
      backgroundImageUrl,
      finalImageUrl,
      qualityCheck: slideQualityCheck,
    })
  }

  // 6. Execute QualityGuardAgent
  const qualityRes = qualityAgent.run({
    slides: agentSlides,
    hasFallbackImage: false,
  })
  agentReportLogs.push(...qualityRes.logs)

  const editorialQuality = evaluateEditorialCarousel(editorialPlan, slides)
  for (const issue of editorialQuality.issues) {
    agentReportLogs.push({
      agentName: 'EditorialDirector',
      role: issue.dimension,
      status: issue.severity === 'block' ? 'error' : 'warn',
      message: issue.message,
      timestamp: new Date().toISOString(),
    })
  }
  const qualityPassed = qualityRes.passed && editorialQuality.passed

  const agentReport: AgentReport & {
    editorialPlan: EditorialDirectorPlan
    editorialValidation: EditorialQualityReport
  } = {
    timestamp: new Date().toISOString(),
    status: qualityPassed ? 'passed' : 'needs_review',
    score: Math.min(qualityRes.score, editorialQuality.score),
    logs: agentReportLogs,
    editorialPlan,
    editorialValidation: editorialQuality,
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
    passed: qualityPassed,
    issues: agentReportLogs.filter(l => l.status === 'error' || l.status === 'warn').map(l => l.message),
    suggestions: agentReportLogs.filter(l => l.status === 'info').map(l => l.message),
  }
  const status = qualityCheck.passed ? 'pending_approval' : 'needs_review'
  await dbService.updateCampaignStatus(campaign.id, status)
  await dbService.createQualityScoreLog({
    campaignId: campaign.id,
    userId: input.userId,
    passed: editorialQuality.passed,
    score: editorialQuality.score,
    narrativeFlowScore: editorialQuality.narrativeFlowScore,
    personaFitScore: editorialQuality.personaFitScore,
    hookPatternScore: editorialQuality.hookPatternScore,
    issueCount: editorialQuality.issues.length,
    issuesJson: JSON.stringify(editorialQuality.issues),
    hookPatternUsed: knowledgeCtx.selectedHookPatterns[0]?.id,
    personaUsed: knowledgeCtx.personaProfile.id,
    industryUsed: knowledgeCtx.industryToneRule?.industry,
    memoryContextUsed: editorialPlan.personalization.applied,
  })

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

async function generateMediaSlideCopies(
  input: MediaCarouselInput,
  slides: MediaSlidePlan[],
  editorialPlan: EditorialDirectorPlan,
  knowledgeCtx?: ReturnType<typeof buildCopyKnowledgeContext>
): Promise<MediaSlidePlan[]> {
  const client = getLLMClient()

  const slideDescriptions = slides
    .map(s => `슬라이드 ${s.slideNumber} [${s.role}]: ${rolePurpose(s.role)}
  - 기획 단서: ${s.headline}${s.body ? ` / ${s.body}` : ''}`)
    .join('\n')

  // Separate RSS context block (always include fully) from rest of keyContent
  const RSS_MARKER = '[실시간 뉴스 컨텍스트'
  const RSS_MARKER_EN = '[Real-Time News Context'
  const fullContent = input.keyContent.trim()
  const rssStart = Math.max(fullContent.indexOf(RSS_MARKER), fullContent.indexOf(RSS_MARKER_EN))
  const baseContent = rssStart > 0 ? fullContent.slice(0, rssStart).trim() : fullContent
  const rssContent = rssStart > 0 ? fullContent.slice(rssStart) : ''

  // Keep base content to 2500 chars + full RSS block (up to 2000 chars)
  const sourceMaterial = [
    baseContent.slice(0, 2500),
    rssContent.slice(0, 2000),
  ].filter(Boolean).join('\n\n')

  const isGeneral = input.generationMode === 'general'
  const brandDnaSection = (input.brandDna && !isGeneral)
    ? `\n브랜드 DNA (카피에 반드시 반영):\n${formatBrandDnaForPrompt(input.brandDna)}\n`
    : ''

  const knowledgeSection = (knowledgeCtx && !isGeneral)
    ? `\n${formatKnowledgeContextForPrompt(knowledgeCtx)}\n`
    : ''
  const editorialPlanSection = formatEditorialPlanForPrompt(editorialPlan)

  const systemPrompt = isGeneral
    ? `당신은 한국 인스타그램 정보/시사/트렌드 카드뉴스 전문 에디터입니다. 제공된 기사/사실 자료를 객관적이고 가독성 높게 요약하여 카드뉴스 카피를 작성하세요. 실시간 뉴스 컨텍스트가 제공된 경우 반드시 해당 기사들의 실제 앵글·키워드·트렌드를 카피에 반영하세요. 브랜드 이름이나 브랜드 DNA를 노출하지 말고 오직 뉴스/정보 전달에만 집중하세요. 유효한 JSON으로만 응답하세요.`
    : (knowledgeCtx
      ? `당신은 한국 인스타그램 SNS 에디토리얼 카피라이터입니다. 대학내일, 뉴닉 스타일의 카드뉴스 카피를 씁니다. 상품 설명을 요약하지 말고, 감성적 훅·페르소나·서사 흐름을 기반으로 네이티브 한국어 카피를 생성하세요. 실시간 뉴스 컨텍스트가 제공된 경우 해당 뉴스 트렌드를 훅과 첫 슬라이드에 반영하세요. 제공된 자료에서 확인할 수 없는 수치는 쓰지 말고, 유효한 JSON으로만 응답하세요.`
      : '당신은 정확성을 우선하는 한국 SNS 카드뉴스 에디터입니다. 제공된 자료에서 확인할 수 없는 사실이나 수치는 쓰지 말고, 슬라이드 간 서사를 정돈해 유효한 JSON으로만 응답하세요.')

  const langInstruction = input.language === 'en'
    ? '\n\nIMPORTANT: Write ALL headlines, body copy, and captions in English only. Do not use Korean in any field.'
    : ''

  const hasRssContext = sourceMaterial.includes('[실시간 뉴스 컨텍스트') || sourceMaterial.includes('[Real-Time News Context')
  const rssInstruction = hasRssContext
    ? `\n- 실시간 뉴스 컨텍스트의 기사 제목·내용에서 구체적인 키워드·앵글·트렌드를 훅과 body에 반드시 반영하세요\n- 뉴스 기사에 있는 실제 이슈를 다루어야 독자의 공감을 얻습니다\n- 뉴스에 없는 수치나 사실은 만들지 마세요`
    : ''

  const prompt = `한국 인스타그램 카드뉴스 카피를 작성해주세요.

${editorialPlanSection}

브랜드 정보:
- 브랜드명: ${isGeneral ? '일반 정보/뉴스 전달용' : input.brandName}
- 업종: ${isGeneral ? '시사/정보/트렌드' : (input.brandIndustry || '미지정')}
- 톤앤매너: ${isGeneral ? '객관적이고 신뢰감 있게' : (input.brandToneOfVoice || '전문적이고 신뢰감 있게')}
- 금지어: ${isGeneral ? '없음' : (input.brandForbiddenWords || '없음')}
${brandDnaSection}${knowledgeSection}
콘텐츠 기획:
- 주제(상품): ${input.topic}
- 캠페인 목표: ${input.objective || input.contentType}
- 콘텐츠 유형: ${input.contentType}
- 비주얼 스타일: ${input.visualHint || 'dark-editorial'}

제공된 사실 및 기획 자료:
${sourceMaterial || '추가 자료 없음'}

슬라이드 구성:
${slideDescriptions}

규칙:
- headline: 25자 이하, 강렬하고 구체적 (공백 포함)
- body: 220자 이하, 핵심 정보를 1~4문장으로 풍성하게 전달 (공백 포함) — 너무 짧으면 감점
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요. 문장을 줄여야 하면 중간을 자르지 말고 완성 문장 단위로 다시 작성하세요.${rssInstruction}
- 전체 흐름은 관심 유도 → 이해/근거 → 핵심 가치 → 정리 또는 행동 촉구 순서로 이어져야 하며, 같은 정보를 반복하지 마세요
- 각 슬라이드는 지정된 역할과 기획 단서를 발전시키되 앞뒤 슬라이드와 자연스럽게 연결하세요
- hook 슬라이드: 독자의 시선을 즉시 잡되 사실로 확인되지 않은 효과를 단정하지 마세요
- stat 슬라이드: 제공된 사실 및 기획 자료에 있는 수치만 사용하세요
- save-cta / summary 슬라이드: 핵심 내용을 짧게 정리한 뒤 저장·확인을 자연스럽게 유도하세요
- 제공된 사실 및 브랜드 DNA에 없는 수치, 할인율, 순위, 인증, 성분, 후기, 성능 또는 효능을 새로 만들지 마세요
- 자료가 부족하면 검증 가능한 특징을 단정하지 말고 주제와 브랜드 관점 중심으로 표현하세요
- 금지어·과장표현(혁신적인, 최고의, 완벽한) 사용 금지
- 캠페인 목표는 카피의 방향성으로만 사용하고, 목표 문구 자체를 카피에 쓰지 마세요
- 모든 카피는 한국어로 작성${langInstruction}

JSON 응답 형식:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "..." }
  ]
}`

  const result = await client.generateJson<{ slides: Array<{ slideNumber: number; headline: string; body: string }> }>(
    'media slide copy generation',
    prompt,
    () => ({ slides: slides.map(s => ({ slideNumber: s.slideNumber, headline: s.headline, body: s.body })) }),
    {
      model: getCopywritingModel(),
      temperature: 0.35,
      systemPrompt,
    }
  )

  const generatedSlides = Array.isArray(result?.slides) ? result.slides : []
  const copyMap = new Map(generatedSlides.map(s => [s.slideNumber, s]))
  const groundingText = `${input.topic}\n${input.title}\n${input.keyContent}`

  const repairedSlides = slides.map(slide => {
    const generated = copyMap.get(slide.slideNumber)
    const constraints = editorialPlan.slides.find(plan => plan.slideNumber === slide.slideNumber)?.copyConstraints
    if (typeof generated?.headline !== 'string' || !generated.headline.trim()) return slide
    const body = typeof generated.body === 'string' ? generated.body.trim() : slide.body
    if (hasUnsupportedNumericClaim(`${generated.headline} ${body}`, groundingText)) return slide
    const repaired = repairRenderableCopy({
      headline: generated.headline.trim(),
      body,
      constraints: {
        maxHeadlineChars: constraints?.maxHeadlineChars || 25,
        maxBodyChars: constraints?.maxBodyChars || 220,
        maxBodyLines: 6,
        lineLength: 32,
      },
    })
    return {
      ...slide,
      headline: repaired.headline || slide.headline,
      body: repaired.body || slide.body,
    }
  })

  return enforceSemanticMeaning({
    input,
    slides: repairedSlides,
    editorialPlan,
    sourceMaterial,
    systemPrompt,
  })
}

async function enforceSemanticMeaning(params: {
  input: MediaCarouselInput
  slides: MediaSlidePlan[]
  editorialPlan: EditorialDirectorPlan
  sourceMaterial: string
  systemPrompt: string
}): Promise<MediaSlidePlan[]> {
  const initialReport = evaluateSemanticCopy({
    topic: params.input.topic,
    slides: params.slides.map(slide => ({
      slideNumber: slide.slideNumber,
      role: slide.role,
      headline: slide.headline,
      body: slide.body,
    })),
  })
  const weakSlideNumbers = new Set(initialReport.issues.filter(issue => issue.severity === 'block').map(issue => issue.slideNumber))
  if (weakSlideNumbers.size === 0) return params.slides

  const client = getLLMClient()
  const weakSlides = params.slides.filter(slide => weakSlideNumbers.has(slide.slideNumber))
  const reviewPrompt = `다음 카드뉴스 슬라이드 중 의미가 완성되지 않은 본문만 다시 작성하세요.

주제: ${params.input.topic}
목표: ${params.input.objective || params.input.contentType}

제공 자료:
${params.sourceMaterial || '추가 자료 없음'}

약한 슬라이드와 문제:
${weakSlides.map(slide => {
  const issues = initialReport.issues.filter(issue => issue.slideNumber === slide.slideNumber).map(issue => issue.message).join(' / ')
  return `슬라이드 ${slide.slideNumber} [${slide.role}]
headline: ${slide.headline}
body: ${slide.body}
문제: ${issues}`
}).join('\n\n')}

재작성 기준:
- 본문은 단순히 문장처럼 끝나는 것이 아니라, 독자가 이해할 수 있는 하나의 의미를 완성해야 합니다.
- 문제 제기만 하고 결론을 빼거나, "이유는", "핵심은", "더"처럼 열린 생각으로 끝내지 마세요.
- 각 슬라이드 역할에 맞게 관찰, 해석, 구체적 의미, 다음 행동 중 하나를 반드시 완성하세요.
- 사용자의 주제와 무관한 시사/경제/뉴스 정보는 절대 넣지 마세요.
- headline은 필요할 때만 다듬고 25자 이하로 유지하세요.
- body는 220자 이하, 1~4문장으로 작성하세요.

JSON만 반환:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "..." }
  ]
}`

  const result = await client.generateJson<{ slides: Array<{ slideNumber: number; headline: string; body: string }> }>(
    'semantic slide copy review',
    reviewPrompt,
    () => ({ slides: [] }),
    {
      model: getCopywritingModel(),
      temperature: 0.25,
      systemPrompt: `${params.systemPrompt}\n당신은 의미 완성성을 검수하는 한국 SNS 에디토리얼 데스크입니다. 문장 어미가 아니라 슬라이드가 실제로 하나의 의미를 완성했는지 판단하고 재작성합니다. JSON으로만 응답하세요.`,
    }
  )

  const rewriteMap = new Map((Array.isArray(result?.slides) ? result.slides : []).map(slide => [slide.slideNumber, slide]))
  const nextSlides = params.slides.map(slide => {
    if (!weakSlideNumbers.has(slide.slideNumber)) return slide
    const rewritten = rewriteMap.get(slide.slideNumber)
    const constraints = params.editorialPlan.slides.find(plan => plan.slideNumber === slide.slideNumber)?.copyConstraints
    const repaired = repairRenderableCopy({
      headline: rewritten?.headline?.trim() || slide.headline,
      body: rewritten?.body?.trim() || buildSemanticFallback({
        topic: params.input.topic,
        role: slide.role,
        headline: slide.headline,
      }),
      constraints: {
        maxHeadlineChars: constraints?.maxHeadlineChars || 25,
        maxBodyChars: constraints?.maxBodyChars || 220,
        maxBodyLines: 6,
        lineLength: 32,
      },
    })
    return {
      ...slide,
      headline: repaired.headline || slide.headline,
      body: repaired.body || slide.body,
    }
  })

  const finalReport = evaluateSemanticCopy({
    topic: params.input.topic,
    slides: nextSlides.map(slide => ({
      slideNumber: slide.slideNumber,
      role: slide.role,
      headline: slide.headline,
      body: slide.body,
    })),
  })

  if (finalReport.passed) return nextSlides

  const finalWeak = new Set(finalReport.issues.filter(issue => issue.severity === 'block').map(issue => issue.slideNumber))
  return nextSlides.map(slide => {
    if (!finalWeak.has(slide.slideNumber)) return slide
    const repaired = repairRenderableCopy({
      headline: slide.headline,
      body: buildSemanticFallback({
        topic: params.input.topic,
        role: slide.role,
        headline: slide.headline,
      }),
      constraints: {
        maxHeadlineChars: 25,
        maxBodyChars: 220,
        maxBodyLines: 6,
        lineLength: 32,
      },
    })
    return { ...slide, headline: repaired.headline, body: repaired.body }
  })
}

function rolePurpose(role: MediaSlideRole) {
  const purposes: Record<MediaSlideRole, string> = {
    hook: '주제의 필요성이나 관심 포인트를 여는 첫 문장',
    context: '독자가 이해할 배경 또는 문제 상황',
    'key-point': '주제를 설명하는 핵심 가치 한 가지',
    detail: '구체적인 특징 또는 활용 맥락',
    stat: '제공 자료로 확인 가능한 수치나 근거',
    summary: '앞선 내용을 압축하고 다음 행동을 제안',
    'save-cta': '저장 또는 상세 확인 행동을 제안',
  }
  return purposes[role]
}

function hasUnsupportedNumericClaim(copy: string, groundingText: string) {
  const copySignals = copy.match(/\d[\d,.]*\s*(?:%|퍼센트|원|명|개|회|배|위|일|시간|분|ml|g|kg|cm)?/gi) || []
  if (copySignals.length === 0) return false
  const sourceSignals = new Set(
    (groundingText.match(/\d[\d,.]*\s*(?:%|퍼센트|원|명|개|회|배|위|일|시간|분|ml|g|kg|cm)?/gi) || [])
      .map(signal => signal.replace(/\s+/g, '').toLowerCase())
  )
  return copySignals.some(signal => !sourceSignals.has(signal.replace(/\s+/g, '').toLowerCase()))
}

function planMediaSlides(input: MediaCarouselInput, editorialPlan: EditorialDirectorPlan): MediaSlidePlan[] {
  const parsed = parseSlideLines(input.keyContent)
  return editorialPlan.slides.map((slidePlan, index) => {
    const item = parsed[index] || parsed[index - 1] || parsed[0]
    const headline = slidePlan.role === 'hook'
      ? input.briefing?.hookDirection || input.title || item?.headline || input.topic
      : item?.headline || input.topic
    const body = slidePlan.role === 'save-cta'
      ? input.briefing?.recommendedCta || input.brandCtaStyle || summarize(input.keyContent, 140)
      : item?.body || slidePlan.briefingInstruction || summarize(item?.headline || input.keyContent, 220)
    return {
      slideNumber: slidePlan.slideNumber,
      role: slidePlan.role,
      ...repairRenderableCopy({
        headline: trimHeadline(headline),
        body,
        constraints: {
          maxHeadlineChars: slidePlan.copyConstraints.maxHeadlineChars,
          maxBodyChars: slidePlan.copyConstraints.maxBodyChars,
          maxBodyLines: 6,
          lineLength: 32,
        },
      }),
      layoutType: slidePlan.layoutType,
    }
  })
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
