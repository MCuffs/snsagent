import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      slides: {
        orderBy: { slideNumber: 'asc' },
        select: {
          slideNumber: true,
          headline: true,
          body: true,
        }
      }
    }
  });

  console.log(`\n=== 최근 생성된 카드뉴스 ${campaigns.length}개 ===\n`);

  for (const campaign of campaigns) {
    console.log(`─────────────────────────────────────`);
    console.log(`📋 캠페인: ${campaign.title}`);
    console.log(`📅 생성일: ${campaign.createdAt.toISOString()}`);
    console.log(`👤 사용자: ${campaign.userId}`);
    console.log(`📊 슬라이드 수: ${campaign.slides.length}`);
    console.log('');

    for (const slide of campaign.slides) {
      console.log(`  슬라이드 ${slide.slideNumber}:`);
      console.log(`    제목: ${slide.headline}`);
      console.log(`    본문: ${slide.body}`);
      console.log('');
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
