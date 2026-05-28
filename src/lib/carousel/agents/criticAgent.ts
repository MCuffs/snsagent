import { checkCopyQuality, type CopyQualityReport } from '../../copywriting/copyQualityChecker'
import type { SlideCopy } from '../types'
import type { NarrativeMemory } from '../narrativeMemory'

export interface CriticResult {
  report: CopyQualityReport
  weakSlides: number[]  // slideNumbers that need regeneration
}

export function runCriticAgent(memory: NarrativeMemory): CriticResult {
  const slides: SlideCopy[] = memory.completedSlides.map(s => ({
    slideNumber: s.slideNumber,
    headline: s.headline,
    body: s.body,
  }))

  const structure = memory.structure.slides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role,
  }))

  const report = checkCopyQuality(slides, memory.knowledgeCtx, structure)

  // Identify weak slides: those with NARRATIVE_BREAK or DUPLICATE_MESSAGE
  const weakCodes = new Set<string>(['NARRATIVE_BREAK', 'DUPLICATE_MESSAGE'])
  const weakSlideNumbers = new Set<number>()

  for (const issue of report.issues) {
    if (weakCodes.has(issue.code)) {
      weakSlideNumbers.add(issue.slideNumber)
    }
  }

  const weakSlides = [...weakSlideNumbers].sort((a, b) => a - b)

  console.log(
    `[CriticAgent] score=${report.score} narrativeFlow=${report.narrativeFlowScore} weakSlides=[${weakSlides.join(',')}]`
  )

  return { report, weakSlides }
}
