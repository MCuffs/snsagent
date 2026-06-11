import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNav } from '../components/MarketingNav'
import { CapabilityObjects, ConnectedWorkflow, EditorialGallery, ProductShowcase } from '../components/LandingProductShowcase'
import { LandingHero } from '../components/LandingHero'
import { FadeUp, SlideIn, ScaleIn } from '../components/ScrollAnimations'
import { getSessionUser } from '../../lib/auth/user'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Shuffla — AI Card News Generator' : 'Shuffla — AI 카드뉴스 생성기',
    description: isEn
      ? 'Generate 5 card news slides automatically from a URL and topic. AI writes copy, creates images, and exports 4:5 PNG. 2 free generations.'
      : 'URL과 주제를 입력하면 AI가 카피·이미지·레이아웃을 자동 생성합니다. 무료 2회 제공.',
    alternates: {
      canonical: `${base}/${locale}`,
      languages: { ko: `${base}/ko`, en: `${base}/en` },
    },
    openGraph: {
      title: isEn ? 'Shuffla — AI Card News Generator' : 'Shuffla — AI 카드뉴스 생성기',
      description: isEn
        ? 'Generate 5 card news slides automatically from a URL and topic.'
        : 'URL과 주제를 입력하면 카드뉴스 5장이 자동으로 완성됩니다.',
      url: `${base}/${locale}`,
      locale: isEn ? 'en_US' : 'ko_KR',
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: isEn ? 'Shuffla — AI Card News Generator' : 'Shuffla — AI 카드뉴스 생성기' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'Shuffla — AI Card News Generator' : 'Shuffla — AI 카드뉴스 생성기',
      description: isEn
        ? 'Generate 5 card news slides automatically. AI copy, images, and 4:5 export.'
        : 'URL과 주제 입력만으로 카드뉴스 5장이 자동 완성됩니다.',
      images: [`${base}/og-image.png`],
      site: '@shuffla_io',
    },
    keywords: isEn
      ? ['AI card news generator', 'card news maker', 'automated card news', 'social media content tool', 'AI image generator', 'card news SaaS', 'Instagram card news']
      : ['AI 카드뉴스 생성기', '카드뉴스 자동 생성', '카드뉴스 만들기', 'AI 카드뉴스', 'SNS 콘텐츠 자동화', '카드뉴스 SaaS', '셔플라'],
  }
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = authenticated ? `/${locale}/concept` : `/${locale}/login`
  const t = await getTranslations('landing')
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Shuffla',
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web',
        url: `${base}/${locale}`,
        description: isEn
          ? 'AI card news generator: enter a URL and topic, get 5 finished slides with copy, images, and 4:5 PNG export.'
          : 'URL과 주제를 입력하면 카피·이미지·레이아웃이 완성된 카드뉴스 5장을 즉시 생성하는 AI SaaS.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
          description: isEn ? 'Free plan available — 2 card news included' : '무료 플랜 제공 — 카드뉴스 2회 포함',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Shuffla',
          url: base,
          contactPoint: { '@type': 'ContactPoint', email: 'admin@shuffla.io', contactType: 'customer support' },
          sameAs: ['https://www.instagram.com/shuffla.io/'],
        },
        featureList: isEn
          ? ['Brand URL analysis', 'AI copy generation', 'AI background image generation', '4:5 Instagram card news export', 'Card news editing studio']
          : ['브랜드 URL 분석', 'AI 카피 자동 생성', 'AI 배경 이미지 생성', '4:5 인스타그램 카드뉴스 내보내기', '카드뉴스 편집 스튜디오'],
      },
      {
        '@type': 'FAQPage',
        mainEntity: isEn ? [
          { '@type': 'Question', name: 'What is Shuffla?', acceptedAnswer: { '@type': 'Answer', text: 'Shuffla is an AI card news generator. Enter a brand URL and topic — AI instantly generates 5 slides with copy, background images, and a downloadable 4:5 PNG set.' } },
          { '@type': 'Question', name: 'How do I generate card news?', acceptedAnswer: { '@type': 'Answer', text: 'Enter your brand URL and a topic. AI automatically generates slide structure, copy, and background images. Edit and download in minutes.' } },
          { '@type': 'Question', name: 'Is it free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. 2 free card news generations are included with no payment required. Upgrade to Creator (₩25,000/mo) for 20 per month.' } },
          { '@type': 'Question', name: 'What size does Shuffla export?', acceptedAnswer: { '@type': 'Answer', text: '1080×1350px (4:5 ratio) PNG — the standard size for Instagram feed posts.' } },
        ] : [
          { '@type': 'Question', name: 'Shuffla란 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: 'Shuffla는 AI 카드뉴스 생성 SaaS입니다. URL과 주제를 입력하면 AI가 카피·이미지·레이아웃이 완성된 슬라이드 5장을 즉시 생성합니다.' } },
          { '@type': 'Question', name: '카드뉴스를 어떻게 생성하나요?', acceptedAnswer: { '@type': 'Answer', text: '브랜드 URL과 주제를 입력하면 AI가 슬라이드 구성, 카피, 배경 이미지를 자동으로 만듭니다. 몇 분 안에 편집하고 다운로드할 수 있습니다.' } },
          { '@type': 'Question', name: '무료로 사용할 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '네. 무료 2회 제공, 신용카드 불필요. 월 20회가 필요하면 Creator 플랜(월 25,000원)으로 업그레이드하세요.' } },
          { '@type': 'Question', name: '어떤 이미지 사이즈로 내보내기 되나요?', acceptedAnswer: { '@type': 'Answer', text: '1080×1350px (4:5 비율) PNG로 내보냅니다. 인스타그램 피드 게시물 표준 사이즈입니다.' } },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="text-[#171714] selection:bg-[#ec6238]/15">
      <MarketingNav authenticated={authenticated} locale={locale} />

      {/* ── 새 히어로 (블랙 배경 + 카드 갤러리) ── */}
      <LandingHero
        authenticated={authenticated}
        accessHref={accessHref}
        locale={locale}
        headline={t('hero_title')}
        sub={t('hero_desc')}
        ctaStart={t('cta_start')}
        ctaContinue={t('cta_continue')}
        ctaFreeHint={t('cta_free_hint')}
        badgeText={t('badge')}
      />

      {/* ── 이하 기존 섹션들 (밝은 배경으로 전환) ── */}
      <div className="bg-white">

        {/* 피처 배지 행 */}
        <FadeUp className="border-b border-slate-100">
          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-3 px-5 py-8 text-xs text-[#857e73]">
            {[t('feature_brand'), t('feature_ai'), t('feature_download')].map(item => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#ed6238]" />
                {item}
              </span>
            ))}
          </div>
        </FadeUp>

        <ProductShowcase authenticated={authenticated} />
        <CapabilityObjects />
        <ConnectedWorkflow />

        {/* 하단 CTA 섹션 */}
        <section className="px-5 pb-24 md:px-8 md:pb-32">
          <ScaleIn>
            <div className="mx-auto max-w-[1300px] overflow-hidden rounded-[30px] border border-[#e6dfd5] bg-white px-6 py-16 text-center md:px-10 md:py-24">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">{t('cta_section_eyebrow')}</p>
              <h2 className="mx-auto mt-6 max-w-3xl text-[clamp(2.35rem,5vw,4.5rem)] font-semibold leading-[1.08] tracking-[-0.065em] whitespace-pre-line">
                {t('cta_section_title')}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
                {t('cta_section_desc')}
              </p>
              <Link
                href={accessHref}
                className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#db552d]"
              >
                {authenticated ? t('cta_continue') : t('cta_google')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScaleIn>
        </section>

      </div>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
    </>
  )
}
