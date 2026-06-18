import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { readSessionEmail, SESSION_COOKIE_NAME } from '../../../lib/auth/session'

export const dynamic = 'force-dynamic'

function detectLocale(): 'ko' | 'en' {
  // 1. Accept-Language 헤더로 판단
  const headerStore = headers()
  const acceptLang = (headerStore as unknown as { get: (k: string) => string | null }).get('accept-language') ?? ''
  if (acceptLang.toLowerCase().startsWith('ko') || acceptLang.toLowerCase().includes(',ko')) {
    return 'ko'
  }
  return 'en'
}

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const email = readSessionEmail(token)

  // 로그인 안 된 경우 — locale 추정 후 로그인 페이지로
  if (!email) {
    const locale = detectLocale()
    redirect(`/${locale}/login`)
  }

  const params = searchParams ? await searchParams : {}
  const extra = new URLSearchParams()
  extra.set('success', 'true')
  if (params.checkout_id) extra.set('checkout_id', params.checkout_id)

  // Accept-Language 기반 locale 판단
  const locale = detectLocale()
  redirect(`/${locale}/billing?${extra.toString()}`)
}
