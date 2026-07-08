export type StrategyType =
  | 'problem_solution'
  | 'benefit_focused'
  | 'comparison'
  | 'review_style'
  | 'checklist'
  | 'seasonal'
  | 'discount'
  | 'storytelling'

export type HookType = 'curiosity' | 'pain_point' | 'benefit' | 'urgency' | 'comparison' | 'social_proof'

export type SlideRole =
  | 'hook'
  | 'problem'
  | 'cause'
  | 'common_mistake'
  | 'product_solution'
  | 'feature'
  | 'feature_1'
  | 'feature_2'
  | 'benefit_or_proof'
  | 'proof'
  | 'offer'
  | 'cta'

export type TextPosition = 'top' | 'center' | 'bottom'

export type OverlayType =
  | 'dark_gradient_bottom'
  | 'dark_gradient_top'
  | 'dark_gradient_center'
  | 'cinematic_dark'
  | 'blur_glass'
  | 'radial_focus'
  | 'none'

export interface BrandProfile {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
}

export interface CampaignInput {
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
  slideCount: number
  productImageUrls: string[]
}

export interface ContentStrategy {
  strategyType: StrategyType
  targetEmotion: string
  contentGoal: string
  angle: string
  recommendedSlideCount: number
  reason: string
}

export interface HookCandidate {
  text: string
  type: HookType
  score: number
  reason: string
  // True when the LLM call failed and this hook came from the canned fallback list
  usedFallback?: boolean
}

export interface CarouselStructure {
  slides: {
    slideNumber: number
    role: SlideRole
    purpose: string
  }[]
}

export interface SlideCopy {
  slideNumber: number
  headline: string
  body: string
  ctaText?: string
  // True when the LLM call failed and canned fallback copy was used for this slide
  usedFallback?: boolean
}

export interface SlideDesignPrompt {
  slideNumber: number
  backgroundPrompt: string
  layoutStyle: string
  textPosition: TextPosition
  overlayType: OverlayType
  overlayStrength: number  // 0-100
  visualMood: string
}

export interface GeneratedSlide {
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
  backgroundImageUrl: string
  finalImageUrl: string
}

export interface CaptionResult {
  caption: string
  hashtags: string[]
  recommendedPostTime: string
}

export interface QualityCheckResult {
  passed: boolean
  issues: string[]
  suggestions: string[]
}

export interface CarouselGenerationResult {
  title: string
  strategy: ContentStrategy
  hooks: HookCandidate[]
  selectedHook: HookCandidate
  structure: CarouselStructure
  slides: GeneratedSlide[]
  caption: string
  hashtags: string[]
  recommendedPostTime: string
  qualityCheck: QualityCheckResult
}

export interface CarouselPipelineResult extends CarouselGenerationResult {
  campaignId: string
  postId: string
  status: 'pending_approval' | 'needs_review'
  logs: string[]
}
