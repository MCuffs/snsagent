import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MarketingFooter } from './components/MarketingFooter'
import { MarketingNav } from './components/MarketingNav'
import { CapabilityObjects, ConnectedWorkflow, EditorialGallery, ProductShowcase } from './components/LandingProductShowcase'
import ThinkingDataProvider from './components/ThinkingDataProvider'
import { getSessionUser } from '../lib/auth/user'

export async function generateMetadata() {
  const t = await getTranslations('landing')
  return {
    title: 'Shuffla - AI Card News Studio',
    description: t('hero_desc').replace(/\n/g, ' '),
  }
}

export default async function LandingPage() {
  const authenticated = Boolean(await getSessionUser())
  const accessHref = authenticated ? '/concept' : '/login'
  const t = await getTranslations('hero')
  const tLanding = await getTranslations('landing')

  return (
    <>
      <ThinkingDataProvider locale="ko" />
      <main className="min-h-screen bg-[#fbfaf7] text-[#171714] selection:bg-[#ec6238]/15">
        <MarketingNav authenticated={authenticated} />

        <section className="relative overflow-hidden pb-24 pt-16 md:pb-32 md:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[560px] w-[880px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(237,101,57,0.075),transparent_66%)]" />
        <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-2 text-xs font-medium text-[#716a60]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
            {tLanding('badge')}
          </div>
          <h1 className="mt-8 text-[clamp(3.3rem,9.2vw,7.8rem)] font-semibold leading-[0.94] tracking-[-0.075em] text-[#171714]">
            {t('title_line1')}
            <br />
            {t('title_line2')}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-8 text-[#746e65] md:text-lg">
            {t('desc')}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={accessHref}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-7 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#302c26]"
            >
              {authenticated ? t('cta_authenticated') : t('cta_start')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#product"
              className="inline-flex h-12 items-center rounded-full border border-[#dfd9ce] bg-white px-7 text-sm font-medium text-[#342f29] transition hover:border-[#bfb7ab]"
            >
              {t('view_product')}
            </a>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs text-[#857e73]">
            {([t('feature_brand'), t('feature_ai'), t('feature_download')] as string[]).map(item => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#ed6238]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <EditorialGallery />
      </section>

      <ProductShowcase authenticated={authenticated} />
      <CapabilityObjects />
      <ConnectedWorkflow />

      <section className="px-5 pb-24 md:px-8 md:pb-32">
        <div className="mx-auto max-w-[1300px] overflow-hidden rounded-[30px] border border-[#e6dfd5] bg-white px-6 py-16 text-center md:px-10 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">{t('cta_section_eyebrow')}</p>
          <h2 className="mx-auto mt-6 max-w-3xl text-[clamp(2.35rem,5vw,4.5rem)] font-semibold leading-[1.08] tracking-[-0.065em]">
            {t('cta_section_title_line1')}
            <br />
            {t('cta_section_title_line2')}
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
            {t('cta_section_desc')}
          </p>
          <Link
            href={accessHref}
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#db552d]"
          >
            {authenticated ? t('cta_authenticated_bottom') : t('cta_google')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

        <MarketingFooter authenticated={authenticated} />
      </main>
    </>
  )
}
