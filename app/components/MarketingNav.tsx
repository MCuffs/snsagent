import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import LocaleSwitcher from './LocaleSwitcher'

interface MarketingNavProps {
  authenticated?: boolean
  locale?: string
}

type NavKey =
  | 'product'
  | 'workflow'
  | 'gallery'
  | 'pricing'
  | 'resources'
  | 'login'
  | 'back_to_cms'
  | 'continue'
  | 'start'

export async function MarketingNav({ authenticated = false, locale }: MarketingNavProps) {
  const prefix = locale ? `/${locale}` : ''
  const accessHref = authenticated ? `${prefix}/concept` : '/api/auth/google/start'

  let t: Awaited<ReturnType<typeof getTranslations>> | null = null
  try {
    t = await getTranslations('nav')
  } catch {
    // Outside i18n context (non-locale pages), fall back to Korean
  }

  const label = (ko: string, key: NavKey) =>
    t ? t(key as string) : ko

  return (
    <header className="sticky top-0 z-50 border-b border-[#ede9e2] bg-[#fbfaf7]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1380px] items-center justify-between px-5 md:px-8">
        <Link href={`${prefix}/`} className="flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.05em] text-[#171714] transition-opacity hover:opacity-70">
          <Image src="/shuffla-logo-mark.png" width={30} height={30} alt="Shuffla 로고" />
          Shuffla
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 text-sm text-[#645e55] md:flex">
          <Link href={`${prefix}/#product`} className="transition-colors hover:text-[#171714]">{label('제품', 'product')}</Link>
          <Link href={`${prefix}/#workflow`} className="transition-colors hover:text-[#171714]">{label('워크플로우', 'workflow')}</Link>
          <Link href={`${prefix}/#gallery`} className="transition-colors hover:text-[#171714]">{label('갤러리', 'gallery')}</Link>
          <Link href={`${prefix}/pricing`} className="transition-colors hover:text-[#171714]">{label('요금제', 'pricing')}</Link>
          <Link href={`${prefix}/blog`} className="transition-colors hover:text-[#171714]">{label('리소스', 'resources')}</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          {locale && <LocaleSwitcher />}
          <Link href={accessHref} className="hidden px-3 text-sm text-[#645e55] transition-colors hover:text-[#171714] sm:block">
            {authenticated ? label('CMS로 돌아가기', 'back_to_cms') : label('로그인', 'login')}
          </Link>
          <Link
            href={accessHref}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#171714] px-5 text-sm font-medium text-white transition hover:bg-[#302c26]"
          >
            {authenticated ? label('작업 계속하기', 'continue') : label('시작하기', 'start')}
          </Link>
        </div>
      </div>
    </header>
  )
}
