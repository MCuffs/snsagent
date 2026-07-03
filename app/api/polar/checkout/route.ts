import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '../../../../lib/auth/user'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../lib/rateLimiter'
import { createCheckoutSession, POLAR_PRODUCT_IDS } from '../../../../lib/polar'

export const runtime = 'nodejs'

const CHECKOUT_LINKS: Record<'PRO' | 'UNLIMITED', string | undefined> = {
  PRO: process.env.POLAR_CHECKOUT_PRO?.trim(),
  UNLIMITED: process.env.POLAR_CHECKOUT_UNLIMITED?.trim(),
}

const schema = z.object({
  plan: z.enum(['YOUTUBE_PROMO', 'PRO', 'UNLIMITED']),
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

  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  if (user.polarSubscriptionStatus === 'active') {
    return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 409 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: '유효하지 않은 플랜입니다.' }, { status: 400 })
  }

  const { plan } = parsed.data
  const productId = POLAR_PRODUCT_IDS[plan]
  if (productId && process.env.POLAR_API_KEY?.trim()) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin
    try {
      const checkout = await createCheckoutSession({
        productId,
        customerEmail: user.email,
        successUrl: `${origin.replace(/\/$/, '')}/youtube-automation?checkout=success`,
        metadata: {
          userId: user.id,
          plan,
        },
      })

      return NextResponse.json({ url: checkout.url })
    } catch (error) {
      console.error('[Polar Checkout] Failed to create checkout', {
        plan,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: '결제 페이지를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }
  }

  // YouTube Promo must always use a user-bound checkout. A static link does
  // not carry the Shuffla userId and can leave a successful payment unassigned.
  if (plan === 'YOUTUBE_PROMO') {
    console.error('[Polar Checkout] YouTube Promo dynamic checkout is not configured', {
      hasProductId: Boolean(productId),
      hasApiKey: Boolean(process.env.POLAR_API_KEY?.trim()),
    })
    return NextResponse.json({ error: 'YouTube 프로모 결제가 아직 구성되지 않았습니다.' }, { status: 503 })
  }

  const checkoutUrl = CHECKOUT_LINKS[plan]
  if (!checkoutUrl) {
    return NextResponse.json({ error: `Polar checkout link for ${plan} is not configured.` }, { status: 503 })
  }

  return NextResponse.json({ url: checkoutUrl })
}
