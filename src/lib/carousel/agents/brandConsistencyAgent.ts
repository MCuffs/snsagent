import { BrandIdentityAgent } from '../agents'
import type { NarrativeMemory, CompletedSlide } from '../narrativeMemory'

export function runBrandConsistencyAgent(memory: NarrativeMemory): CompletedSlide[] {
  const agent = new BrandIdentityAgent()

  const agentSlides = memory.completedSlides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role,
    headline: s.headline,
    body: s.body,
    layoutType: 'commerce-standard' as const,
  }))

  const result = agent.run({
    brandName: memory.brand.name,
    brandToneOfVoice: memory.brand.toneOfVoice,
    forbiddenWords: memory.brand.forbiddenWords,
    ctaStyle: memory.brand.ctaStyle,
    brandDna: memory.brand.brandDna,
    slides: agentSlides,
  })

  result.logs.forEach(log => {
    if (log.status === 'warn') {
      console.log(`[BrandConsistencyAgent] slide-${log.message.match(/\d+/)?.[0] ?? '?'}: ${log.message}`)
    }
  })

  return result.slides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role as CompletedSlide['role'],
    headline: s.headline,
    body: s.body,
  }))
}
