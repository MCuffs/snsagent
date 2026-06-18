import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { cancelSubscription } from '../../../../lib/polar'
import { dbService } from '../../../../lib/db-service'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    if (!user.polarSubscriptionId) {
      return NextResponse.json({ error: '활성 Polar 구독이 없습니다.' }, { status: 400 })
    }

    try {
      await cancelSubscription(user.polarSubscriptionId)
    } catch (err) {
      // 404 = already cancelled/deleted on Polar side, proceed to DB cleanup
      if (!(err instanceof Error && err.message.includes('404'))) throw err
    }

    await dbService.updateUserPolar(user.id, {
      polarSubscriptionId: null,
      polarSubscriptionStatus: 'canceled',
      plan: 'FREE',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Polar Cancel]', err)
    return NextResponse.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 })
  }
}
