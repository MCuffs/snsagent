import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

interface MarketingFooterProps {
  authenticated?: boolean
  locale?: string
}

export async function MarketingFooter({ authenticated = false, locale }: MarketingFooterProps) {
  const prefix = locale ? `/${locale}` : ''
  const accessHref = `${prefix}/concept`

  let t: Awaited<ReturnType<typeof getTranslations>> | null = null
  try {
    t = await getTranslations('footer')
  } catch {
    // Outside i18n context, fall back
  }

  const label = (ko: string, key: string) => (t ? (t as (k: string) => string)(key) : ko)
  const showKoreanBusinessInfo = locale === 'ko'

  return (
    <footer className="border-t border-[#e5e7eb] bg-[#f9fafb] pb-10 pt-16 text-[#111111]">
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
              [label('문의하기', 'contact'), 'mailto:admin@shuffla.io'],
            ]}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#847d73]">Get started</p>
            <Link href={accessHref} className="mt-5 inline-flex h-11 rounded-full bg-[#171714] px-5 text-sm font-medium text-white items-center">
              {authenticated ? label('CMS로 돌아가기', 'back_to_cms') : label('Google로 시작하기', 'start_google')}
            </Link>
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-3 border-t border-slate-200 pt-7 text-xs text-[#847d73] sm:flex-row">
          <p>&copy; 2026 Shuffla. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href={`${prefix}/terms`} className="hover:text-[#171714]">
              {showKoreanBusinessInfo ? '이용약관' : 'Terms'}
            </Link>
            <Link href={`${prefix}/privacy`} className="hover:text-[#171714]">
              {showKoreanBusinessInfo ? '개인정보처리방침' : 'Privacy'}
            </Link>
            <Link href={`${prefix}/refund`} className="hover:text-[#171714]">
              {showKoreanBusinessInfo ? '환불 정책' : 'Refund Policy'}
            </Link>
          </div>
        </div>
        {showKoreanBusinessInfo && (
          <div className="mt-6 border-t border-slate-200 pt-6 text-xs leading-6 text-[#847d73]">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              <BusinessInfoItem label="상호" value="파랑버섯 스튜디오" />
              <BusinessInfoItem label="대표자명" value="정민수" />
              <BusinessInfoItem label="사업자등록번호" value="354-14-0333" />
              <BusinessInfoItem label="주소" value="서울특별시 영등포구 양평로 22나길 7-1" />
              <BusinessInfoItem label="전화번호" value="010-8777-0605" />
              <BusinessInfoItem label="이메일" value="admin@shuffla.io" />
              <BusinessInfoItem label="통신판매업 신고번호" value="2026-서울영등포-1320호" />
            </dl>
          </div>
        )}
      </div>
    </footer>
  )
}

function BusinessInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-semibold text-[#70695f]">{label} :</dt>
      <dd>{value}</dd>
    </div>
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
