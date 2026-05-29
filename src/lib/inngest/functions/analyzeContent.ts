import { inngest } from '../client'

export const analyzeContentFunction = inngest.createFunction(
  { id: 'analyze-content', name: 'Nightly Content Analysis', triggers: [{ cron: '0 17 * * *' }] },
  async ({ step }) => {
    // Phase 2: detect carousels, extract copy patterns, embed crawled posts
    await step.run('stub', async () => {
      console.log('[analyze-content] stub — Phase 2 will implement carousel detection and pattern extraction')
    })
    return { status: 'stub' }
  }
)
