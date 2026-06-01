import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import type { LayoutType } from '../layout/layoutTypes'

export type EditorialSlideRole =
  | 'hook'
  | 'context'
  | 'key-point'
  | 'detail'
  | 'stat'
  | 'summary'
  | 'save-cta'

export interface EditorialBriefing {
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  structurePreview?: Array<{ slideNumber: number; role: string; description: string }>
}

export interface PersonalizationMemory {
  summary: string | null
  preferredHookPatterns: string | null
  preferredLayouts: string | null
  avoidPatterns: string | null
  preferredCopyTone: string | null
}

export interface EditorialDirectorInput {
  productName: string
  sourceMaterial: string
  category: string
  objective: string
  contentType: string
  tone: string
  brandName: string
  targetAudience: string
  brandCtaStyle?: string
  slideCount: number
  baseLayoutType: LayoutType
  briefing?: EditorialBriefing
  memory?: PersonalizationMemory | null
  knowledgeContext: CopyKnowledgeContext
}

export interface ProductAnalysis {
  category: string
  target: string
  pricingPositioning: string
  emotionalKeywords: string[]
  painPoints: string[]
  useCases: string[]
  competitors: string[]
  desiredEmotions: string[]
  buyingTriggers: string[]
  saveSharePotential: string
  viralAngles: string[]
}

export interface AudiencePsychology {
  hookPreference: string
  ctaPreference: string
  preferredTone: string
  attentionPattern: string
  stopScrollReason: string
}

export interface CarouselStrategyPlan {
  goal: string
  contentStyle: string
  emotionCurve: string[]
  ctaStyle: string
  retentionMechanism: string
  saveShareMechanism: string
}

export interface EditorialVisualDirection {
  focus: string
  composition: string
  textDominance: 'high' | 'balanced' | 'low'
  whitespaceRatio: 'high' | 'medium' | 'low'
  mood: string
  imagePurpose: string
}

export interface EditorialSlidePlan {
  slideNumber: number
  role: EditorialSlideRole
  purpose: string
  emotionalGoal: string
  expectedAction: string
  copyConstraints: {
    maxHeadlineChars: number
    maxBodyChars: number
    style: string
    avoid: string[]
  }
  visualDirection: EditorialVisualDirection
  layoutType: LayoutType
  briefingInstruction?: string
}

export interface EditorialDirectorPlan {
  version: 'editorial-director-v1'
  productAnalysis: ProductAnalysis
  audiencePsychology: AudiencePsychology
  carouselStrategy: CarouselStrategyPlan
  slides: EditorialSlidePlan[]
  personalization: {
    applied: boolean
    summary: string
    preferredCopyTone: string | null
  }
}

export interface EditorialQualityIssue {
  severity: 'block' | 'warn'
  dimension:
    | 'strategy_alignment'
    | 'narrative_coherence'
    | 'emotional_progression'
    | 'swipe_motivation'
    | 'cta_quality'
    | 'redundancy'
    | 'visual_rhythm'
    | 'tone_consistency'
  message: string
}

export interface EditorialQualityReport {
  passed: boolean
  score: number
  narrativeFlowScore: number
  personaFitScore: number
  hookPatternScore: number
  issues: EditorialQualityIssue[]
}

interface EvaluatedSlide {
  slideNumber: number
  role: EditorialSlideRole
  layoutType: LayoutType
  headline: string
  body: string
}

const ROLE_SEQUENCE: EditorialSlideRole[] = [
  'hook',
  'context',
  'key-point',
  'detail',
  'stat',
  'detail',
  'summary',
  'save-cta',
]

const EMOTION_SEQUENCE = [
  'curiosity',
  'recognition',
  'tension',
  'insight',
  'trust',
  'desire',
  'resolution',
  'action',
]

const GENERIC_TERMS = [
  'premium',
  'special',
  'natural',
  'healthy',
  '\uD504\uB9AC\uBBF8\uC5C4',
  '\uD2B9\uBCC4\uD55C',
  '\uC790\uC5F0\uC2A4\uB7EC\uC6B4',
  '\uAC74\uAC15\uD55C',
]

export function buildEditorialDirectorPlan(input: EditorialDirectorInput): EditorialDirectorPlan {
  const memorySummary = input.memory?.summary?.trim() || ''
  const desiredEmotion = input.briefing?.targetEmotion?.trim() || input.knowledgeContext.emotionalIntentProfile.intent
  const roleSequence = deriveRoleSequence(input)
  const emotionCurve = roleSequence.map((role, index) => emotionalGoalForRole(role, index, roleSequence.length))
  const preferredLayout = extractPreferredLayout(input.memory?.preferredLayouts)

  const productAnalysis: ProductAnalysis = {
    category: input.category || input.contentType,
    target: input.targetAudience || 'social-first prospective customers',
    pricingPositioning: inferPricingPositioning(input.sourceMaterial),
    emotionalKeywords: unique([desiredEmotion, input.tone, 'trust', 'relevance']).slice(0, 4),
    painPoints: buildPainPoints(input),
    useCases: [
      `${input.targetAudience || 'audience'} discovering ${input.productName}`,
      `${input.productName} considered in a daily routine`,
    ],
    competitors: [`other ${input.category} alternatives`],
    desiredEmotions: unique([desiredEmotion, input.tone, 'trust', 'relevance']).slice(0, 4),
    buyingTriggers: unique([
      input.objective,
      input.briefing?.recommendedCta || '',
      'clear everyday use case',
    ]).slice(0, 3),
    saveSharePotential: inferSaveSharePotential(input.objective, input.contentType),
    viralAngles: unique([
      input.briefing?.hookDirection || '',
      `${input.targetAudience || 'audience'} routine`,
      `${input.category} decision guide`,
    ]).slice(0, 3),
  }

  const audiencePsychology: AudiencePsychology = {
    hookPreference: input.briefing?.hookDirection || `${input.knowledgeContext.emotionalIntentProfile.intent} + relevance`,
    ctaPreference: input.briefing?.recommendedCta || input.brandCtaStyle || 'soft save-first action',
    preferredTone: input.memory?.preferredCopyTone || input.tone || input.knowledgeContext.personaProfile.copyToneHints[0],
    attentionPattern: 'short headline followed by one concrete reason to swipe',
    stopScrollReason: productAnalysis.painPoints[0] || `${input.category} decision tension`,
  }

  const carouselStrategy: CarouselStrategyPlan = {
    goal: input.objective || 'save/share optimized',
    contentStyle: input.contentType || 'editorial',
    emotionCurve,
    ctaStyle: audiencePsychology.ctaPreference,
    retentionMechanism: 'each slide resolves one question and opens the next',
    saveShareMechanism: 'finish with reusable guidance or a decision cue worth saving',
  }

  return {
    version: 'editorial-director-v1',
    productAnalysis,
    audiencePsychology,
    carouselStrategy,
    slides: roleSequence.map((role, index) => buildSlidePlan({
      role,
      slideNumber: index + 1,
      emotionalGoal: emotionCurve[index],
      input,
      preferredLayout,
    })),
    personalization: {
      applied: Boolean(memorySummary || input.memory?.preferredCopyTone || preferredLayout),
      summary: memorySummary,
      preferredCopyTone: input.memory?.preferredCopyTone || null,
    },
  }
}

export function formatEditorialPlanForPrompt(plan: EditorialDirectorPlan) {
  const slideLines = plan.slides.map(slide =>
    `Slide ${slide.slideNumber} [${slide.role}] purpose=${slide.purpose}; emotion=${slide.emotionalGoal}; next_action=${slide.expectedAction}; headline<=${slide.copyConstraints.maxHeadlineChars}; body<=${slide.copyConstraints.maxBodyChars}; style=${slide.copyConstraints.style}; visual=${slide.visualDirection.focus}/${slide.visualDirection.composition}; layout=${slide.layoutType}`
  )

  return [
    'EDITORIAL DIRECTOR PLAN (mandatory; do not ignore):',
    `Product category: ${plan.productAnalysis.category}`,
    `Target audience: ${plan.productAnalysis.target}`,
    `Audience pain points: ${plan.productAnalysis.painPoints.join(' | ')}`,
    `Use cases: ${plan.productAnalysis.useCases.join(' | ')}`,
    `Buying triggers: ${plan.productAnalysis.buyingTriggers.join(' | ')}`,
    `Campaign goal: ${plan.carouselStrategy.goal}`,
    `Emotional progression: ${plan.carouselStrategy.emotionCurve.join(' -> ')}`,
    `Hook psychology: ${plan.audiencePsychology.hookPreference}`,
    `CTA direction: ${plan.carouselStrategy.ctaStyle}`,
    `Tone: ${plan.audiencePsychology.preferredTone}`,
    plan.personalization.applied ? `Learned brand memory: ${plan.personalization.summary || plan.personalization.preferredCopyTone}` : '',
    ...slideLines,
    'Every slide must advance the sequence. Do not repeat the same claim or emotional beat.',
  ].filter(Boolean).join('\n')
}

export function evaluateEditorialCarousel(plan: EditorialDirectorPlan, slides: EvaluatedSlide[]): EditorialQualityReport {
  const issues: EditorialQualityIssue[] = []
  const expectedRoles = plan.slides.map(slide => slide.role)
  const actualRoles = slides.map(slide => slide.role)

  if (expectedRoles.some((role, index) => actualRoles[index] !== role)) {
    issues.push({
      severity: 'block',
      dimension: 'strategy_alignment',
      message: 'Rendered slide roles no longer match the approved editorial plan.',
    })
  }

  if (slides[0] && normalize(slides[0].headline).length < 4) {
    issues.push({
      severity: 'block',
      dimension: 'swipe_motivation',
      message: 'The hook is too weak to create a stop-scroll moment.',
    })
  }

  const duplicatePairs = findDuplicateHeadlines(slides)
  if (duplicatePairs.length > 0) {
    issues.push({
      severity: 'block',
      dimension: 'redundancy',
      message: `Repeated slide message detected: ${duplicatePairs.join(', ')}.`,
    })
  }

  const similarPairs = findHighlySimilarSlides(slides)
  if (similarPairs.length > 0) {
    issues.push({
      severity: 'block',
      dimension: 'narrative_coherence',
      message: `Slides repeat substantially the same message: ${similarPairs.join(', ')}.`,
    })
  }

  if (hasFlatEmotionRun(plan.carouselStrategy.emotionCurve)) {
    issues.push({
      severity: 'warn',
      dimension: 'emotional_progression',
      message: 'The emotional curve holds the same beat for too long instead of progressing.',
    })
  }

  if (findMaximumLayoutRun(slides) > 2) {
    issues.push({
      severity: 'warn',
      dimension: 'visual_rhythm',
      message: 'More than two adjacent slides use the same composition rhythm.',
    })
  }

  const genericCount = slides.reduce((count, slide) => {
    const text = `${slide.headline} ${slide.body}`.toLowerCase()
    return count + GENERIC_TERMS.filter(term => text.includes(term.toLowerCase())).length
  }, 0)
  if (genericCount >= 3) {
    issues.push({
      severity: 'warn',
      dimension: 'tone_consistency',
      message: 'Generic value words are repeated without enough contextual storytelling.',
    })
  }

  const lastSlideText = slides.length ? `${slides[slides.length - 1].headline} ${slides[slides.length - 1].body}` : ''
  if (!hasCtaSignal(lastSlideText)) {
    issues.push({
      severity: 'block',
      dimension: 'cta_quality',
      message: 'The closing slide lacks a clear save, share, view, or purchase action.',
    })
  }

  const blockCount = issues.filter(issue => issue.severity === 'block').length
  const warnCount = issues.filter(issue => issue.severity === 'warn').length
  const narrativeFlowScore = clampScore(100 - blockCount * 24 - (actualRoles.length !== expectedRoles.length ? 20 : 0))
  const personaFitScore = clampScore(100 - genericCount * 7 - warnCount * 5)
  const hookPatternScore = clampScore(slides[0]?.headline ? 90 - (slides[0].headline.length > 24 ? 15 : 0) : 0)
  const score = clampScore(Math.round((narrativeFlowScore + personaFitScore + hookPatternScore) / 3) - blockCount * 8)

  return {
    passed: blockCount === 0 && score >= 70,
    score,
    narrativeFlowScore,
    personaFitScore,
    hookPatternScore,
    issues,
  }
}

function buildSlidePlan(params: {
  role: EditorialSlideRole
  slideNumber: number
  emotionalGoal: string
  input: EditorialDirectorInput
  preferredLayout: LayoutType | null
}): EditorialSlidePlan {
  const { role, slideNumber, emotionalGoal, input, preferredLayout } = params
  const purposeByRole: Record<EditorialSlideRole, string> = {
    hook: 'stop scrolling with a relevant unresolved tension',
    context: 'mirror the audience situation and earn empathy',
    'key-point': 'name the central problem or insight',
    detail: 'make the value concrete through a use case or reason',
    stat: 'supply grounded proof only when source material supports it',
    summary: 'resolve the story into a useful takeaway',
    'save-cta': 'turn resolution into a low-friction action',
  }
  const actionByRole: Record<EditorialSlideRole, string> = {
    hook: 'continue_swipe',
    context: 'self_identify',
    'key-point': 'seek_resolution',
    detail: 'evaluate_value',
    stat: 'build_trust',
    summary: 'consider_saving',
    'save-cta': 'save_share_or_convert',
  }
  const visualByRole: Record<EditorialSlideRole, EditorialVisualDirection> = {
    hook: direction('single striking subject', 'cinematic negative-space opener', 'high', 'high', 'tension', 'interrupt scrolling'),
    context: direction('recognizable daily situation', 'documentary scene', 'balanced', 'medium', 'relatable', 'mirror audience life'),
    'key-point': direction('one defining object or contrast', 'focused editorial crop', 'high', 'medium', 'clarity', 'make insight memorable'),
    detail: direction('product in use', 'closer tactile framing', 'balanced', 'medium', 'confidence', 'support practical value'),
    stat: direction('evidence-supporting subject', 'quiet proof frame', 'high', 'high', 'trust', 'support grounded proof'),
    summary: direction('resolved lifestyle moment', 'open calm frame', 'balanced', 'high', 'relief', 'signal closure'),
    'save-cta': direction('minimal branded ending', 'clean closing frame', 'high', 'high', 'satisfaction', 'leave room for action'),
  }

  return {
    slideNumber,
    role,
    purpose: purposeByRole[role],
    emotionalGoal,
    expectedAction: actionByRole[role],
    copyConstraints: {
      maxHeadlineChars: role === 'hook' ? 22 : 25,
      maxBodyChars: role === 'hook' ? 140 : 220,
      style: role === 'save-cta' ? 'soft and actionable' : role === 'hook' ? 'specific and curiosity-led' : 'specific editorial prose',
      avoid: ['generic slogans', 'unsupported claims', 'repeated emotional beat'],
    },
    visualDirection: visualByRole[role],
    layoutType: layoutForRole(role, slideNumber, input.baseLayoutType, preferredLayout),
    briefingInstruction: input.briefing?.structurePreview?.find(slide => slide.slideNumber === slideNumber)?.description,
  }
}

function direction(
  focus: string,
  composition: string,
  textDominance: EditorialVisualDirection['textDominance'],
  whitespaceRatio: EditorialVisualDirection['whitespaceRatio'],
  mood: string,
  imagePurpose: string
): EditorialVisualDirection {
  return { focus, composition, textDominance, whitespaceRatio, mood, imagePurpose }
}

function createRoleSequence(slideCount: number): EditorialSlideRole[] {
  if (slideCount <= 5) return ['hook', 'context', 'key-point', 'summary', 'save-cta']
  if (slideCount === 6) return ['hook', 'context', 'key-point', 'detail', 'summary', 'save-cta']
  if (slideCount === 7) return ['hook', 'context', 'key-point', 'detail', 'stat', 'summary', 'save-cta']
  const roles = [...ROLE_SEQUENCE]
  while (roles.length < slideCount) roles.splice(roles.length - 2, 0, 'detail')
  return roles.slice(0, slideCount)
}

function deriveRoleSequence(input: EditorialDirectorInput) {
  const preview = input.briefing?.structurePreview
  if (!preview || preview.length !== input.slideCount) return createRoleSequence(input.slideCount)
  const roles = preview.map(slide => normalizeBriefingRole(slide.role))
  if (roles.some(role => role === null)) return createRoleSequence(input.slideCount)
  const accepted = roles as EditorialSlideRole[]
  if (accepted[0] !== 'hook' || accepted[accepted.length - 1] !== 'save-cta') {
    return createRoleSequence(input.slideCount)
  }
  return accepted
}

function normalizeBriefingRole(value: string): EditorialSlideRole | null {
  const role = value.toLowerCase().replace(/[\s_-]+/g, '')
  const mapping: Record<string, EditorialSlideRole> = {
    hook: 'hook',
    context: 'context',
    problem: 'key-point',
    insight: 'key-point',
    keypoint: 'key-point',
    detail: 'detail',
    benefit: 'detail',
    proof: 'stat',
    stat: 'stat',
    summary: 'summary',
    cta: 'save-cta',
    savecta: 'save-cta',
  }
  return mapping[role] || null
}

function emotionalGoalForRole(role: EditorialSlideRole, index: number, total: number) {
  if (index === total - 1) return 'action'
  const goalByRole: Record<EditorialSlideRole, string> = {
    hook: 'curiosity',
    context: 'recognition',
    'key-point': 'tension',
    detail: index % 2 === 0 ? 'practical desire' : 'insight',
    stat: 'trust',
    summary: 'resolution',
    'save-cta': 'action',
  }
  return goalByRole[role] || EMOTION_SEQUENCE[Math.min(index, EMOTION_SEQUENCE.length - 1)]
}

function layoutForRole(
  role: EditorialSlideRole,
  slideNumber: number,
  baseLayout: LayoutType,
  preferredLayout: LayoutType | null
): LayoutType {
  if (role === 'hook') return baseLayout === 'minimal-clean' ? 'cinematic-headline' : baseLayout
  if (role === 'stat') return 'stat-highlight'
  if (role === 'save-cta') return 'minimal-clean'
  if (role === 'summary') return preferredLayout || 'magazine'
  if (role === 'context') return 'community-style'
  if (role === 'key-point') return 'dark-editorial'
  return slideNumber % 2 === 0 ? 'magazine' : 'cinematic-headline'
}

function extractPreferredLayout(value?: string | null): LayoutType | null {
  if (!value) return null
  const matches = value.match(/breaking-news|dark-editorial|trend-feed|magazine|minimal-clean|quote-focus|split-comparison|stat-highlight|community-style|cinematic-headline/)
  return (matches?.[0] as LayoutType | undefined) || null
}

function buildPainPoints(input: EditorialDirectorInput) {
  const source = `${input.briefing?.brandAnalysis || ''} ${input.sourceMaterial}`.replace(/\s+/g, ' ').trim()
  const firstSignal = source.slice(0, 100)
  return unique([
    firstSignal || `uncertainty around ${input.productName}`,
    `finding a relevant ${input.category} choice`,
    `deciding whether ${input.productName} fits daily life`,
  ]).slice(0, 3)
}

function inferPricingPositioning(sourceMaterial: string) {
  const source = sourceMaterial.toLowerCase()
  if (/(premium|luxury|\uD504\uB9AC\uBBF8\uC5C4|\uACE0\uAC00)/.test(source)) return 'premium'
  if (/(discount|sale|\uD560\uC778|\uAC00\uC131\uBE44)/.test(source)) return 'value'
  return 'unspecified; avoid price claims'
}

function inferSaveSharePotential(objective: string, contentType: string) {
  const text = `${objective} ${contentType}`.toLowerCase()
  if (/(guide|check|tip|save|\uC815\uBCF4|\uC800\uC7A5|\uAC00\uC774\uB4DC)/.test(text)) return 'high: package practical takeaways for saving'
  return 'medium: close with a shareable decision cue'
}

function unique(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean)))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function findDuplicateHeadlines(slides: EvaluatedSlide[]) {
  const seen = new Map<string, number>()
  const duplicates: string[] = []
  for (const slide of slides) {
    const key = normalize(slide.headline)
    if (!key) continue
    const first = seen.get(key)
    if (first) duplicates.push(`${first}/${slide.slideNumber}`)
    else seen.set(key, slide.slideNumber)
  }
  return duplicates
}

function findHighlySimilarSlides(slides: EvaluatedSlide[]) {
  const matches: string[] = []
  for (let left = 0; left < slides.length; left += 1) {
    for (let right = left + 1; right < slides.length; right += 1) {
      const score = messageSimilarity(slides[left], slides[right])
      if (score >= 0.7) matches.push(`${slides[left].slideNumber}/${slides[right].slideNumber}`)
    }
  }
  return matches
}

function messageSimilarity(left: EvaluatedSlide, right: EvaluatedSlide) {
  const leftTokens = tokenize(`${left.headline} ${left.body}`)
  const rightTokens = tokenize(`${right.headline} ${right.body}`)
  if (leftTokens.size < 2 || rightTokens.size < 2) return 0
  const overlap = Array.from(leftTokens).filter(token => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union ? overlap / union : 0
}

function tokenize(value: string) {
  return new Set(
    value.toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map(token => token.trim())
      .filter(token => token.length >= 2)
  )
}

function hasFlatEmotionRun(curve: string[]) {
  let run = 1
  for (let index = 1; index < curve.length; index += 1) {
    run = curve[index] === curve[index - 1] ? run + 1 : 1
    if (run >= 3) return true
  }
  return false
}

function findMaximumLayoutRun(slides: EvaluatedSlide[]) {
  let max = 0
  let run = 0
  let previous: LayoutType | null = null
  for (const slide of slides) {
    run = slide.layoutType === previous ? run + 1 : 1
    max = Math.max(max, run)
    previous = slide.layoutType
  }
  return max
}

function hasCtaSignal(value: string) {
  return /(save|share|view|learn|shop|buy|link|contact|\uC800\uC7A5|\uACF5\uC720|\uBCF4\uAE30|\uD655\uC778|\uAD6C\uB9E4|\uB9C1\uD06C|\uBB38\uC758)/i.test(value)
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}
