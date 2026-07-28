import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { ArrowRight, Check, Mail, MessageSquareQuote, Scissors, Search, ShieldCheck } from 'lucide-react'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  const t = await getTranslations('pricing')
  return {
    title: t('meta_title'),
    description: isEn
      ? 'Shuffla pricing for card news, YouTube Automation, and Shorts-Labs. Try Shorts-Labs once free; paid plans include up to 60 remixes per month.'
      : '카드뉴스, 유튜브 자동화, Shorts-Labs를 위한 Shuffla 요금제. Shorts-Labs는 1회 무료 체험 후 유료 플랜에서 월 최대 60회 이용할 수 있습니다.',
    alternates: {
      canonical: `${base}/${locale}/pricing`,
      languages: { ko: `${base}/ko/pricing`, en: `${base}/en/pricing` },
    },
    openGraph: {
      title: t('meta_title'),
      description: isEn ? 'Choose the plan that fits you.' : '목적에 맞는 플랜을 선택하세요.',
      url: `${base}/${locale}/pricing`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: t('meta_title') }],
    },
  }
}

const faqs = {
  ko: [
    { q: '무료 플랜에서는 무엇을 만들 수 있나요?', a: 'Free 플랜은 결제 없이 최초 2회의 카드뉴스를 생성할 수 있습니다. 유튜브 자동화는 1일차 영상 1편을 무료로 체험할 수 있습니다. 결과 편집과 다운로드는 가능하지만 AI 재생성은 포함되지 않습니다.' },
    { q: '유튜브 자동화는 어떤 플랜에서 사용할 수 있나요?', a: 'Free 플랜에서는 유튜브 자동화 1일차 영상 1편을 무료로 체험할 수 있습니다. 30일 전체 제작은 YouTube Promo(월 9,900원), Creator, Studio 플랜에서 이용할 수 있습니다.' },
    { q: 'Shorts-Labs는 유튜브 자동화와 무엇이 다른가요?', a: '유튜브 자동화는 채널 주제로 30일 콘텐츠를 기획하고 스크립트·스톡 영상·TTS·자막·MP4를 제작합니다. Shorts-Labs는 인기 롱폼을 탐색하고 재사용 가능 여부를 확인한 뒤 하이라이트와 인기 댓글을 숏폼으로 재구성하는 별도 기능입니다.' },
    { q: 'Shorts-Labs는 어떤 플랜에서 사용할 수 있나요?', a: '모든 계정에 1회 무료 체험이 제공됩니다. YouTube Promo, Creator, Studio 플랜에서는 일 10회·월 60회까지 이용할 수 있습니다.' },
    { q: '유튜브 자동화로 만들어진 영상의 저작권은 누구에게 있나요?', a: 'Shuffla가 생성·합성한 영상의 저작권은 사용자에게 있습니다. 스톡 영상은 Pexels의 무료 라이선스를 기반으로 제공됩니다.' },
    { q: 'AI가 만든 카드뉴스를 직접 수정할 수 있나요?', a: '네. 생성된 문구와 레이아웃은 직접 편집할 수 있습니다.' },
    { q: '브랜드가 여러 개인 경우에도 사용할 수 있나요?', a: '현재는 계정당 브랜드 1개를 지원합니다. 여러 브랜드 도입은 별도 문의로 확인해 주세요.' },
    { q: '플랜 간 차이는 무엇인가요?', a: '무료 사용자는 최초 2회 카드뉴스, 유튜브 자동화 1일차, Shorts-Labs 1회 체험을 이용합니다. YouTube Promo는 유튜브 자동화와 Shorts-Labs 전용이며, Creator는 월 20회, Studio는 월 30회 카드뉴스 생성까지 함께 제공합니다.' },
    { q: '로그인만 하면 바로 생성할 수 있나요?', a: 'Google Login으로 브랜드 설정을 시작하면 결제 없이 최초 2회의 카드뉴스를 생성할 수 있습니다.' },
    { q: '플랜은 언제든지 변경할 수 있나요?', a: '현재 구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 이후 원하는 새 플랜을 선택할 수 있습니다.' },
    { q: '결제는 어디에서 진행되나요?', a: 'Google Login 후 브랜드를 설정하면 요금제 화면에서 결제를 진행할 수 있습니다.' },
  ],
  en: [
    { q: 'What can I create with the free plan?', a: 'The Free plan lets you create 2 card news in total without payment. YouTube automation includes a free trial for day 1 (1 video). AI regeneration is not included.' },
    { q: 'Which plan includes YouTube Automation?', a: 'The Free plan includes one YouTube Automation video for day 1. The full 30-day workflow is included with YouTube Promo (₩9,900/mo), Creator, and Studio.' },
    { q: 'How is Shorts-Labs different from YouTube Automation?', a: 'YouTube Automation plans 30 days from a channel topic and produces scripts, stock footage, TTS, subtitles, and MP4s. Shorts-Labs separately discovers trending long-form videos, checks reuse eligibility, and remixes highlights and popular comments into short-form concepts.' },
    { q: 'Which plan includes Shorts-Labs?', a: 'Every account gets one free Shorts-Labs trial. YouTube Promo, Creator, and Studio include up to 10 uses per day and 60 per month.' },
    { q: 'Who owns the copyright on AI-generated videos?', a: 'Copyright of the videos generated and composited by Shuffla belongs to the user. Stock footage is provided under the Pexels free license.' },
    { q: 'Can I edit the AI-generated card news?', a: 'Yes. You can edit the copy and layout directly after generation.' },
    { q: 'Can I use it with multiple brands?', a: 'Currently one brand per account is supported. Contact us for multi-brand inquiries.' },
    { q: 'What are the differences between plans?', a: 'Free users get 2 card news, YouTube Automation day 1, and one Shorts-Labs trial. YouTube Promo is dedicated to YouTube Automation and Shorts-Labs, while Creator adds 20 card news/month and Studio adds 30/month.' },
    { q: 'Can I start creating immediately after logging in?', a: 'Yes. After Google Login and brand setup, you can create 2 card news in total without payment.' },
    { q: 'Can I change plans at any time?', a: 'Canceling your current subscription reverts access immediately. You can then choose a new plan.' },
    { q: 'Where do I complete payment?', a: 'After Google Login and brand setup, the billing screen lets you select and pay for your plan.' },
  ],
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const accessHref = authenticated ? `/${locale}/billing` : `/${locale}/login`
  const t = await getTranslations('pricing')
  const isEn = locale === 'en'

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (isEn ? faqs.en : faqs.ko).map(faq => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  }

  const plans = [
    {
      key: 'free',
      name: 'Free',
      price: isEn ? '$0' : '₩0',
      priceNote: isEn ? 'free' : '무료',
      features: isEn
        ? ['2 card news in total', 'Video card news not included', '30-day history', 'Brand URL analysis', 'Up to 4 reference images', 'Edit & download results', 'YouTube Shorts trial (day 1 only)']
        : ['최초 2회 카드뉴스 생성', '영상 카드뉴스 미포함', '작업 히스토리 30일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', '결과 편집 및 다운로드', '유튜브 자동화 체험 (1일차 1편)'],
      cta: isEn ? 'Get started' : '무료로 시작하기',
      highlight: false,
      mobileOrderClass: 'order-3 md:order-none',
    },
    {
      key: 'youtube',
      name: 'YouTube Promo',
      price: '₩9,900',
      priceNote: isEn ? '/ mo' : '/ 월',
      features: isEn
        ? ['YouTube Automation — full 30 days', 'AI scripts, TTS, subtitles & MP4', 'Shorts-Labs — 60 remixes/mo', 'Up to 3 saved work histories', '30-day work history retention', 'Card news generation not included']
        : ['유튜브 자동화 30일 전체', 'AI 스크립트·TTS·자막·MP4', 'Shorts-Labs 월 60회', '작업 히스토리 최대 3개', '작업 히스토리 30일 보관', '카드뉴스 생성 미포함'],
      cta: isEn ? 'Get started' : '시작하기',
      highlight: false,
      badge: isEn ? 'Promo' : '프로모션',
      mobileOrderClass: 'order-2 md:order-none',
    },
    {
      key: 'creator',
      name: 'Creator',
      price: '₩25,000',
      priceNote: isEn ? '/ mo' : '/ 월',
      features: isEn
        ? ['20 card news per month', '90-day history', 'Brand URL analysis', 'Up to 4 reference images', 'AI copy & image generation', '1 AI background regen/campaign', 'Edit & download results', 'YouTube Automation — full 30 days', 'Shorts-Labs — 60 remixes/mo']
        : ['월 20회 카드뉴스 생성', '작업 히스토리 90일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', 'AI 문구·이미지 생성', '캠페인별 AI 배경 재생성 1회분', '결과 편집 및 다운로드', '유튜브 자동화 30일 전체', 'Shorts-Labs 월 60회'],
      cta: isEn ? 'Get started' : '시작하기',
      highlight: true,
      badge: isEn ? 'Most Popular' : '가장 인기',
      mobileOrderClass: 'order-1 md:order-none',
    },
    {
      key: 'studio',
      name: 'Studio',
      price: '₩39,000',
      priceNote: isEn ? '/ mo' : '/ 월',
      features: isEn
        ? ['30 card news per month', '365-day history', 'Brand URL analysis', 'Up to 4 reference images', 'AI copy & image generation', '1 AI background regen/campaign', 'Edit & download results', 'YouTube Automation — full 30 days', 'Shorts-Labs — 60 remixes/mo']
        : ['월 30회 카드뉴스 생성', '작업 히스토리 365일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', 'AI 문구·이미지 생성', '캠페인별 AI 배경 재생성 1회분', '결과 편집 및 다운로드', '유튜브 자동화 30일 전체', 'Shorts-Labs 월 60회'],
      cta: isEn ? 'Get started' : '시작하기',
      highlight: false,
      mobileOrderClass: 'order-4 md:order-none',
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      price: isEn ? 'Custom' : '별도 문의',
      priceNote: isEn ? 'annual' : '연간',
      features: isEn
        ? ['All Studio features +', 'Custom volume', 'Priority support', 'Migration & onboarding', 'Account management', 'YouTube Automation & Shorts-Labs included']
        : ['Studio 기능 전체 포함', '대량 제작 맞춤 설정', '우선 지원', '온보딩 및 마이그레이션', '전담 계정 관리', '유튜브 자동화·Shorts-Labs 포함'],
      cta: isEn ? 'Contact sales' : '도입 문의하기',
      highlight: false,
      isEnterprise: true,
      mobileOrderClass: 'order-5 md:order-none',
    },
  ]

  const faqList = isEn ? faqs.en : faqs.ko

  const ytRows = isEn
    ? [
        { feature: 'AI script generation', free: 'Day 1 only', promo: '30 days', creator: '30 days', studio: '30 days', enterprise: '30 days' },
        { feature: 'AI voiceover (TTS)', free: 'Day 1 only', promo: '30 days', creator: '30 days', studio: '30 days', enterprise: '30 days' },
        { feature: 'Auto video editing', free: 'Day 1 only', promo: '30 days', creator: '30 days', studio: '30 days', enterprise: '30 days' },
        { feature: 'Subtitle rendering', free: 'Day 1 only', promo: '30 days', creator: '30 days', studio: '30 days', enterprise: '30 days' },
        { feature: 'Download (9:16 MP4)', free: 'Day 1 only', promo: '30 days', creator: '30 days', studio: '30 days', enterprise: '30 days' },
      ]
    : [
        { feature: 'AI 스크립트 자동 생성', free: '1일차만', promo: '30일 전체', creator: '30일 전체', studio: '30일 전체', enterprise: '30일 전체' },
        { feature: 'AI 보이스오버 (TTS)', free: '1일차만', promo: '30일 전체', creator: '30일 전체', studio: '30일 전체', enterprise: '30일 전체' },
        { feature: '자동 영상 편집', free: '1일차만', promo: '30일 전체', creator: '30일 전체', studio: '30일 전체', enterprise: '30일 전체' },
        { feature: '자막 렌더링', free: '1일차만', promo: '30일 전체', creator: '30일 전체', studio: '30일 전체', enterprise: '30일 전체' },
        { feature: '다운로드 (9:16 MP4)', free: '1일차만', promo: '30일 전체', creator: '30일 전체', studio: '30일 전체', enterprise: '30일 전체' },
      ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a]">
        <MarketingNav authenticated={authenticated} locale={locale} />

        <main>
          {/* HEADER */}
          <section className="mx-auto max-w-[1300px] px-6 pb-8 pt-10 md:pb-14 md:pt-24 lg:px-10 lg:pt-32">
            <h1 className="text-[42px] font-black tracking-[-0.045em] leading-none md:text-[72px]">
              {isEn ? 'Pricing' : '요금제'}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-6 text-[#525252] md:mt-5 md:text-[17px]">
              {isEn ? 'Start free. Upgrade as you grow.' : '무료로 시작하고, 필요한 만큼 업그레이드하세요.'}
            </p>
          </section>

          {/* PLANS GRID */}
          <section className="mx-auto max-w-[1300px] px-6 pb-16 md:pb-24 lg:px-10">
            <div className="mb-3 flex items-center justify-between md:hidden">
              <p className="text-[12px] font-bold text-[#71717a]">
                {isEn ? 'Swipe to compare plans' : '옆으로 넘겨 요금제 비교'}
              </p>
              <span className="inline-flex items-center gap-1 text-[12px] font-black text-[#ff6b35]">
                {isEn ? 'More' : '더 보기'}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:gap-px md:overflow-hidden md:rounded-[20px] md:border md:border-black/[0.07] md:bg-black/[0.07] md:p-0 lg:grid-cols-3 xl:grid-cols-5">
              {plans.map((plan) => (
                <div
                  key={plan.key}
                  className={`relative flex min-h-[455px] w-[76vw] max-w-[320px] shrink-0 snap-center flex-col rounded-[20px] border border-black/[0.07] p-5 md:min-h-0 md:w-auto md:max-w-none md:shrink md:rounded-none md:border-0 md:p-8 ${
                    plan.mobileOrderClass
                  } ${
                    plan.highlight
                      ? 'bg-[#0a0a0a] text-white'
                      : 'bg-white text-[#0a0a0a]'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute right-5 top-5 rounded-full bg-[#ff6b35] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white md:right-6 md:top-6">
                      {plan.badge}
                    </span>
                  )}

                  {/* Plan name */}
                  <p className={`pr-16 text-[20px] font-black tracking-[-0.03em] md:pr-0 md:text-[22px] ${plan.highlight ? 'text-white' : 'text-[#0a0a0a]'}`}>
                    {plan.name}
                  </p>

                  {/* Price */}
                  <div className="mt-4">
                    <div className="flex min-h-[34px] items-baseline gap-2 whitespace-nowrap md:min-h-[44px]">
                      <span className={`text-[clamp(28px,8vw,34px)] font-black tracking-[-0.035em] leading-none md:text-[clamp(28px,2.35vw,38px)] ${plan.highlight ? 'text-white' : 'text-[#0a0a0a]'}`}>
                        {plan.price}
                      </span>
                      <span className={`shrink-0 text-[13px] font-semibold leading-none ${plan.highlight ? 'text-white/50' : 'text-[#8a8a8a]'}`}>
                        {plan.priceNote}
                      </span>
                    </div>
                    {plan.key !== 'free' && plan.key !== 'enterprise' && (
                      <p className={`mt-1 text-[11px] ${plan.highlight ? 'text-white/60' : 'text-[#71717a]'}`}>
                        {isEn ? 'VAT included' : '부가세 포함'}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={`my-4 h-px md:my-6 ${plan.highlight ? 'bg-white/10' : 'bg-black/[0.07]'}`} />

                  {/* Features */}
                  <ul className="flex-1 space-y-2.5 md:space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12.5px] leading-5 md:gap-2.5 md:text-[13.5px]">
                        <Check
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 md:h-4 md:w-4 ${plan.highlight ? 'text-[#ff6b35]' : 'text-[#0a0a0a]'}`}
                          strokeWidth={2.8}
                        />
                        <span className={plan.highlight ? 'text-white/80' : 'text-[#525252]'}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <a
                    href={plan.isEnterprise ? 'mailto:admin@shuffla.io' : plan.key === 'free' ? (authenticated ? `/${locale}/concept` : `/${locale}/login`) : accessHref}
                    className={`mt-5 flex h-10 w-full items-center justify-center rounded-full text-[13px] font-bold transition-all md:mt-8 md:h-11 md:text-[14px] ${
                      plan.highlight
                        ? 'bg-white text-[#0a0a0a] hover:bg-white/90'
                        : plan.isEnterprise
                          ? 'border border-black/[0.12] bg-transparent text-[#0a0a0a] hover:bg-black/[0.04]'
                          : 'bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
              {plans.map((plan) => (
                <span
                  key={plan.key}
                  className={`h-1.5 rounded-full ${plan.highlight ? 'w-6 bg-[#0a0a0a]' : 'w-1.5 bg-black/20'}`}
                />
              ))}
            </div>
          </section>

          {/* YOUTUBE AUTOMATION SECTION */}
          <section className="mx-auto max-w-[1300px] border-t border-black/[0.07] px-6 pb-24 pt-20 lg:px-10">
            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ed6238]">
                  {isEn ? 'YouTube Automation' : '유튜브 자동화'}
                </p>
                <h2 className="mt-3 text-[28px] font-black tracking-[-0.04em] leading-tight text-[#0a0a0a] md:text-[36px]">
                  {isEn ? 'YouTube Shorts, automated daily' : '유튜브 쇼츠, 매일 자동으로'}
                </h2>
                <p className="mt-3 text-[15px] text-[#525252] max-w-lg">
                  {isEn
                    ? 'Try the day 1 video free. Unlock the full 30-day workflow with YouTube Promo, Creator, or Studio.'
                    : '1일차 영상은 무료로 체험하세요. YouTube Promo, Creator, Studio 플랜에서 30일 전체 제작이 열립니다.'}
                </p>
              </div>
              <a
                href={`/${locale}/solutions/youtube-automation`}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-black/[0.12] bg-white px-5 py-2.5 text-[13px] font-bold text-[#0a0a0a] transition-colors hover:bg-[#f5f5f5]"
              >
                {isEn ? 'Learn more →' : '자세히 보기 →'}
              </a>
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto rounded-2xl border border-black/[0.07]">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-[#f5f3ef]">
                    <th className="px-5 py-3.5 text-left text-[12px] font-black uppercase tracking-[0.1em] text-[#525252]">
                      {isEn ? 'Feature' : '기능'}
                    </th>
                    {['Free', 'YouTube Promo', 'Creator', 'Studio', 'Enterprise'].map((col, i) => (
                      <th
                        key={col}
                        className={`px-5 py-3.5 text-center text-[12px] font-black uppercase tracking-[0.1em] ${
                          i === 1 ? 'text-[#ed6238]' : 'text-[#525252]'
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] bg-white">
                  {ytRows.map((row) => (
                    <tr key={row.feature} className="hover:bg-[#faf8f5] transition-colors">
                      <td className="px-5 py-3.5 font-medium text-[#0a0a0a]">{row.feature}</td>
                      <td className="px-5 py-3.5 text-center text-[#8a8a8a]">{row.free}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-[#ed6238]">{row.promo}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-[#0a0a0a]">{row.creator}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-[#0a0a0a]">{row.studio}</td>
                      <td className="px-5 py-3.5 text-center font-bold text-[#0a0a0a]">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Upgrade nudge */}
            <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl bg-[#0a0a0a] px-7 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] font-bold text-white">
                  {isEn ? 'Start automating your YouTube channel today' : '오늘부터 유튜브 채널을 자동화하세요'}
                </p>
                <p className="mt-1 text-[13px] text-white/60">
                  {isEn ? 'YouTube Promo — ₩9,900/mo' : 'YouTube Promo — 월 9,900원'}
                </p>
              </div>
              <a
                href={accessHref}
                className="shrink-0 rounded-full bg-[#ed6238] px-6 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
              >
                {isEn ? 'Start free trial' : '무료 체험 시작'}
              </a>
            </div>
          </section>

          {/* SHORTS-LABS SECTION */}
          <section className="mx-auto max-w-[1300px] border-t border-black/[0.07] px-6 pb-24 pt-20 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[0.38fr_0.62fr] lg:gap-16">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ed6238]">
                  NEW · Shorts-Labs
                </p>
                <h2 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.04em] text-[#0a0a0a] md:text-[36px]">
                  {isEn ? 'A separate lab for remixing what is trending' : '인기 롱폼을 재구성하는 별도의 쇼츠 실험실'}
                </h2>
                <p className="mt-4 max-w-lg text-[15px] leading-7 text-[#525252]">
                  {isEn
                    ? 'Shorts-Labs is not YouTube Automation. It discovers trending long-form videos, checks whether they can be reused, and reframes highlights and popular comments as vertical short-form concepts.'
                    : 'Shorts-Labs는 유튜브 자동화와 별도 기능입니다. 인기 롱폼을 탐색하고 재사용 가능 여부를 확인한 뒤, 하이라이트와 인기 댓글을 세로형 숏폼 구성으로 재구성합니다.'}
                </p>
                <div className="mt-7 rounded-2xl border border-[#ed6238]/20 bg-[#fff7f2] p-5">
                  <p className="text-sm font-black text-[#0a0a0a]">
                    {isEn ? '1 free trial for every account' : '모든 계정에 1회 무료 체험'}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#6b625a]">
                    {isEn
                      ? 'Paid plans: up to 10 remixes/day and 60/month'
                      : '유료 플랜: 일 10회 · 월 60회까지 이용'}
                  </p>
                </div>
              </div>

              <div className="grid gap-px overflow-hidden rounded-2xl border border-black/[0.07] bg-black/[0.07] sm:grid-cols-2">
                {[
                  {
                    icon: Search,
                    title: isEn ? 'Trending discovery' : '실시간 인기 영상 탐색',
                    body: isEn ? 'Browse popular long-form videos by category.' : '카테고리별 인기 롱폼 영상을 빠르게 확인합니다.',
                  },
                  {
                    icon: ShieldCheck,
                    title: isEn ? 'Reuse eligibility' : '재사용 가능 여부 확인',
                    body: isEn ? 'Review license, length, embedding, and region conditions.' : '라이선스·길이·퍼가기·지역 제한을 검토합니다.',
                  },
                  {
                    icon: Scissors,
                    title: isEn ? 'Highlight remix' : '하이라이트 재구성',
                    body: isEn ? 'Find a key section and reframe it for a vertical layout.' : '핵심 구간을 골라 세로형 숏폼 레이아웃으로 바꿉니다.',
                  },
                  {
                    icon: MessageSquareQuote,
                    title: isEn ? 'Popular comment capture' : '인기 댓글 캡처',
                    body: isEn ? 'Bring high-engagement comments into the short-form concept.' : '반응이 높은 댓글을 숏폼 구성에 함께 반영합니다.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <article key={title} className="bg-white p-6 md:p-7">
                    <Icon className="h-5 w-5 text-[#ed6238]" />
                    <h3 className="mt-5 text-[16px] font-black tracking-[-0.025em] text-[#0a0a0a]">{title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#6b6b6b]">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mx-auto max-w-[1300px] border-t border-black/[0.07] px-6 pb-28 pt-20 lg:px-10">
            <div className="grid gap-16 lg:grid-cols-[280px_1fr]">
              {/* Left label */}
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#ff6b35]">FAQ</p>
                <h2 className="mt-4 text-[28px] font-black tracking-[-0.04em] leading-tight text-[#0a0a0a] md:text-[34px]">
                  {t('faq_title')}
                </h2>
                <a
                  href="mailto:admin@shuffla.io"
                  className="mt-8 inline-flex items-center gap-2 text-[13px] font-bold text-[#0a0a0a] hover:gap-3 transition-all"
                >
                  <Mail className="h-4 w-4" />
                  admin@shuffla.io
                </a>
              </div>

              {/* Right accordion */}
              <div className="divide-y divide-black/[0.07]">
                {faqList.map((faq, i) => (
                  <details key={i} className="group py-5 first:pt-0">
                    <summary className="flex cursor-pointer items-center justify-between gap-6 text-[15px] font-bold text-[#0a0a0a] list-none">
                      {faq.q}
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-black/[0.1] bg-white transition-transform group-open:rotate-45">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      </span>
                    </summary>
                    <p className="mt-3 text-[14px] leading-[1.75] text-[#525252]">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter authenticated={authenticated} locale={locale} />
      </div>
    </>
  )
}
