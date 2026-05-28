import Link from 'next/link'
import Image from 'next/image'

export function MarketingFooter({ authenticated = false }: { authenticated?: boolean }) {
  const accessHref = authenticated ? '/concept' : '/api/auth/google/start'

  return (
    <footer className="border-t border-[#e9e4db] bg-[#f6f4ef] pb-10 pt-16 text-[#171714]">
      <div className="mx-auto max-w-[1300px] px-5 md:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_0.7fr_0.7fr_0.9fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.05em]">
              <Image src="/shuffla-logo-mark.png" width={30} height={30} alt="Shuffla 로고" />
              Shuffla
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-[#70695f]">
              브랜드를 이해하고 카드뉴스를 제작하는 AI editorial studio.
            </p>
          </div>
          <FooterGroup title="Product" items={[['제품', '/#product'], ['갤러리', '/#gallery'], ['요금제', '/pricing']]} />
          <FooterGroup title="Resources" items={[['블로그', '/blog'], ['워크플로우', '/#workflow'], ['문의하기', 'mailto:support@shuffla.ai']]} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#847d73]">Get started</p>
            <Link href={accessHref} className="mt-5 inline-flex h-11 rounded-full bg-[#171714] px-5 text-sm font-medium text-white items-center">
              {authenticated ? 'CMS로 돌아가기' : 'Google로 시작하기'}
            </Link>
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-3 border-t border-[#e0dbd2] pt-7 text-xs text-[#847d73] sm:flex-row">
          <p>&copy; 2026 Shuffla. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-[#171714]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#171714]">Privacy</Link>
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
