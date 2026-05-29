import type { CarouselStructure, ContentStrategy, SlideRole } from '../carousel/types'
import {
  getNarrativeArcs,
  type CopyKnowledgeContext,
  type NarrativeArc,
  type NarrativeArcId,
} from './copyKnowledgeBase'

export function selectNarrativeArc(
  strategy: ContentStrategy,
  slideCount: number,
  ctx: CopyKnowledgeContext
): NarrativeArc {
  const all = getNarrativeArcs()
  const st = strategy.strategyType

  if (st === 'problem_solution') return find(all, 'problem_twist_solution')
  if (st === 'checklist') return find(all, 'checklist_save')
  if (st === 'comparison') return find(all, 'belief_challenge')

  if (st === 'storytelling' || st === 'review_style') {
    return slideCount >= 6
      ? find(all, 'before_after_proof')
      : find(all, 'mini_story_cta')
  }

  if (st === 'benefit_focused' || st === 'seasonal' || st === 'discount') {
    return find(all, 'mini_story_cta')
  }

  // Fall back to persona preference, then default
  return (
    all.find(a => a.id === ctx.personaProfile.preferredNarrativeArc) ??
    find(all, 'problem_twist_solution')
  )
}

export function buildNarrativeTransitionInstructions(
  arc: NarrativeArc,
  slides: CarouselStructure['slides']
): string {
  const lines = ['슬라이드 서사 흐름 가이드:']
  slides.forEach((slide, index) => {
    const transition = arc.transitionLogic[index] ?? '다음 슬라이드와 자연스럽게 연결'
    lines.push(`슬라이드${slide.slideNumber}(${slide.role}): ${transition}`)
  })
  return lines.join('\n')
}

export function formatArcForPrompt(arc: NarrativeArc): string {
  const roles = arc.slideRoleSequence.join('→')
  const result = `서사 구조: ${arc.id} — ${arc.label}. 흐름: ${roles}. 각 슬라이드는 다음 슬라이드를 궁금하게 끝낼 것`
  return result.length > 130 ? result.slice(0, 127) + '...' : result
}

export function getNarrativeArcById(id: NarrativeArcId): NarrativeArc {
  const all = getNarrativeArcs()
  return all.find(a => a.id === id) ?? all[0]
}

export function getAllNarrativeArcs(): NarrativeArc[] {
  return getNarrativeArcs()
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function find(arcs: NarrativeArc[], id: NarrativeArcId): NarrativeArc {
  return arcs.find(a => a.id === id) ?? arcs[0]
}

// Map narrative arc role sequences to the closest canonical SlideRole
export function mapArcRolesToStructure(arc: NarrativeArc, slideCount: number): { slideNumber: number; role: SlideRole; purpose: string }[] {
  const sequence = arc.slideRoleSequence.slice(0, slideCount)
  // Pad if needed
  while (sequence.length < slideCount) {
    sequence.push('feature' as SlideRole)
  }
  return sequence.map((role, i) => ({
    slideNumber: i + 1,
    role,
    purpose: arc.transitionLogic[i] ?? '핵심 메시지 전달',
  }))
}
