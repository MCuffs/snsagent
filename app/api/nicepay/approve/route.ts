import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'
import { approveNicepayPaymentForUser, nicepayUnexpectedError } from '../../../../lib/nicepay-approval'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../lib/rateLimiter'

export const runtime = 'nodejs'

const approveSchema = z.object({
  tid: z.string().min(1, 'tid는 필수입니다.'),
  authToken: z.string().min(1, 'authToken은 필수입니다.'),
  orderId: z.string().min(1, 'orderId는 필수입니다.'),
  plan: z.enum(['LITE', 'PRO', 'UNLIMITED']),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') || '127.0.0.1'
  const rl = await checkRateLimit(`rate_limit:payment:${ip}`, RATE_LIMIT_PRESETS.payment)
  if (rl.limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    )
  }

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
