import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../lib/auth/user'
import { dbService } from '../../../../../lib/db-service'
import { deleteBillingKey, TossPaymentsError } from '../../../../../lib/tosspayments'
import { formatMissingConfigMessage, getTossConfigStatus } from '../../../../../lib/runtime-diagnostics'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (!user.tossBillingKey) {
      return NextResponse.json({ error: '활성 토스페이먼츠 구독이 없습니다.' }, { status: 400 })
    }
    const config = getTossConfigStatus()
    if (!config.ready) {
      return NextResponse.json({ error: formatMissingConfigMessage('토스페이먼츠', config.missing) }, { status: 503 })
    }

    try {
      await deleteBillingKey(user.tossBillingKey)
    } catch (error) {
      if (!(error instanceof TossPaymentsError && error.status === 404)) throw error
    }

    await dbService.updateUserToss(user.id, {
      plan: 'FREE',
      tossBillingKey: null,
      tossSubscriptionStatus: 'CANCELED',
      tossNextBillingAt: null,
      tossCanceledAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Toss Billing Cancel]', error)
    return NextResponse.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 })
  }
}
