import { generateDesignPrompts } from '../designPromptEngine'
import type { SlideDesignPrompt } from '../types'
import type { NarrativeMemory } from '../narrativeMemory'

const CAMERA_DISTANCES = ['close-up', 'medium shot', 'wide shot'] as const

export async function runVisualDirectorAgent(memory: NarrativeMemory): Promise<SlideDesignPrompt[]> {
  const copies = memory.completedSlides.map(s => ({
    slideNumber: s.slideNumber,
    headline: s.headline,
    body: s.body,
  }))

  const prompts = await generateDesignPrompts(
    memory.brand,
    memory.input,
    copies,
    memory.structure,
    memory.knowledgeCtx,
  )

  // Enforce visual diversity: prevent 3 consecutive slides with same camera distance
  let consecutiveCount = 0
  let lastDistance = ''

  return prompts.map((prompt, i) => {
    const currentDistance = CAMERA_DISTANCES[i % CAMERA_DISTANCES.length]
    if (currentDistance === lastDistance) {
      consecutiveCount++
    } else {
      consecutiveCount = 1
      lastDistance = currentDistance
    }

    if (consecutiveCount <= 2) {
      return { ...prompt, backgroundPrompt: `${currentDistance}, ${prompt.backgroundPrompt}` }
    }

    // Force different distance after 2 consecutive
    const altDistance = CAMERA_DISTANCES[(i + 1) % CAMERA_DISTANCES.length]
    consecutiveCount = 1
    lastDistance = altDistance
    return { ...prompt, backgroundPrompt: `${altDistance}, ${prompt.backgroundPrompt}` }
  })
}
