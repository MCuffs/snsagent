import { inngest } from '../client'

export const crawlTrendsFunction = inngest.createFunction(
  { id: 'crawl-trends', name: 'Crawl SNS Trends', triggers: [{ cron: '0 */3 * * *' }] },
  async ({ step }) => {
    // Phase 2: full implementation
    await step.run('stub', async () => {
      console.log('[crawl-trends] stub — Phase 2 will implement crawlers')
    })
    return { status: 'stub' }
  }
)
