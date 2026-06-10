import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 2026년 6월 10일 KST 기준 (00:00:00 ~ 23:59:59)
  // UTC 기준으로는 2026-06-09T15:00:00.000Z ~ 2026-06-10T14:59:59.999Z
  const startDate = new Date('2026-06-09T15:00:00.000Z');
  const endDate = new Date('2026-06-10T15:00:00.000Z');

  console.log(`🔍 분석 대상 기간 (KST): 2026-06-10 00:00:00 ~ 2026-06-10 24:00:00`);
  console.log(`🔍 UTC 범위: ${startDate.toISOString()} ~ ${endDate.toISOString()}\n`);

  // 1. 신규 가입 유저 분석
  const newUsers = await prisma.user.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 2. 캠페인 생성 분석
  const newCampaigns = await prisma.campaign.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 3. AI 생성 로그 분석
  const aiLogs = await prisma.aiGenerationLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // AI Generation 실패 상세 분석
  const aiFailures = await prisma.aiGenerationLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        notIn: ['SUCCESS', 'success', 'start', 'START']
      }
    },
    select: {
      stepName: true,
      errorCode: true,
      errorMessage: true,
      errorType: true,
    }
  });

  // 4. 유저 편집 로그 분석
  const editLogs = await prisma.userEditLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 5. 결제 내역 분석
  const paymentRecords = await prisma.paymentRecord.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 6. 에러 로그 분석
  const errorLogs = await prisma.errorLog.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // === 결과 출력 ===
  console.log(`==================================================`);
  console.log(`📊 [2026-06-10] 사용자 행동 로그 분석 결과`);
  console.log(`==================================================\n`);

  // 1. 신규 가입 유저
  console.log(`👤 1. 신규 가입 유저 (총 ${newUsers.length}명)`);
  if (newUsers.length > 0) {
    newUsers.forEach((u, idx) => {
      console.log(`   [${idx + 1}] 이름: ${u.name || 'N/A'} | 이메일: ${u.email} | 요금제: ${u.plan} | 가입시간: ${u.createdAt.toISOString()}`);
    });
  } else {
    console.log(`   - 신규 가입 유저가 없습니다.`);
  }
  console.log('');

  // 2. 캠페인 생성
  console.log(`📋 2. 신규 캠페인 생성 (총 ${newCampaigns.length}건)`);
  if (newCampaigns.length > 0) {
    newCampaigns.forEach((c, idx) => {
      console.log(`   [${idx + 1}] 제목: "${c.title}" | 제품: ${c.productName} | 생성유저: ${c.user.email} (${c.user.name || 'N/A'}) | 슬라이드수: ${c.slideCount} | 상태: ${c.status} | 생성시간: ${c.createdAt.toISOString()}`);
    });
  } else {
    console.log(`   - 생성된 캠페인이 없습니다.`);
  }
  console.log('');

  // 3. AI 생성 로그
  console.log(`🤖 3. AI 생성 로그 (총 ${aiLogs.length}건)`);
  if (aiLogs.length > 0) {
    // 통계 산출
    const stepStats: { [key: string]: { total: number; success: number; failed: number } } = {};
    let totalTokens = 0;
    let successCount = 0;
    let failedCount = 0;

    aiLogs.forEach(log => {
      const step = log.stepName;
      if (!stepStats[step]) {
        stepStats[step] = { total: 0, success: 0, failed: 0 };
      }
      stepStats[step].total++;
      if (log.status === 'SUCCESS' || log.status === 'success') {
        stepStats[step].success++;
        successCount++;
      } else if (log.status !== 'START' && log.status !== 'start') {
        stepStats[step].failed++;
        failedCount++;
      }
      totalTokens += log.totalTokens || 0;
    });

    console.log(`   - 전체 성공: ${successCount}건 / 실패: ${failedCount}건`);
    console.log(`   - 총 소모 토큰: ${totalTokens.toLocaleString()} tokens`);
    console.log(`   - 단계별 상세:`);
    Object.entries(stepStats).forEach(([step, stat]) => {
      console.log(`     * ${step}: 총 ${stat.total}회 (성공: ${stat.success}, 실패: ${stat.failed})`);
    });

    console.log(`   - AI 생성 에러 원인 분석:`);
    if (aiFailures.length > 0) {
      const errorSummary: { [key: string]: number } = {};
      aiFailures.forEach(f => {
        const key = `[${f.stepName}] ${f.errorType || 'UnknownType'} / ${f.errorCode || 'NoCode'}: ${f.errorMessage || 'No Message'}`;
        errorSummary[key] = (errorSummary[key] || 0) + 1;
      });
      Object.entries(errorSummary).forEach(([err, count]) => {
        console.log(`     * ${err} (${count}회 발생)`);
      });
    } else {
      console.log(`     * 실패 상세 로그가 없습니다.`);
    }

    console.log(`   - 최근 AI 로그 (최대 5건):`);
    aiLogs.slice(-5).forEach((log, idx) => {
      console.log(`     [${idx + 1}] 유저: ${log.user?.email || '비회원/알수없음'} | 단계: ${log.stepName} | 상태: ${log.status} | 모델: ${log.model || 'N/A'} | 시간: ${log.createdAt.toISOString()}`);
    });
  } else {
    console.log(`   - AI 생성 로그가 없습니다.`);
  }
  console.log('');

  // 4. 유저 편집 로그
  console.log(`✍️ 4. 유저 편집 로그 (총 ${editLogs.length}건)`);
  if (editLogs.length > 0) {
    const eventTypeStats: { [key: string]: number } = {};
    const userStats: { [key: string]: number } = {};

    editLogs.forEach(log => {
      eventTypeStats[log.eventType] = (eventTypeStats[log.eventType] || 0) + 1;
      const email = log.user?.email || '알수없음';
      userStats[email] = (userStats[email] || 0) + 1;
    });

    console.log(`   - 이벤트 타입별 빈도:`);
    Object.entries(eventTypeStats).forEach(([type, count]) => {
      console.log(`     * ${type}: ${count}회`);
    });

    console.log(`   - 유저별 편집 횟수:`);
    Object.entries(userStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([email, count]) => {
        console.log(`     * ${email}: ${count}회`);
      });
  } else {
    console.log(`   - 유저 편집 로그가 없습니다.`);
  }
  console.log('');

  // 5. 결제 내역
  console.log(`💳 5. 결제 내역 (총 ${paymentRecords.length}건)`);
  if (paymentRecords.length > 0) {
    let totalPaidAmount = 0;
    paymentRecords.forEach((p, idx) => {
      console.log(`   [${idx + 1}] 유저: ${p.user.email} | 금액: ${p.amount.toLocaleString()}원 | 상태: ${p.status} | PG사: ${p.provider} | 시간: ${p.createdAt.toISOString()}`);
      if (p.status === 'paid') {
        totalPaidAmount += p.amount;
      }
    });
    console.log(`   - 총 매출 (status: paid 기준): ${totalPaidAmount.toLocaleString()}원`);
  } else {
    console.log(`   - 결제 내역이 없습니다.`);
  }
  console.log('');

  // 6. 에러 로그
  console.log(`🚨 6. 에러 로그 (총 ${errorLogs.length}건)`);
  if (errorLogs.length > 0) {
    const errorStats: { [key: string]: number } = {};
    errorLogs.forEach(log => {
      errorStats[log.errorMessage] = (errorStats[log.errorMessage] || 0) + 1;
    });

    console.log(`   - 주요 에러 목록 (빈도순):`);
    Object.entries(errorStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([msg, count]) => {
        console.log(`     * "${msg}": ${count}회`);
      });

    console.log(`   - 최근 에러 로그 (최대 5건):`);
    errorLogs.slice(0, 5).forEach((log, idx) => {
      console.log(`     [${idx + 1}] 액션: ${log.actionName} | 에러: ${log.errorMessage} | 시간: ${log.createdAt.toISOString()}`);
    });
  } else {
    console.log(`   - 발생한 에러 로그가 없습니다.`);
  }
  console.log('');

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
