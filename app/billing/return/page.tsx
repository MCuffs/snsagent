import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function detectLocale(): 'ko' | 'en' {
  const headerStore = headers()
  const acceptLang = (headerStore as unknown as { get: (k: string) => string | null }).get('accept-language') ?? ''
  if (acceptLang.toLowerCase().startsWith('ko') || acceptLang.toLowerCase().includes(',ko')) {
    return 'ko'
  }
  return 'en'
}

export default function BillingReturnPage() {
  const locale = detectLocale()
  redirect(`/${locale}/billing`)
}
