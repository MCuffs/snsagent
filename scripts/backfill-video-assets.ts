import prisma from '../lib/db'
import { persistGeneratedVideo } from '../lib/video-storage'

async function main() {
  const slides = await prisma.carouselSlide.findMany({
    where: {
      campaign: { imageModel: { contains: 'seedance' } },
      videoUrl: { not: null },
    },
    select: {
      id: true,
      slideNumber: true,
      videoUrl: true,
      campaign: { select: { userId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  let migrated = 0
  let skipped = 0
  let failed = 0
  for (const slide of slides) {
    const sourceUrl = slide.videoUrl
    if (!sourceUrl) continue
    if (isDurableVideoUrl(sourceUrl)) {
      skipped++
      continue
    }
    try {
      const videoUrl = await persistGeneratedVideo({
        sourceUrl,
        userId: slide.campaign.userId,
        slideNumber: slide.slideNumber,
      })
      await prisma.carouselSlide.update({
        where: { id: slide.id },
        data: { mediaType: 'video', videoUrl },
      })
      migrated++
      console.log(`migrated slide ${slide.id}`)
    } catch (error) {
      failed++
      console.error(`failed slide ${slide.id}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log(JSON.stringify({ total: slides.length, migrated, skipped, failed }))
}

function isDurableVideoUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname.endsWith('.blob.vercel-storage.com') || hostname === 'blob.vercel-storage.com'
  } catch {
    return value.startsWith('/generated-videos/')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
