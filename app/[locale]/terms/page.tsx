import { MarketingFooter } from '../../components/MarketingFooter'
import { MarketingNav } from '../../components/MarketingNav'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Terms — Shuffla' : 'Terms — Shuffla',
    description: locale === 'en' ? 'Shuffla terms of service' : 'Shuffla 서비스 이용약관',
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const t = await getTranslations('terms')

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Terms</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">{t('title')}</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[#625c53]">
          <p className="text-xs text-[#847d73]">{t('effective')}</p>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s1_title')}</h2>
            <p className="mt-3">{t('s1_body')}</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s2_title')}</h2>
            <p className="mt-3">{t('s2_body')}</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s3_title')}</h2>
            <p className="mt-3">{t('s3_body')}</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s4_title')}</h2>
            <p className="mt-3">{t('s4_body')}</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s5_title')}</h2>
            <p className="mt-3">{t('s5_body')}</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[#171714]">{t('s6_title')}</h2>
            <p className="mt-3">{t('s6_body')}</p>
            <div className="mt-4 flex gap-4">
              <a href="mailto:alstnwjd0424@gmail.com" className="text-[#171714] font-medium hover:underline">alstnwjd0424@gmail.com</a>
              <a href="https://www.instagram.com/shuffla.io/" target="_blank" rel="noopener noreferrer" className="text-[#171714] font-medium hover:underline">@shuffla.io</a>
            </div>
          </section>
        </div>
      </section>
      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
