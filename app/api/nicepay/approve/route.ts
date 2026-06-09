import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { approveNicepayPaymentForUser, nicepayUnexpectedError } from '../../../../lib/nicepay-approval'

export const runtime = 'nodejs'

const approveSchema = z.object({
  tid: z.string().min(1, 'tid는 필수입니다.'),
  authToken: z.string().min(1, 'authToken은 필수입니다.'),
  orderId: z.string().min(1, 'orderId는 필수입니다.'),
  plan: z.enum(['LITE', 'PRO', 'UNLIMITED']),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const validation = approveSchema.safeParse(body)
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || '잘못된 입력값입니다.'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const result = await approveNicepayPaymentForUser(user, validation.data, dbService.updateUserNicepay)
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
