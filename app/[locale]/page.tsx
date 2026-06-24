import { ArrowRight, Check } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { MarketingFooter } from '../components/MarketingFooter'
import { MarketingNav } from '../components/MarketingNav'
import { CapabilityObjects, ConnectedWorkflow, ProductShowcase } from '../components/LandingProductShowcase'
import { LandingHero } from '../components/LandingHero'
import { FadeUp, ScaleIn } from '../components/ScrollAnimations'
import { getSessionUser } from '../../lib/auth/user'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Shuffla — AI Video Card News Generator' : 'Shuffla — AI 영상 카드뉴스 생성기',
    description: isEn
      ? 'Create video card news and image card news from a URL and topic. AI plans the story, writes copy, prepares video prompts, creates visuals, and exports social-ready content.'
      : 'URL과 주제를 입력하면 AI가 영상 카드뉴스 기획, 카피, 영상 프롬프트, 이미지 카드뉴스 비주얼을 자동 생성합니다.',
    alternates: {
      canonical: `${base}/${locale}`,
      languages: { ko: `${base}/ko`, en: `${base}/en`, 'x-default': `${base}/ko` },
    },
    openGraph: {
      title: isEn ? 'Shuffla — AI Video Card News Generator' : 'Shuffla — AI 영상 카드뉴스 생성기',
      description: isEn
        ? 'Generate connected video card news scripts, video prompts, and social-ready card news from one brief.'
        : '하나의 주제로 연결감 있는 영상 카드뉴스 기획, 프롬프트, 카드뉴스 콘텐츠를 생성합니다.',
      url: `${base}/${locale}`,
      locale: isEn ? 'en_US' : 'ko_KR',
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: isEn ? 'Shuffla — AI Video Card News Generator' : 'Shuffla — AI 영상 카드뉴스 생성기' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'Shuffla — AI Video Card News Generator' : 'Shuffla — AI 영상 카드뉴스 생성기',
      description: isEn
        ? 'Create video card news, video prompts, AI copy, visuals, and social-ready exports.'
        : '영상 카드뉴스, 프롬프트, AI 카피, 비주얼을 한 번에 생성합니다.',
      images: [`${base}/og-image.png`],
      site: '@shuffla_io',
    },
    keywords: isEn
      ? ['AI video card news generator', 'video card news maker', 'AI video prompt generator', 'AI card news generator', 'Instagram carousel video', 'short form content generator', 'social media content SaaS']
      : ['AI 영상 카드뉴스 생성기', '영상 카드뉴스 만들기', '영상 프롬프트', '카드뉴스 자동 생성', 'AI 카드뉴스', '숏폼 콘텐츠 생성', 'SNS 콘텐츠 자동화', '셔플라'],
  }
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/concept`
  const t = await getTranslations('landing')
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Shuffla',
        applicationCategory: ['VideoEditingApplication', 'DesignApplication', 'BusinessApplication'],
        operatingSystem: 'Web',
        url: `${base}/${locale}`,
        description: isEn
          ? 'AI video card news generator: enter a URL and topic to generate connected video card news planning, copy, video prompts, image card news visuals, and social-ready exports.'
          : 'URL과 주제를 입력하면 연결감 있는 영상 카드뉴스 기획, 카피, 영상 프롬프트, 이미지 카드뉴스 비주얼을 생성하는 AI SaaS.',
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
          ? ['Video card news story planning', 'video prompt generation', 'Brand URL analysis', 'AI copy generation', 'AI background image generation', '4:5 Instagram card news export', 'Card news editing studio']
          : ['영상 카드뉴스 스토리 기획', '영상 프롬프트 생성', '브랜드 URL 분석', 'AI 카피 자동 생성', 'AI 배경 이미지 생성', '4:5 인스타그램 카드뉴스 내보내기', '카드뉴스 편집 스튜디오'],
        knowsAbout: isEn
          ? ['video card news', 'AI video generation', 'Instagram carousel', 'AI social content', 'card news design']
          : ['영상 카드뉴스', '영상 생성', '인스타그램 카드뉴스', 'AI SNS 콘텐츠', '카드뉴스 디자인'],
        slogan: isEn ? 'From topic to video card news in minutes' : '주제에서 영상 카드뉴스까지 몇 분 안에',
      },
      {
        '@type': 'FAQPage',
        mainEntity: isEn ? [
          { '@type': 'Question', name: 'What is Shuffla?', acceptedAnswer: { '@type': 'Answer', text: 'Shuffla is an AI video card news and card news generator. Enter a brand URL and topic — AI plans the storyline, writes copy, prepares video prompts, creates visuals, and helps export social-ready content.' } },
          { '@type': 'Question', name: 'Can Shuffla generate video card news?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Shuffla creates editable video card news plans with connected scene prompts designed for AI video generation, plus scripts and slide copy for each card.' } },
          { '@type': 'Question', name: 'How do I generate card news?', acceptedAnswer: { '@type': 'Answer', text: 'Enter your brand URL and a topic. AI automatically generates slide structure, copy, video prompts, and background visuals. Edit and download in minutes.' } },
          { '@type': 'Question', name: 'Is it free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. 2 free card news generations are included with no payment required. Upgrade to Creator (₩25,000/mo) for 20 per month.' } },
          { '@type': 'Question', name: 'What size does Shuffla export?', acceptedAnswer: { '@type': 'Answer', text: '1080×1350px (4:5 ratio) PNG — the standard size for Instagram feed posts.' } },
        ] : [
          { '@type': 'Question', name: 'Shuffla란 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: 'Shuffla는 AI 영상 카드뉴스 및 카드뉴스 생성 SaaS입니다. URL과 주제를 입력하면 AI가 스토리라인, 카피, 영상 프롬프트, 비주얼을 생성합니다.' } },
          { '@type': 'Question', name: '영상 카드뉴스를 만들 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '네. Shuffla는 영상 생성에 맞춘 연결형 장면 프롬프트, 슬라이드별 스크립트, 제목과 본문을 생성하고 사용자가 직접 수정할 수 있게 합니다.' } },
          { '@type': 'Question', name: '카드뉴스를 어떻게 생성하나요?', acceptedAnswer: { '@type': 'Answer', text: '브랜드 URL과 주제를 입력하면 AI가 슬라이드 구성, 카피, 영상 프롬프트, 배경 비주얼을 자동으로 만듭니다. 몇 분 안에 편집하고 다운로드할 수 있습니다.' } },
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
