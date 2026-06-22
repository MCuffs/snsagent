'use server'

import { cookies } from 'next/headers'
import { dbService } from '../../lib/db-service'
import { isSubscriptionPlan } from '../../lib/limits-types'
import { getSessionUser, failed, unauthenticated } from './_shared'

// Change Plan Action (Mock Pricing Switcher)
export async function changeUserPlanAction(plan: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!isSubscriptionPlan(plan)) {
    return failed('지원하지 않는 요금제입니다.')
  }

  if (plan !== 'FREE') {
    return failed('유료 플랜 변경은 결제 승인 후에만 가능합니다.')
  }

  await dbService.updateUserPlan(user.id, plan)

  // Clear layout cache
  await cookies() // dummy read to bypass Next.js server actions cache
  return { success: true as const }
}
