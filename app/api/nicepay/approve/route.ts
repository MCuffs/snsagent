import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { approveNicepayPaymentForUser, nicepayUnexpectedError } from '../../../../lib/nicepay-approval'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json() as {
      tid?: string
      authToken?: string
      orderId?: string
      plan?: string
    }

    const result = await approveNicepayPaymentForUser(user, body, dbService.updateUserNicepay)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, offer: result.offer },
        { status: result.status },
      )
    }

    return NextResponse.json({ success: true, offer: result.offer })
  } catch (error) {
    const result = nicepayUnexpectedError(error)
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
}
