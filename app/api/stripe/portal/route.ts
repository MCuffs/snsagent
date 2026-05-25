import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { stripe } from '../../../../lib/stripe'
import { getAppBaseUrl } from '../../../../lib/env'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: '구독 정보가 없습니다.' }, { status: 400 })
    }

    const baseUrl = getAppBaseUrl(request)
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe Portal]', error)
    const message = error instanceof Error ? error.message : '포털 세션 생성에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
