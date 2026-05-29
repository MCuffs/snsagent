import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

interface MarketingFooterProps {
  authenticated?: boolean
  locale?: string
}

export async function MarketingFooter({ authenticated = false, locale }: MarketingFooterProps) {
  const prefix = locale ? `/${locale}` : ''
  const accessHref = authenticated ? `${prefix}/concept` : '/api/auth/google/start'

  let t: Awaited<ReturnType<typeof getTranslations>> | null = null
  try {
    t = await getTranslations('footer')
  } catch {
    // Outside i18n context, fall back
  }

  const label = (ko: string, key: string) => (t ? (t as (k: string) => string)(key) : ko)

  return (
    <footer className="border-t border-[#e9e4db] bg-[#f6f4ef] pb-10 pt-16 text-[#171714]">
      <div className="mx-auto max-w-[1300px] px-5 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.9fr]">
          <div>
            <Link href={`${prefix}/`} className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.05em]">
              <Image src="/shuffla-logo-mark.png" width={30} height={30} alt="Shuffla 로고" />
              Shuffla
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#70695f]">
              {label('브랜드를 이해하고 카드뉴스를 제작하는 AI editorial studio.', 'tagline')}
            </p>
          </div>
          <FooterGroup
            title={label('Product', 'product')}
            items={[
              [label('제품', 'product'), `${prefix}/#product`],
              [label('갤러리', 'gallery'), `${prefix}/#gallery`],
              [label('요금제', 'pricing'), `${prefix}/pricing`],
            ]}
          />
          <FooterGroup
            title={label('Resources', 'resources')}
            items={[
              [label('블로그', 'blog'), `${prefix}/blog`],
              [label('워크플로우', 'workflow'), `${prefix}/#workflow`],
              [label('문의하기', 'contact'), 'mailto:support@shuffla.ai'],
            ]}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#847d73]">Get started</p>
            <Link href={accessHref} className="mt-5 inline-flex h-11 rounded-full bg-[#171714] px-5 text-sm font-medium text-white items-center">
              {authenticated ? label('CMS로 돌아가기', 'back_to_cms') : label('Google로 시작하기', 'start_google')}
            </Link>
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-3 border-t border-[#e0dbd2] pt-7 text-xs text-[#847d73] sm:flex-row">
          <p>&copy; 2026 Shuffla. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href={`${prefix}/terms`} className="hover:text-[#171714]">Terms</Link>
            <Link href={`${prefix}/privacy`} className="hover:text-[#171714]">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterGroup({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#847d73]">{title}</p>
      <ul className="mt-5 space-y-3 text-sm text-[#70695f]">
        {items.map(([label, href]) => (
          <li key={label}><Link href={href} className="transition-colors hover:text-[#171714]">{label}</Link></li>
        ))}
      </ul>
    </div>
  )
}
