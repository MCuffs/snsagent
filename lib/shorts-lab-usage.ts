import prisma from './db'
import {
  hasShortsLabFullAccess,
  isShortsLabUnlimited,
} from './auth/shorts-lab-access'
import type { ShortsLabAccess } from '../app/shorts-lab/types'

// Shorts Lab 생성 한도.
// 유료(월 9,900원 플랜 이상): 월 60회 · 일 10회
// 무료: 평생 1회 체험 후 결제 유도
// 어드민·지정 계정: 무제한
export const SHORTS_LAB_MONTHLY_LIMIT = 60
export const SHORTS_LAB_DAILY_LIMIT = 10
export const SHORTS_LAB_FREE_TRIAL_LIMIT = 1

// 별도 테이블 대신 AiGenerationLog 에 전용 stepName 으로 기록해 집계합니다.
const USAGE_STEP_NAME = 'shorts-lab-generation'
const USAGE_PROVIDER = 'shorts-lab'

export interface ShortsLabUsage {
  dayUsed: number
  monthUsed: number
  totalUsed: number
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간 기준 오늘 0시 (UTC Date 로 반환) */
function kstStartOfDay(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - KST_OFFSET_MS)
}

/** 한국 시간 기준 이번 달 1일 0시 (UTC Date 로 반환) */
function kstStartOfMonth(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  kst.setUTCHours(0, 0, 0, 0)
  kst.setUTCDate(1)
  return new Date(kst.getTime() - KST_OFFSET_MS)
}

export async function getShortsLabUsage(
  userId: string,
  now = new Date(),
): Promise<ShortsLabUsage> {
  const base = { userId, stepName: USAGE_STEP_NAME, status: 'success' }
  const [dayUsed, monthUsed, totalUsed] = await Promise.all([
    prisma.aiGenerationLog.count({
      where: { ...base, createdAt: { gte: kstStartOfDay(now) } },
    }),
    prisma.aiGenerationLog.count({
      where: { ...base, createdAt: { gte: kstStartOfMonth(now) } },
    }),
    prisma.aiGenerationLog.count({ where: base }),
  ])
  return { dayUsed, monthUsed, totalUsed }
}

/** 페이지 서버 컴포넌트에서 클라이언트로 내려줄 이용 상태 */
export async function getShortsLabAccess(user: {
  id: string
  email?: string | null
  plan?: string | null
}): Promise<ShortsLabAccess> {
  const usage = await getShortsLabUsage(user.id)
  const full = hasShortsLabFullAccess(user)
  const mode: ShortsLabAccess['mode'] = full
    ? 'full'
    : usage.totalUsed < SHORTS_LAB_FREE_TRIAL_LIMIT
      ? 'trial'
      : 'locked'
  return {
    mode,
    monthUsed: usage.monthUsed,
    dayUsed: usage.dayUsed,
    monthLimit: SHORTS_LAB_MONTHLY_LIMIT,
    dayLimit: SHORTS_LAB_DAILY_LIMIT,
    unlimited: isShortsLabUnlimited(user.email),
  }
}

export async function recordShortsLabGeneration(userId: string, videoId: string) {
  await prisma.aiGenerationLog.create({
    data: {
      userId,
      stepName: USAGE_STEP_NAME,
      provider: USAGE_PROVIDER,
      status: 'success',
      metadata: JSON.stringify({ videoId }),
    },
  })
}
