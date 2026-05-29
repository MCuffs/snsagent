import { MarketingFooter } from '../../components/MarketingFooter'
import { MarketingNav } from '../../components/MarketingNav'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Privacy — Shuffla' : 'Privacy — Shuffla',
    description: locale === 'en' ? 'Shuffla privacy policy' : 'Shuffla 개인정보 처리 안내',
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const t = await getTranslations('privacy')

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />
      <section className="mx-auto max-w-3xl px-5 py-20 md:px-8 md:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Privacy</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-5xl">{t('title')}</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-[#625c53]">
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
        </div>
      </section>
      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
