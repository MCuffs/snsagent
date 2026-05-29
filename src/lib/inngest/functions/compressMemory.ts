import { inngest } from '../client'

export const compressMemoryFunction = inngest.createFunction(
  { id: 'compress-memory', name: 'Weekly Memory Compression', triggers: [{ cron: '0 18 * * 0' }] },
  async ({ step }) => {
    // Phase 3: find brands with sufficient edit logs, fan-out per-brand compression
    await step.run('stub', async () => {
      console.log('[compress-memory] stub — Phase 3 will implement memory compression')
    })
    return { status: 'stub' }
  }
)

export const compressBrandMemoryFunction = inngest.createFunction(
  { id: 'compress-brand-memory', name: 'Compress Brand Memory', triggers: [{ event: 'shuffla/memory.compress.brand' }] },
  async ({ event, step }) => {
    const { brandId } = event.data as { brandId: string }
    await step.run('compress', async () => {
      console.log(`[compress-brand-memory] stub for brandId=${brandId} — Phase 3 will implement`)
    })
    return { status: 'stub', brandId }
  }
)
