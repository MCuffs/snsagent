import type { BrandProfile, CampaignInput, CarouselStructure, ContentStrategy, HookCandidate, SlideRole } from './types'
import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'

// ─── Core Types ───────────────────────────────────────────────────────────────

export type EmotionType =
  | 'curiosity'
  | 'empathy'
  | 'tension'
  | 'insight'
  | 'relief'
  | 'aspiration'
  | 'conversion'

export interface SlidePlan {
  slideNumber: number
  role: SlideRole
  emotionalGoal: string
  narrativePurpose: string
  forbidConcepts: string[]
}

export interface EmotionalBeat {
  slideNumber: number
  emotion: EmotionType
  intensity: number       // 1-10
  transitionHint: string
}

export interface CompletedSlide {
  slideNumber: number
  role: SlideRole
  headline: string
  body: string
}

export interface NarrativeMemory {
  brand: BrandProfile
  input: CampaignInput
  strategy: ContentStrategy
  knowledgeCtx: CopyKnowledgeContext
  selectedHook: HookCandidate
  structure: CarouselStructure

  slidePlan: SlidePlan[]
  emotionalArc: EmotionalBeat[]
  completedSlides: CompletedSlide[]

  usedKeywords: Set<string>
  usedHeadlineOpeners: Set<string>
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createNarrativeMemory(params: {
  brand: BrandProfile
  input: CampaignInput
  strategy: ContentStrategy
  knowledgeCtx: CopyKnowledgeContext
  selectedHook: HookCandidate
  structure: CarouselStructure
}): NarrativeMemory {
  return {
    ...params,
    slidePlan: [],
    emotionalArc: [],
    completedSlides: [],
    usedKeywords: new Set(),
    usedHeadlineOpeners: new Set(),
  }
}

export function appendCompletedSlide(memory: NarrativeMemory, slide: CompletedSlide): void {
  memory.completedSlides.push(slide)
  // Track headline opener (first 3 chars) for dedup
  const opener = slide.headline.slice(0, 3).trim()
  if (opener.length > 0) memory.usedHeadlineOpeners.add(opener)
  // Track keywords from headline and body
  const words = `${slide.headline} ${slide.body}`.split(/\s+/).filter(w => w.length > 2)
  words.forEach(w => memory.usedKeywords.add(w))
}
