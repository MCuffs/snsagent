'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'

export async function deleteWorkAction(campaignId: string) {
  const user = await getSessionUser()
  if (!user) return { success: false as const, error: '로그인이 필요합니다.' }

  try {
    const deleted = await dbService.deleteCampaign(user.id, campaignId)
    if (!deleted) return { success: false as const, error: '삭제할 작업을 찾을 수 없습니다.' }

    revalidatePath('/concept')
    revalidatePath('/works')
    return { success: true as const }
  } catch {
    return { success: false as const, error: '작업 삭제에 실패했습니다.' }
  }
}
