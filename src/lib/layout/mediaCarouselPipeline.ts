import { dbService } from '../../../lib/db-service'
import { type ImageProvider, sanitizeImagePrompt } from '../ai/imageProvider'
import { getPipelineImageModel, getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutType } from './layoutTypes'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from './mediaCardHarness'
import { getCardHarnessContract, repairCopyToHarness, validateHarnessedCopy } from './cardHarnessContract'
import { checkBrandFit, reinforceSlidesWithBrandDna } from './brandHarness'
import { runMediaCardQualityCheck, type MediaCardQualityResult } from './qualityCheck'
import { analyzeReferencePattern } from './referencePatternEngine'
import { renderMediaCard } from './renderer'
import { planTypography } from './typographyEngine'
import { generateVisualDirection } from './visualDirectionEngine'
import { getCopywritingModel, getLLMClient } from '../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import { runBrandIntelligenceCompression } from '../intelligence/brandIntelligence'
import { repairRenderableCopy } from '../copywriting/renderableCopy'
import { evaluateSemanticCopy } from '../copywriting/semanticCopyCritic'
import { buildStoryOntology, formatStoryOntologyForPrompt, getStoryNode } from '../copywriting/storyOntology'
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
import { formatDomainCopyGuidance, getGenerationDomainProfile, type DomainProfile } from '../content/domainProfile'
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
  const domainProfile = getGenerationDomainProfile({
    topic: input.topic,
    category: input.category,
    brandIndustry: input.brandIndustry,
    contentType: input.contentType,
  })
  console.info('[DomainProfile:resolved]', {
    topic: input.topic,
    category: input.category,
    brandIndustry: input.brandIndustry,
    contentType: input.contentType,
    domain: domainProfile.domain,
    label: domainProfile.label,
    anchors: domainProfile.requiredCopyAnchors,
    imageSubject: domainProfile.imageSubject,
  })
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
  plannedSlides = await generateMediaSlideCopies(input, plannedSlides, editorialPlan, knowledgeCtx, domainProfile)
  plannedSlides = enforceHarnessCopy(input, plannedSlides)

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
  agentSlides = enforceHarnessAgentCopy(input, agentSlides)

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
  const finalCopyGuard = runFinalSemanticCopyGuard({
    input,
    slides: agentSlides,
    editorialPlan,
    domainProfile,
  })
  agentSlides = finalCopyGuard.slides
  agentReportLogs.push(...finalCopyGuard.logs)
  agentSlides = enforceHarnessAgentCopy(input, agentSlides)
  agentSlides = suppressWordOveruse(agentSlides)

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
        headline: slide.headline,
        body: slide.body,
        tone: input.tone,
        visualHint: input.visualHint,
        brandMainColor: input.brandMainColor,
        brandToneOfVoice: input.brandToneOfVoice,
        brandIndustry: input.brandIndustry,
        brandDna: input.brandDna,
        role: slide.role as MediaSlideRole,
        editorialDirection: slidePlan?.visualDirection,
        domainProfile,
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
      const renderableCheck = validateHarnessedCopy(slide.role, slide.headline, slide.body)
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
    groundingSources?: Array<{ title: string; provider?: string; url: string }>
  } = {
    timestamp: new Date().toISOString(),
    status: qualityPassed ? 'passed' : 'needs_review',
    score: Math.min(qualityRes.score, editorialQuality.score),
    logs: agentReportLogs,
    editorialPlan,
    editorialValidation: editorialQuality,
    groundingSources: extractGroundingSources(input.keyContent),
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
    trendContextUsed: hasExternalGrounding(input.keyContent),
    memoryContextUsed: editorialPlan.personalization.applied,
  })

  const caption = await generateCaption(input, slides)

  const post = await dbService.createPost(input.userId, input.brandId, campaign.id, {
    caption,
    hashtags: buildHashtags(input).join(', '),
    scheduledAt: tomorrowAt20(),
  })
  await dbService.updatePostStatus(post.id, 'pending_approval')

  // Fire-and-forget: update brand intelligence after each successful generation.
  // Never awaited — never blocks the response.
  void runBrandIntelligenceCompression(input.brandId, input.userId)

  return {
    campaignId: campaign.id,
    postId: post.id,
    status,
    title: input.title,
    slides,
    caption,
    hashtags: buildHashtags(input),
    qualityCheck,
  }
}

function hasExternalGrounding(value: string) {
  return /\[(?:외부 리서치 브리프|EXTERNAL RESEARCH BRIEF|실시간|Real-Time News Context)/i.test(value)
}

function extractGroundingSources(value: string) {
  const sources: Array<{ title: string; provider?: string; url: string }> = []
  for (const line of value.split(/\r?\n/)) {
    const match = line.match(/^-\s*(.+?)(?:\s+\(([^)]+)\))?\s+(https?:\/\/\S+)/)
    if (!match) continue
    sources.push({
      title: match[1].trim().slice(0, 160),
      provider: match[2]?.trim(),
      url: match[3].trim(),
    })
  }
  return sources.slice(0, 12)
}

async function generateMediaSlideCopies(
  input: MediaCarouselInput,
  slides: MediaSlidePlan[],
  editorialPlan: EditorialDirectorPlan,
  knowledgeCtx: ReturnType<typeof buildCopyKnowledgeContext> | undefined,
  domainProfile: DomainProfile
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
  console.info('[DomainProfile:copy]', {
    source: 'resolved',
    topic: input.topic,
    category: input.category,
    brandIndustry: input.brandIndustry,
    contentType: input.contentType,
    domain: domainProfile.domain,
    label: domainProfile.label,
    anchors: domainProfile.requiredCopyAnchors,
  })
  const domainGuidanceSection = formatDomainCopyGuidance(domainProfile)
  const storyOntology = buildStoryOntology({
    topic: input.topic,
    category: input.category,
    sourceMaterial,
    editorialPlan,
  })
  const storyOntologySection = formatStoryOntologyForPrompt(storyOntology)
  const isEnglish = input.language === 'en'

  const systemPrompt = isEnglish
    ? (isGeneral
      ? 'You are an English Instagram carousel editor for information, news, and trend content. Summarize only the provided articles or factual material into objective, readable card copy. If real-time news context is provided, reflect the actual article angles, keywords, and trends. Return valid JSON only.'
      : 'You are an English Instagram carousel copywriter. Write native, specific, editorial social copy based on the provided brand, audience, source material, and slide plan. Do not invent numbers, claims, rankings, reviews, or benefits not supported by the supplied material. Return valid JSON only.')
    : (isGeneral
      ? `당신은 한국 인스타그램 정보/시사/트렌드 카드뉴스 전문 에디터입니다. 제공된 기사/사실 자료를 객관적이고 가독성 높게 요약하여 카드뉴스 카피를 작성하세요. 실시간 뉴스 컨텍스트가 제공된 경우 반드시 해당 기사들의 실제 앵글·키워드·트렌드를 카피에 반영하세요. 브랜드 이름이나 브랜드 DNA를 노출하지 말고 오직 뉴스/정보 전달에만 집중하세요. 유효한 JSON으로만 응답하세요.`
      : (knowledgeCtx
        ? `당신은 한국 인스타그램 SNS 에디토리얼 카피라이터입니다. 대학내일, 뉴닉 스타일의 카드뉴스 카피를 씁니다. 상품 설명을 요약하지 말고, 감성적 훅·페르소나·서사 흐름을 기반으로 네이티브 한국어 카피를 생성하세요. 실시간 뉴스 컨텍스트가 제공된 경우 해당 뉴스 트렌드를 훅과 첫 슬라이드에 반영하세요. 제공된 자료에서 확인할 수 없는 수치는 쓰지 말고, 유효한 JSON으로만 응답하세요.`
        : '당신은 정확성을 우선하는 한국 SNS 카드뉴스 에디터입니다. 제공된 자료에서 확인할 수 없는 사실이나 수치는 쓰지 말고, 슬라이드 간 서사를 정돈해 유효한 JSON으로만 응답하세요.'))

  const languageRule = isEnglish
    ? 'Write every headline, body, caption, and hashtag in natural English only. Do not use Korean in any field.'
    : '모든 카피는 한국어로 작성'

  const hasRssContext = sourceMaterial.includes('[실시간 뉴스 컨텍스트') || sourceMaterial.includes('[Real-Time News Context')
  const rssInstruction = hasRssContext
    ? `\n- 실시간 뉴스 컨텍스트의 기사 제목·내용에서 구체적인 키워드·앵글·트렌드를 훅과 body에 반드시 반영하세요\n- 뉴스 기사에 있는 실제 이슈를 다루어야 독자의 공감을 얻습니다\n- 뉴스에 없는 수치나 사실은 만들지 마세요`
    : ''
  const hasResearchBrief = sourceMaterial.includes('[외부 리서치 브리프') || sourceMaterial.includes('[EXTERNAL RESEARCH BRIEF')
  const researchInstruction = hasResearchBrief
    ? `\n- 외부 리서치 브리프가 있으면 가장 우선되는 사실 근거로 사용하세요.
- 각 슬라이드는 리서치 브리프의 "슬라이드별 근거 배분"에서 지정된 mustUseFacts 중 최소 1개를 body에 반영하세요.
- 리서치 브리프의 "주의할 표현"에 걸리는 치료 효과, 질병 예방, 검증되지 않은 수치, 주제와 무관한 시사/경제 정보는 쓰지 마세요.
- 출처명이나 URL을 카드 본문에 노출하지 말고, 근거에서 얻은 의미만 자연스러운 카피로 바꾸세요.`
    : ''

  const prompt = `${isEnglish ? 'Write English Instagram carousel card copy.' : '한국 인스타그램 카드뉴스 카피를 작성해주세요.'}

${editorialPlanSection}

${domainGuidanceSection}

${storyOntologySection}

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
- headline: 24자 이하, 강렬하고 구체적 (공백 포함). "1.", "2." 같은 숫자 번호로 시작하지 마세요.
- body: 일반 슬라이드는 80~150자, 마무리 슬라이드는 70~120자 권장. 모바일 카드에서 3~5줄 안에 읽히는 완성 문장으로 작성하세요.
- body는 글자수를 억지로 줄이기보다 의미 있는 정보량을 우선하세요. 단, 한 슬라이드에 수치가 너무 많아지면 읽기 어려우므로 핵심 수치 1~2개만 선택하세요.
- body에는 주제의 구체 정보(특징/사용 장면/비교 포인트/주의할 점 중 최소 1개)를 담으세요.
- DOMAIN GUIDANCE는 참고하되, 상품 맥락에 맞는 표현만 자연스럽게 사용하세요.
- DOMAIN GUIDANCE의 금지 표현이나 다른 업종의 표현을 쓰지 마세요.
- "생활 속 선택", "중요한 기준", "반복되는 상황", "선택 이유", "더 오래 기억"처럼 어디에나 붙는 추상 문구를 쓰지 마세요.
- 각 슬라이드는 STORY ONTOLOGY의 의미만 참고하고, guiding question, transition 같은 내부 기획 용어는 절대 카피에 쓰지 마세요.
- body는 한 슬라이드 안에서 독자가 이해할 수 있는 구체 정보, 이유, 실천 기준을 함께 담되, 과도하게 길면 다음 슬라이드와 역할을 나눠 전개하세요.
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요. 문장을 줄여야 하면 중간을 자르지 말고 완성 문장 단위로 다시 작성하세요.${rssInstruction}
- 전체 흐름은 관심 유도 → 이해/근거 → 핵심 가치 → 정리 또는 행동 촉구 순서로 이어져야 하며, 같은 정보를 반복하지 마세요
- 각 슬라이드는 지정된 역할과 기획 단서를 발전시키되 앞뒤 슬라이드와 자연스럽게 연결하세요
- hook 슬라이드: 독자의 시선을 즉시 잡되 사실로 확인되지 않은 효과를 단정하지 마세요
- stat 슬라이드: 제공된 사실 및 기획 자료에 있는 수치만 사용하세요
- save-cta / summary 슬라이드: 핵심 내용을 짧게 정리한 뒤 "저장", "확인", "체크", "비교" 중 하나의 행동을 반드시 포함하세요
- 제공된 사실 및 브랜드 DNA에 없는 수치, 할인율, 순위, 인증, 성분, 후기, 성능 또는 효능을 새로 만들지 마세요
- 자료가 부족하면 검증 가능한 특징을 단정하지 말고 주제와 브랜드 관점 중심으로 표현하세요
- 금지어·과장표현(혁신적인, 최고의, 완벽한) 사용 금지
- 캠페인 목표는 카피의 방향성으로만 사용하고, 목표 문구 자체를 카피에 쓰지 마세요${researchInstruction}
- ${languageRule}
- "daily use scene", "mirror audience life", "one defining object", "imagePurpose", "guiding question", "STORY ONTOLOGY", "visualDirection" 같은 영어 기획 토큰은 절대 출력하지 마세요.

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
      diagnostics: {
        userId: input.userId,
        brandId: input.brandId,
        metadata: {
          language: input.language,
          generationMode: input.generationMode,
          topic: input.topic,
          slideCount: slides.length,
        },
      },
    }
  )

  const generatedSlides = Array.isArray(result?.slides) ? result.slides : []
  const copyMap = new Map(generatedSlides.map(s => [s.slideNumber, s]))
  const groundingText = `${input.topic}\n${input.title}\n${input.keyContent}`

  const repairedSlides = slides.map(slide => {
    const generated = copyMap.get(slide.slideNumber)
    if (typeof generated?.headline !== 'string' || !generated.headline.trim()) return slide
    const body = typeof generated.body === 'string' ? generated.body.trim() : slide.body
    if (hasUnsupportedNumericClaim(`${generated.headline} ${body}`, groundingText)) return slide
    const contract = getCardHarnessContract(slide.role)
    const repaired = repairRenderableCopy({
      headline: generated.headline.trim(),
      body,
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    const harnessed = repairCopyToHarness({
      topic: input.topic,
      role: slide.role,
      headline: repaired.headline || slide.headline,
      body: repaired.body || slide.body,
    })
    return {
      ...slide,
      headline: harnessed.headline,
      body: harnessed.body,
    }
  })

  return enforceSemanticMeaning({
    input,
    slides: repairedSlides,
    editorialPlan,
    domainProfile,
    sourceMaterial,
    systemPrompt,
    storyOntologySection,
  })
}

async function enforceSemanticMeaning(params: {
  input: MediaCarouselInput
  slides: MediaSlidePlan[]
  editorialPlan: EditorialDirectorPlan
  domainProfile: DomainProfile
  sourceMaterial: string
  systemPrompt: string
  storyOntologySection: string
}): Promise<MediaSlidePlan[]> {
  const initialReport = evaluateSemanticCopy({
    topic: params.input.topic,
    language: params.input.language,
    domainProfile: params.domainProfile,
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
  const isEnglish = params.input.language === 'en'
  const reviewPrompt = isEnglish
    ? `Rewrite only the weak Instagram carousel slides below.

Topic: ${params.input.topic}
Goal: ${params.input.objective || params.input.contentType}

Source material:
${params.sourceMaterial || 'No additional source material.'}

${params.storyOntologySection}

Weak slides and issues:
${weakSlides.map(slide => {
  const issues = initialReport.issues.filter(issue => issue.slideNumber === slide.slideNumber).map(issue => issue.message).join(' / ')
  return `Slide ${slide.slideNumber} [${slide.role}]
headline: ${slide.headline}
body: ${slide.body}
issues: ${issues}`
}).join('\n\n')}

Rewrite rules:
- Body copy must complete one useful meaning, not merely sound like a sentence.
- Do not end with an open setup such as "because", "the reason is", "more", or a dangling comparison.
- Each slide must add a concrete fact, reason, use case, caution, or action.
- Never include news, stock, politics, or unrelated trend information unless the user topic explicitly asks for it.
- Keep headline under 25 characters when possible. Never start a headline with a number like "1.", "2.", etc.
- Body should normally be 80-150 characters, closing slides 70-120 characters, and must fit 3-5 mobile-readable lines.
- Do not use planning tokens or internal terms in card copy.
- Write all output in English.

Return JSON only:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "..." }
  ]
}`
    : `다음 카드뉴스 슬라이드 중 의미가 완성되지 않은 본문만 다시 작성하세요.

주제: ${params.input.topic}
목표: ${params.input.objective || params.input.contentType}

제공 자료:
${params.sourceMaterial || '추가 자료 없음'}

${params.storyOntologySection}

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
- headline은 필요할 때만 다듬고 25자 이하로 유지하세요. "1.", "2." 같은 숫자 번호로 시작하지 마세요.
- body는 일반 슬라이드 80~150자, 마무리 슬라이드 70~120자를 권장합니다. 모바일 카드에서 3~5줄 안에 읽히는 완성 문장으로 작성하세요.
- 각 body에는 주제의 구체 기준, 이유, 실제 행동 중 최소 2개를 자연스럽게 연결하세요.
- 영어 기획 토큰이나 내부 계획 용어를 본문에 쓰지 마세요.

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
      systemPrompt: `${params.systemPrompt}\n${isEnglish ? 'You are an English social carousel editorial desk. Judge whether each slide completes a useful meaning and rewrite weak slides. Return JSON only.' : '당신은 의미 완성성을 검수하는 한국 SNS 에디토리얼 데스크입니다. 문장 어미가 아니라 슬라이드가 실제로 하나의 의미를 완성했는지 판단하고 재작성합니다. JSON으로만 응답하세요.'}`,
      diagnostics: {
        userId: params.input.userId,
        brandId: params.input.brandId,
        metadata: { language: params.input.language, weakSlideCount: weakSlides.length },
      },
    }
  )

  const rewriteMap = new Map((Array.isArray(result?.slides) ? result.slides : []).map(slide => [slide.slideNumber, slide]))
  const nextSlides = params.slides.map(slide => {
    if (!weakSlideNumbers.has(slide.slideNumber)) return slide
    const rewritten = rewriteMap.get(slide.slideNumber)
    const contract = getCardHarnessContract(slide.role)
    const repaired = repairRenderableCopy({
      headline: rewritten?.headline?.trim() || slide.headline,
      body: rewritten?.body?.trim() || slide.body,
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    const harnessed = repairCopyToHarness({
      topic: params.input.topic,
      role: slide.role,
      headline: repaired.headline || slide.headline,
      body: repaired.body || slide.body,
    })
    return {
      ...slide,
      headline: harnessed.headline,
      body: harnessed.body,
    }
  })

  const finalReport = evaluateSemanticCopy({
    topic: params.input.topic,
    language: params.input.language,
    domainProfile: params.domainProfile,
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
    const contract = getCardHarnessContract(slide.role)
    const repaired = repairRenderableCopy({
      headline: slide.headline,
      body: slide.body,
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    const harnessed = repairCopyToHarness({
      topic: params.input.topic,
      role: slide.role,
      headline: repaired.headline,
      body: repaired.body,
    })
    return { ...slide, headline: harnessed.headline, body: harnessed.body }
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

function maxRenderableBodyLines(role: MediaSlideRole | string | undefined) {
  return getCardHarnessContract(role).maxBodyLines
}

function enforceHarnessCopy(input: MediaCarouselInput, slides: MediaSlidePlan[]): MediaSlidePlan[] {
  return slides.map(slide => {
    const repaired = repairCopyToHarness({
      topic: input.topic,
      role: slide.role,
      headline: slide.headline,
      body: slide.body,
    })
    return {
      ...slide,
      headline: repaired.headline,
      body: repaired.body,
    }
  })
}

function enforceHarnessAgentCopy(input: MediaCarouselInput, slides: AgentSlideData[]): AgentSlideData[] {
  return slides.map(slide => {
    const repaired = repairCopyToHarness({
      topic: input.topic,
      role: slide.role,
      headline: slide.headline,
      body: slide.body,
    })
    return {
      ...slide,
      headline: repaired.headline,
      body: repaired.body,
    }
  })
}

// Detects words repeated 3+ times across all slides and replaces
// overused words in later slides with a contextual synonym.
const WORD_SYNONYMS: Record<string, string[]> = {
  '시작': ['출발', '첫걸음', '첫 단계', '전환'],
  '확인': ['점검', '체크', '살펴보기', '검토'],
  '중요': ['핵심', '필수', '결정적', '관건'],
  '기준': ['원칙', '기본', '조건', '포인트'],
  '방법': ['방식', '전략', '접근법', '노하우'],
}

function suppressWordOveruse(slides: AgentSlideData[]): AgentSlideData[] {
  const wordCount: Record<string, number> = {}
  // count occurrences across all slides
  for (const slide of slides) {
    const text = `${slide.headline} ${slide.body}`
    for (const word of Object.keys(WORD_SYNONYMS)) {
      const count = (text.match(new RegExp(word, 'g')) || []).length
      wordCount[word] = (wordCount[word] || 0) + count
    }
  }

  // only act on words appearing 3+ times
  const overused = Object.entries(wordCount).filter(([, count]) => count >= 3).map(([word]) => word)
  if (overused.length === 0) return slides

  // for each overused word, keep it in the first 2 occurrences, replace the rest
  const seen: Record<string, number> = {}
  return slides.map(slide => {
    let headline = slide.headline
    let body = slide.body
    for (const word of overused) {
      seen[word] = seen[word] || 0
      const occurrencesInSlide = ((`${headline} ${body}`).match(new RegExp(word, 'g')) || []).length
      if (occurrencesInSlide === 0) continue
      seen[word] += occurrencesInSlide
      // replace only if this slide pushes us past 2 total occurrences
      if (seen[word] > 2) {
        const synonyms = WORD_SYNONYMS[word] || []
        const synonym = synonyms[(seen[word] - 3) % synonyms.length]
        if (synonym) {
          headline = headline.replaceAll(word, synonym)
          body = body.replaceAll(word, synonym)
        }
      }
    }
    return { ...slide, headline, body }
  })
}

function runFinalSemanticCopyGuard(params: {
  input: MediaCarouselInput
  slides: AgentSlideData[]
  editorialPlan: EditorialDirectorPlan
  domainProfile: DomainProfile
}): { slides: AgentSlideData[]; logs: AgentReportItem[] } {
  const report = evaluateSemanticCopy({
    topic: params.input.topic,
    language: params.input.language,
    domainProfile: params.domainProfile,
    slides: params.slides.map(slide => ({
      slideNumber: slide.slideNumber,
      role: slide.role,
      headline: slide.headline,
      body: slide.body,
    })),
  })
  const weakSlideNumbers = new Set(report.issues.filter(issue => issue.severity === 'block').map(issue => issue.slideNumber))
  if (weakSlideNumbers.size === 0) {
    return {
      slides: params.slides,
      logs: [{
        agentName: 'SemanticCopyGuard',
        role: 'final-copy-quality',
        status: 'success',
        message: 'Final slide copy passed semantic quality guard before rendering.',
        details: { issueCount: report.issues.length },
        timestamp: new Date().toISOString(),
      }],
    }
  }

  const slides = params.slides.map(slide => {
    if (!weakSlideNumbers.has(slide.slideNumber)) return slide
    const contract = getCardHarnessContract(slide.role)
    const repaired = repairRenderableCopy({
      headline: slide.headline,
      body: slide.body,
      constraints: {
        maxHeadlineChars: contract.maxHeadlineChars,
        maxBodyChars: contract.maxBodyChars,
        maxBodyLines: contract.maxBodyLines,
        lineLength: contract.lineLength,
      },
    })
    const harnessed = repairCopyToHarness({
      topic: params.input.topic,
      role: slide.role,
      headline: repaired.headline,
      body: repaired.body,
    })
    return {
      ...slide,
      headline: harnessed.headline,
      body: harnessed.body,
    }
  })

  return {
    slides,
    logs: [{
      agentName: 'SemanticCopyGuard',
      role: 'final-copy-quality',
      status: 'warn',
      message: `Final semantic guard repaired ${weakSlideNumbers.size} weak slide copy block(s) before rendering.`,
      details: report.issues,
      timestamp: new Date().toISOString(),
    }],
  }
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
  const ontology = buildStoryOntology({
    topic: input.topic,
    category: input.category,
    sourceMaterial: input.keyContent,
    editorialPlan,
  })
  return editorialPlan.slides.map((slidePlan, index) => {
    const item = parsed[index] || parsed[index - 1] || parsed[0]
    const storyNode = getStoryNode(ontology, slidePlan.slideNumber)
    const headline = slidePlan.role === 'hook'
      ? input.briefing?.hookDirection || input.title || item?.headline || input.topic
      : item?.headline || input.topic
    const body = slidePlan.role === 'save-cta'
      ? input.briefing?.recommendedCta || input.brandCtaStyle || summarize(input.keyContent, 140)
      : item?.body || slidePlan.briefingInstruction || ontologyFallbackBody(input.topic, storyNode)
    return {
      slideNumber: slidePlan.slideNumber,
      role: slidePlan.role,
      ...repairRenderableCopy({
        headline: trimHeadline(headline),
        body,
        constraints: {
          maxHeadlineChars: slidePlan.copyConstraints.maxHeadlineChars,
          maxBodyChars: slidePlan.copyConstraints.maxBodyChars,
          maxBodyLines: maxRenderableBodyLines(slidePlan.role),
          lineLength: 24,
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
    .replace(/^\d+\.\s*/, '')
    .trim()
    .slice(0, 34)
}

function summarize(value: string, maxLength: number) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength).replace(/\s+\S*$/, '')}.`
}

function ontologyFallbackBody(topic: string, node: ReturnType<typeof getStoryNode>) {
  if (!node) return summarize(topic, 180)
  const signal = node.mustInclude.find(item => item && !/one |specific |reader |only verified/i.test(item)) || topic
  switch (node.role) {
    case 'hook':
      return `${signal}을(를) 그냥 좋다고 말하면 기억에 남지 않습니다. 첫 장에서는 왜 지금 이 주제를 다시 봐야 하는지 한 가지 장면으로 열어야 합니다.`
    case 'context':
      return `${signal}은(는) 독자가 실제로 먹고, 쓰고, 비교하는 순간과 연결될 때 설득력이 생깁니다. 다음 장에서는 그 상황에서 무엇을 먼저 봐야 하는지 좁혀갑니다.`
    case 'key-point':
      return `${signal}을(를) 판단할 때는 장점의 개수보다 먼저 볼 기준이 필요합니다. 이 기준이 잡혀야 뒤의 디테일이 단순 정보가 아니라 선택 근거로 읽힙니다.`
    case 'detail':
    case 'stat':
      return `${signal} 같은 구체 요소가 있어야 본문이 설명에서 멈추지 않습니다. 맛, 성분, 사용 장면, 비교 포인트 중 하나를 붙이면 독자가 바로 판단할 수 있습니다.`
    case 'summary':
    case 'save-cta':
      return `${signal}을(를) 기억할 때는 핵심 장면과 확인 포인트를 같이 남겨두는 편이 좋습니다. 저장해두고 실제로 비교할 때 다시 꺼내보세요.`
    default:
      return `${signal}을(를) 중심으로 구체적인 상황과 판단 포인트를 함께 보여줘야 합니다. 그래야 슬라이드가 따로 놀지 않고 다음 이야기로 이어집니다.`
  }
}

function toMediaLayout(layoutType: LayoutType): LayoutType {
  if (layoutType === 'minimal-clean' || layoutType === 'quote-focus') return 'dark-editorial'
  return layoutType
}

async function generateCaption(input: MediaCarouselInput, slides: MediaSlidePlan[]): Promise<string> {
  const isEn = input.language === 'en'
  const slidesSummary = slides
    .slice(0, 5)
    .map(s => `${s.slideNumber}. ${s.headline}`)
    .join('\n')

  const prompt = isEn
    ? `You are a professional Instagram content writer. Write a natural, conversational Instagram caption for a card news carousel about the following topic.

Topic: ${input.topic}
Brand tone: ${input.brandToneOfVoice || 'warm and approachable'}
Slide headlines:
${slidesSummary}

Rules:
- Write in first or second person, as if talking directly to the reader
- Open with a short, punchy hook sentence (1–2 lines) — NOT the topic title
- 2–4 sentences describing what the carousel covers, written naturally like a person, not a summary
- End with a warm call to action that feels human (save, share, swipe, etc.)
- Total: 4–7 lines. No bullet points. No markdown. Plain text only.
- Do NOT start with the carousel title or topic name as the first word`
    : `당신은 인스타그램 카드뉴스 전문 카피라이터입니다. 아래 카드뉴스 내용을 보고 자연스럽고 대화체에 가까운 인스타그램 캡션을 작성해주세요.

주제: ${input.topic}
브랜드 톤: ${input.brandToneOfVoice || '친근하고 따뜻하게'}
슬라이드 헤드라인:
${slidesSummary}

작성 규칙:
- 독자에게 말을 거는 듯한 1인칭 또는 2인칭 톤으로 작성
- 첫 줄은 주제명 그대로 쓰지 말고, 짧고 임팩트 있는 훅 문장으로 시작
- 카드뉴스에서 다루는 내용을 2~4문장으로 자연스럽게 소개 (딱딱한 요약 X, 대화하듯 서술)
- 마지막에 저장, 공유, 스와이프 등 따뜻하고 자연스러운 행동 유도로 마무리
- 전체 4~7줄. 불릿 포인트 없음. 마크다운 없음. 순수 텍스트만.
- 첫 단어로 주제명이나 카드뉴스 제목을 그대로 쓰지 말 것`

  const client = getLLMClient()
  try {
    const result = await client.generateJson<{ caption: string }>(
      'instagram caption generation',
      prompt + '\n\nRespond with JSON: { "caption": "<the caption text>" }',
      () => ({ caption: fallbackCaption(input, slides, isEn) }),
      {
        model: getCopywritingModel(),
        temperature: 0.7,
        diagnostics: {
          userId: input.userId,
          brandId: input.brandId,
          metadata: { language: input.language, topic: input.topic, slideCount: slides.length },
        },
      }
    )
    return result?.caption?.trim() && result.caption.trim().length > 20
      ? result.caption.trim()
      : fallbackCaption(input, slides, isEn)
  } catch {
    return fallbackCaption(input, slides, isEn)
  }
}

function fallbackCaption(input: MediaCarouselInput, slides: MediaSlidePlan[], isEn: boolean): string {
  const hook = slides[0]?.headline || input.topic
  if (isEn) {
    return `${hook}\n\nSwipe through to get the full picture — we broke it down into ${slides.length} slides so it's easy to follow.\n\nSave this for later 🔖`
  }
  return `${hook}\n\n${slides.length}장으로 정리해봤어요. 스와이프하면서 한 번에 읽어보세요.\n\n나중에 다시 보고 싶으면 저장해두세요 🔖`
}

function buildHashtags(input: MediaCarouselInput) {
  const normalized = [input.category, input.topic, input.contentType]
    .flatMap(item => item.split(/\s+/))
    .map(item => item.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .slice(0, 6)
  const defaults = input.language === 'en'
    ? ['cardnews', 'instagramcontent', 'contentautomation']
    : ['카드뉴스', '인스타그램콘텐츠', '콘텐츠자동화']
  return Array.from(new Set([...defaults, ...normalized])).map(tag => `#${tag}`)
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
