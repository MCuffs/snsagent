/**
 * Media Narrative Adapter
 *
 * Bridges the media carousel pipeline with the narrative pipeline's
 * post-processing agents. Replaces the old rule-based agents
 * (BrandIdentityAgent, CopywritingAgent, VisualConceptAgent) with
 * narrative pipeline agents (BrandConsistencyAgent, CriticAgent).
 *
 * The copy generation (generateMediaSlideCopies) is NOT replaced —
 * only the post-processing agents that clean, normalize, and quality-check
 * the generated copy are swapped.
 *
 * On failure, falls back to the original slides unchanged (no quality impact).
 */

import type {
  BrandProfile,
  CampaignInput,
  ContentStrategy,
  HookCandidate,
  CarouselStructure,
  SlideRole,
} from './types'
import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import type { CopyQualityReport } from '../copywriting/copyQualityChecker'
import type { EditorialSlideRole, EditorialDirectorPlan } from '../editorial/editorialDirector'
import type { AgentReportItem, AgentSlideData } from './agents'
import { createNarrativeMemory, type NarrativeMemory } from './narrativeMemory'
import { runBrandConsistencyAgent } from './agents/brandConsistencyAgent'
import { runCriticAgent } from './agents/criticAgent'
import type { CriticResult } from './agents/criticAgent'

/**
 * Maps EditorialSlideRole (media pipeline) → SlideRole (narrative pipeline).
 * The two role systems use different vocabularies but represent the same
 * narrative positions in a carousel.
 */
function mapEditorialRoleToSlideRole(role: EditorialSlideRole): SlideRole {
  switch (role) {
    case 'hook': return 'hook'
    case 'context': return 'problem'
    case 'key-point': return 'feature'
    case 'detail': return 'feature_1'
    case 'stat': return 'proof'
    case 'summary': return 'benefit_or_proof'
    case 'save-cta': return 'cta'
    default: return 'feature'
  }
}

export interface MediaNarrativeAdapterResult {
  slides: AgentSlideData[]
  logs: AgentReportItem[]
  copyQualityReport: CopyQualityReport | null
}

/**
 * Runs narrative pipeline post-processing agents on already-generated media copy.
 *
 * Replaces:
 * - BrandIdentityAgent → runBrandConsistencyAgent (forbidden words, normalization)
 * - CopywritingAgent → removed (length trimming covered by enforceHarnessAgentCopy)
 * - VisualConceptAgent → removed (was a no-op)
 *
 * Adds:
 * - runCriticAgent → copy quality scoring (provides copyQualityReport for QualityGuardAgent)
 *
 * Does NOT replace:
 * - generateMediaSlideCopies (LLM copy generation with domain-specific prompts)
 * - runFinalSemanticCopyGuard (semantic evaluation + local repair)
 * - enforceHarnessAgentCopy / suppressWordOveruse (media-specific harness)
 * - QualityGuardAgent (post-render quality gate)
 */
export async function runMediaNarrativeAgents(params: {
  brand: BrandProfile
  input: CampaignInput
  strategy: ContentStrategy
  knowledgeCtx: CopyKnowledgeContext
  editorialPlan: EditorialDirectorPlan
  plannedSlides: { slideNumber: number; role: EditorialSlideRole; headline: string; body: string; layoutType: string }[]
}): Promise<MediaNarrativeAdapterResult> {
  const { brand, input, strategy, knowledgeCtx, editorialPlan, plannedSlides } = params

  const logs: AgentReportItem[] = []

  try {
    // 1. Derive selectedHook from editorial plan
    const hookSlide = editorialPlan.slides.find(s => s.role === 'hook')
    const selectedHook: HookCandidate = {
      text: hookSlide?.purpose || input.productName,
      type: 'curiosity',
      score: 100,
      reason: 'Derived from editorial director plan',
    }

    // 2. Build CarouselStructure with role mapping
    const structure: CarouselStructure = {
      slides: editorialPlan.slides.map(s => ({
        slideNumber: s.slideNumber,
        role: mapEditorialRoleToSlideRole(s.role),
        purpose: s.purpose,
      })),
    }

    // 3. Create NarrativeMemory
    const memory: NarrativeMemory = createNarrativeMemory({
      brand,
      input,
      strategy,
      knowledgeCtx,
      selectedHook,
      structure,
    })

    // 4. Inject already-generated copies as completedSlides
    memory.completedSlides = plannedSlides.map(s => ({
      slideNumber: s.slideNumber,
      role: mapEditorialRoleToSlideRole(s.role),
      headline: s.headline,
      body: s.body,
    }))

    // 5. BrandConsistencyAgent — replaces BrandIdentityAgent
    //    Removes forbidden words, normalizes copy, applies brand DNA rules
    console.log('[MediaNarrativeAdapter] BrandConsistencyAgent starting...')
    memory.completedSlides = runBrandConsistencyAgent(memory)
    logs.push({
      agentName: 'BrandConsistencyAgent',
      role: 'brand-fit',
      status: 'success',
      message: 'Brand consistency check completed via narrative pipeline.',
      timestamp: new Date().toISOString(),
    })

    // 6. CriticAgent — quality scoring (new capability)
    //    Evaluates narrative flow, persona fit, hook pattern, duplicate detection
    console.log('[MediaNarrativeAdapter] CriticAgent starting...')
    const criticResult: CriticResult = runCriticAgent(memory)
    logs.push({
      agentName: 'CriticAgent',
      role: 'copy-quality',
      status: criticResult.report.passed ? 'success' : 'warn',
      message: `Copy quality score: ${criticResult.report.score}. Weak slides: [${criticResult.weakSlides.join(', ') || 'none'}]`,
      details: {
        score: criticResult.report.score,
        narrativeFlowScore: criticResult.report.narrativeFlowScore,
        personaFitScore: criticResult.report.personaFitScore,
        hookPatternScore: criticResult.report.hookPatternScore,
        weakSlides: criticResult.weakSlides,
      },
      timestamp: new Date().toISOString(),
    })

    // 7. Convert back to AgentSlideData[] preserving original EditorialSlideRole
    const slides: AgentSlideData[] = memory.completedSlides.map(cs => {
      const original = plannedSlides.find(p => p.slideNumber === cs.slideNumber)
      return {
        slideNumber: cs.slideNumber,
        role: original?.role ?? cs.role,
        headline: cs.headline,
        body: cs.body,
        layoutType: original?.layoutType ?? 'dark-editorial',
      }
    })

    return {
      slides,
      logs,
      copyQualityReport: criticResult.report,
    }
  } catch (err) {
    // Fallback: return original slides unchanged (no quality impact)
    console.error('[MediaNarrativeAdapter] Narrative agents failed, falling back to original slides', err)
    const slides: AgentSlideData[] = plannedSlides.map(s => ({
      slideNumber: s.slideNumber,
      role: s.role,
      headline: s.headline,
      body: s.body,
      layoutType: s.layoutType,
    }))
    logs.push({
      agentName: 'MediaNarrativeAdapter',
      role: 'brand-fit',
      status: 'error',
      message: `Narrative agents failed: ${err instanceof Error ? err.message : String(err)}. Falling back to original slides.`,
      timestamp: new Date().toISOString(),
    })
    return {
      slides,
      logs,
      copyQualityReport: null,
    }
  }
}
