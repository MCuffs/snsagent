import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { createNicepayOrderId, expireBillingKey, NicepayError } from '../../../../lib/nicepay'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  if (!user.nicepayBid || user.nicepaySubscriptionStatus !== 'ACTIVE') {
    return NextResponse.json({ error: '활성 NicePay 구독이 없습니다.' }, { status: 400 })
  }

  try {
    await expireBillingKey(user.nicepayBid, createNicepayOrderId('expire', user.nicepayBid))
  } catch (error) {
    if (error instanceof NicepayError) {
      console.warn(`[NicePay Cancel] expireBillingKey failed (continuing): ${error.code} — ${error.message}`)
    } else {
      console.error('[NicePay Cancel] Unexpected error', error)
    }
  }

  await dbService.updateUserNicepay(user.id, {
    nicepayBid: null,
    nicepaySubscriptionStatus: 'CANCELED',
    nicepayCanceledAt: new Date(),
    plan: 'FREE',
  })

  console.log(`[NicePay Cancel] User ${user.id} canceled — downgraded to FREE`)
  return NextResponse.json({ success: true })
}
