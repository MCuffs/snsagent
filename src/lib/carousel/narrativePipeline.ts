import type { BrandProfile, CampaignInput, CarouselStructure, SlideCopy, SlideDesignPrompt } from './types'
import type { ContentStrategy, HookCandidate } from './types'
import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import type { CopyQualityReport } from '../copywriting/copyQualityChecker'
import { createNarrativeMemory } from './narrativeMemory'
import { buildEmotionalArc } from './agents/storyPlanningAgent'
import { runDirectorAgent } from './agents/directorAgent'
import { runSlideChainAgent } from './agents/slideChainAgent'
import { runCriticAgent } from './agents/criticAgent'
import { runRegenerationLoop } from './agents/regenerationLoop'
import { runVisualDirectorAgent } from './agents/visualDirectorAgent'
import { runBrandConsistencyAgent } from './agents/brandConsistencyAgent'

export interface NarrativePipelineResult {
  copies: SlideCopy[]
  designPrompts: SlideDesignPrompt[]
  copyQualityReport: CopyQualityReport | null
}

export async function runNarrativePipeline(params: {
  brand: BrandProfile
  input: CampaignInput
  strategy: ContentStrategy
  knowledgeCtx: CopyKnowledgeContext
  selectedHook: HookCandidate
  structure: CarouselStructure
}): Promise<NarrativePipelineResult> {
  const memory = createNarrativeMemory(params)

  // 1. Director: plan the narrative arc per slide
  console.log('[NarrativePipeline] DirectorAgent starting...')
  memory.slidePlan = await runDirectorAgent(memory)

  // 2. StoryPlanning: build emotional arc (rules-based)
  memory.emotionalArc = buildEmotionalArc(memory)
  console.log('[NarrativePipeline] EmotionalArc built')

  // 3. SlideChain: generate each slide sequentially
  console.log('[NarrativePipeline] SlideChainAgent starting...')
  await runSlideChainAgent(memory)

  // 4. BrandConsistency: clean forbidden words, normalize
  memory.completedSlides = runBrandConsistencyAgent(memory)
  console.log('[NarrativePipeline] BrandConsistencyAgent done')

  // 5. Critic: score and identify weak slides
  let criticResult = runCriticAgent(memory)

  // 6. RegenerationLoop: regenerate weak slides (max 2 retries)
  if (criticResult.weakSlides.length > 0) {
    console.log(`[NarrativePipeline] RegenerationLoop: ${criticResult.weakSlides.length} weak slides`)
    criticResult = await runRegenerationLoop(memory, criticResult)
  }

  // 7. VisualDirector: generate design prompts with visual diversity
  console.log('[NarrativePipeline] VisualDirectorAgent starting...')
  const designPrompts = await runVisualDirectorAgent(memory)

  // Convert completedSlides back to SlideCopy[]
  const copies: SlideCopy[] = memory.completedSlides.map(s => ({
    slideNumber: s.slideNumber,
    headline: s.headline,
    body: s.body,
    ctaText: s.role === 'cta' ? (params.brand.ctaStyle || '자세히 보기') : undefined,
  }))

  console.log(`[NarrativePipeline] done. slides=${copies.length} score=${criticResult.report.score}`)

  return {
    copies,
    designPrompts,
    copyQualityReport: criticResult.report,
  }
}
