import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 최근 발생한 AI Generation 로그 및 에러 로그 조회 중...');

  const aiLogs = await prisma.aiGenerationLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      stepName: true,
      status: true,
      model: true,
      errorCode: true,
      errorType: true,
      errorMessage: true,
      createdAt: true,
      baseURL: true,
    }
  });

  const errorLogs = await prisma.errorLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n==================================================');
  console.log('🤖 최근 AI Generation 로그 (최대 10개)');
  console.log('==================================================');
  if (aiLogs.length > 0) {
    aiLogs.forEach((log, idx) => {
      console.log(`[${idx + 1}] 시간: ${log.createdAt.toISOString()} | 단계: ${log.stepName} | 상태: ${log.status} | 모델: ${log.model} | URL: ${log.baseURL}`);
      if (log.errorCode || log.errorMessage) {
        console.log(`    ⚠️ 에러 코드: ${log.errorCode} | 에러 타입: ${log.errorType}`);
        console.log(`    ⚠️ 에러 메시지: ${log.errorMessage}`);
      }
    });
  } else {
    console.log('   - 기록된 AI Generation 로그가 없습니다.');
  }

  console.log('\n==================================================');
  console.log('🚨 최근 시스템 에러 로그 (최대 10개)');
  console.log('==================================================');
  if (errorLogs.length > 0) {
    errorLogs.forEach((log, idx) => {
      console.log(`[${idx + 1}] 시간: ${log.createdAt.toISOString()} | 액션: ${log.actionName}`);
      console.log(`    ⚠️ 에러: ${log.errorMessage}`);
      if (log.errorStack) console.log(`    ⚠️ 스택: ${log.errorStack.slice(0, 300)}...`);
    });
  } else {
    console.log('   - 기록된 시스템 에러 로그가 없습니다.');
  }
  console.log('');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
