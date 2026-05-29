import { serve } from 'inngest/next'
import { inngest } from '../../../src/lib/inngest/client'
import { crawlTrendsFunction } from '../../../src/lib/inngest/functions/crawlTrends'
import { analyzeContentFunction } from '../../../src/lib/inngest/functions/analyzeContent'
import { updateTrendVectorsFunction } from '../../../src/lib/inngest/functions/updateTrendVectors'
import { compressMemoryFunction, compressBrandMemoryFunction } from '../../../src/lib/inngest/functions/compressMemory'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    crawlTrendsFunction,
    analyzeContentFunction,
    updateTrendVectorsFunction,
    compressMemoryFunction,
    compressBrandMemoryFunction,
  ],
})
