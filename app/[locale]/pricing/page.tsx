import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { Check, ArrowRight } from 'lucide-react'
import { PRICING_PLANS } from '../../../lib/limits-types'
import { getSessionUser } from '../../../lib/auth/user'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('pricing')
  return {
    title: t('meta_title'),
    description: t('desc'),
  }
}

const faqs = {
  ko: [
    { q: '무료 플랜에서는 무엇을 만들 수 있나요?', a: 'Free 플랜은 결제 없이 하루에 카드뉴스 1세트를 생성할 수 있습니다. 결과 편집과 다운로드는 가능하지만 AI 재생성은 포함되지 않습니다.' },
    { q: '무료 결과물을 다시 생성하고 싶으면 어떻게 하나요?', a: '결과 화면에서 AI 재생성을 선택하면 3,000원 1회 이용권을 안내합니다.' },
    { q: 'AI가 만든 카드뉴스를 직접 수정할 수 있나요?', a: '네. 생성된 문구와 레이아웃은 직접 편집할 수 있습니다.' },
    { q: '브랜드가 여러 개인 경우에도 사용할 수 있나요?', a: '현재는 계정당 브랜드 1개를 지원합니다. 여러 브랜드 도입은 별도 문의로 확인해 주세요.' },
    { q: '플랜 간 차이는 무엇인가요?', a: '무료 사용자는 하루 1회 생성과 30일 보관을 이용합니다. Creator는 월 20회, Studio는 월 30회 생성이 가능하며 유료 플랜에는 AI 배경 재생성이 포함됩니다.' },
    { q: '로그인만 하면 바로 생성할 수 있나요?', a: 'Google Login으로 브랜드 설정을 시작하면 결제 없이 하루 한 번 카드뉴스를 생성할 수 있습니다.' },
    { q: '플랜은 언제든지 변경할 수 있나요?', a: '현재 구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 이후 원하는 새 플랜을 선택할 수 있습니다.' },
    { q: '결제는 어디에서 진행되나요?', a: 'Google Login 후 브랜드를 설정하면 요금제 화면에서 결제를 진행할 수 있습니다.' },
  ],
  en: [
    { q: 'What can I create with the free plan?', a: 'The Free plan lets you create one card news set per day without payment. You can edit and download results, but AI regeneration is not included.' },
    { q: 'What if I want to regenerate a free result?', a: 'Select AI Regeneration on the result screen to add a single ₩3,000 pass instead of a full subscription.' },
    { q: 'Can I edit the AI-generated card news?', a: 'Yes. You can edit the copy and layout directly after generation.' },
    { q: 'Can I use it with multiple brands?', a: 'Currently one brand per account is supported. Contact us for multi-brand inquiries.' },
    { q: 'What are the differences between plans?', a: 'Free users get 1 generation per day and 30-day retention. Creator offers 20/month and Studio 30/month, both including AI background regeneration.' },
    { q: 'Can I start creating immediately after logging in?', a: 'Yes. After Google Login and brand setup, you can create one card news per day without payment.' },
    { q: 'Can I change plans at any time?', a: 'Canceling your current subscription reverts access immediately. You can then choose a new plan.' },
    { q: 'Where do I complete payment?', a: 'After Google Login and brand setup, the billing screen lets you select and pay for your plan.' },
  ],
}

const compareFeatures = {
  ko: [
    { feature: '카드뉴스 생성 수', free: '하루 1회', creator: '월 20회', studio: '월 30회' },
    { feature: '작업 히스토리 보관', free: '30일', creator: '90일', studio: '365일' },
    { feature: '브랜드 URL 분석', free: '✓', creator: '✓', studio: '✓' },
    { feature: 'AI 문구·이미지 생성', free: '✓', creator: '✓', studio: '✓' },
    { feature: '상품 참고 이미지 입력', free: '최대 4장', creator: '최대 4장', studio: '최대 4장' },
    { feature: 'AI 배경 재생성', free: '3,000원 / 1회', creator: '1회분/건', studio: '1회분/건' },
    { feature: '결과 편집 및 다운로드', free: '✓', creator: '✓', studio: '✓' },
  ],
  en: [
    { feature: 'Card news generation', free: '1/day', creator: '20/month', studio: '30/month' },
    { feature: 'Work history retention', free: '30 days', creator: '90 days', studio: '365 days' },
    { feature: 'Brand URL analysis', free: '✓', creator: '✓', studio: '✓' },
    { feature: 'AI copy & image generation', free: '✓', creator: '✓', studio: '✓' },
    { feature: 'Reference image input', free: 'Up to 4', creator: 'Up to 4', studio: 'Up to 4' },
    { feature: 'AI background regen', free: '₩3,000 / 1 use', creator: '1 use/campaign', studio: '1 use/campaign' },
    { feature: 'Edit & download results', free: '✓', creator: '✓', studio: '✓' },
  ],
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const authenticated = Boolean(await getSessionUser())
  const accessHref = authenticated ? `/${locale}/billing` : '/api/auth/google/start'
  const t = await getTranslations('pricing')
  const isEn = locale === 'en'

  const plans = [
    {
      name: PRICING_PLANS.FREE.name,
      tagline: t('free_tagline'),
      price: PRICING_PLANS.FREE.price,
      desc: PRICING_PLANS.FREE.description,
      cta: t('free_cta'),
      features: isEn
        ? ['1 card news per day', '30-day history', 'Brand URL analysis', 'Up to 4 reference images', 'Edit & download results', 'AI regeneration not included']
        : ['하루 1회 카드뉴스 생성', '작업 히스토리 30일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', '결과 편집 및 다운로드', 'AI 재생성 미포함'],
      highlight: false,
    },
    {
      name: PRICING_PLANS.PRO.name,
      tagline: t('pro_tagline'),
      price: PRICING_PLANS.PRO.price,
      desc: PRICING_PLANS.PRO.description,
      cta: t('paid_cta'),
      features: isEn
        ? ['20 card news per month', '90-day history', 'Brand URL analysis', 'Up to 4 reference images', 'AI copy & image generation', '1 AI background regen/campaign', 'Edit & download results']
        : ['월 20회 카드뉴스 생성', '작업 히스토리 90일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', 'AI 문구·이미지 생성', '캠페인별 AI 배경 재생성 1회분', '결과 편집 및 다운로드'],
      highlight: true,
    },
    {
      name: PRICING_PLANS.UNLIMITED.name,
      tagline: t('unlimited_tagline'),
      price: PRICING_PLANS.UNLIMITED.price,
      desc: PRICING_PLANS.UNLIMITED.description,
      cta: t('paid_cta'),
      features: isEn
        ? ['30 card news per month', '365-day history', 'Brand URL analysis', 'Up to 4 reference images', 'AI copy & image generation', '1 AI background regen/campaign', 'Edit & download results']
        : ['월 30회 카드뉴스 생성', '작업 히스토리 365일 보관', '브랜드 URL 분석', '상품 참고 이미지 최대 4장', 'AI 문구·이미지 생성', '캠페인별 AI 배경 재생성 1회분', '결과 편집 및 다운로드'],
      highlight: false,
    },
  ]

  const faqList = isEn ? faqs.en : faqs.ko
  const compareList = isEn ? compareFeatures.en : compareFeatures.ko

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a] flex flex-col selection:bg-[#ff6b35]/20">
      <MarketingNav authenticated={authenticated} locale={locale} />

      <main className="flex-1">
        {/* HEADER */}
        <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-br from-[#ff6b35]/8 to-transparent blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">{t('eyebrow')}</p>
            <h1 className="mt-5 text-[44px] md:text-[60px] font-black tracking-[-0.045em] leading-[1.05] text-[#0a0a0a]">
              {t('title')}
            </h1>
            <p className="mt-7 text-[17px] text-[#525252] max-w-md mx-auto">
              {t('desc')}
            </p>
          </div>
        </section>

        {/* PLANS */}
        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-5 md:grid-cols-3 items-start">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-[22px] p-8 transition-all ${
                    plan.highlight
                      ? 'bg-[#0a0a0a] text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]'
                      : 'bg-white border border-black/[0.06] hover:border-black/[0.12]'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#ff6b35] rounded-full text-[10px] font-black text-white tracking-wider uppercase">
                      Most Popular
                    </div>
                  )}
                  <p className={`text-[12px] font-bold uppercase tracking-[0.1em] ${plan.highlight ? 'text-[#ff6b35]' : 'text-[#8a8a8a]'}`}>
                    {plan.tagline}
                  </p>
                  <h3 className={`mt-3 text-[24px] font-black tracking-[-0.025em] ${plan.highlight ? 'text-white' : 'text-[#0a0a0a]'}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-2 text-[13px] leading-[1.5] min-h-[40px] ${plan.highlight ? 'text-white/60' : 'text-[#8a8a8a]'}`}>
                    {plan.desc}
                  </p>
                  <div className="mt-7 flex items-baseline gap-1">
                    <span className={`text-[40px] font-black tracking-[-0.04em] ${plan.highlight ? 'text-white' : 'text-[#0a0a0a]'}`}>
                      {plan.price}
                    </span>
                  </div>
                  <a
                    href={accessHref}
                    className={`mt-7 flex h-11 items-center justify-center rounded-full text-[14px] font-bold transition-all ${
                      plan.highlight
                        ? 'bg-white text-[#0a0a0a] hover:bg-white/90'
                        : 'bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {plan.cta}
                  </a>
                  <ul className="mt-7 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-[13.5px]">
                        <Check className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-[#ff6b35]' : 'text-[#0a0a0a]'}`} strokeWidth={2.8} />
                        <span className={plan.highlight ? 'text-white/85' : 'text-[#525252]'}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Enterprise */}
            <div className="mt-8 rounded-[22px] border border-black/[0.06] bg-white p-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0a0a0a] text-white text-[20px] font-black">E</div>
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.025em] text-[#0a0a0a]">Enterprise</h3>
                  <p className="mt-1 text-[14px] text-[#525252]">
                    {isEn ? 'Custom volume and enterprise onboarding' : '월 30회를 넘어서는 대량 제작 및 맞춤 도입 상담'}
                  </p>
                </div>
              </div>
              <a
                href="mailto:support@shuffla.ai"
                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0a0a0a] px-6 text-[14px] font-bold text-white hover:bg-[#1a1a1a] transition-colors whitespace-nowrap"
              >
                {isEn ? 'Contact us' : '도입 문의하기'} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* COMPARISON TABLE */}
        <section className="pb-28 lg:pb-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="rounded-[22px] border border-black/[0.06] bg-white overflow-hidden">
              <div className="px-8 py-7 border-b border-black/[0.06]">
                <h3 className="text-[20px] font-black tracking-[-0.025em] text-[#0a0a0a]">{t('compare_title')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-black/[0.06] bg-[#fafaf7]">
                      <th className="text-left py-4 px-6 font-bold text-[#525252]">{isEn ? 'Feature' : '기능'}</th>
                      <th className="text-center py-4 px-4 font-bold text-[#525252]">Free</th>
                      <th className="text-center py-4 px-4 font-bold text-[#ff6b35]">Creator</th>
                      <th className="text-center py-4 px-4 font-bold text-[#525252]">Studio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {compareList.map((row, i) => (
                      <tr key={i}>
                        <td className="py-4 px-6 font-medium text-[#0a0a0a]">{row.feature}</td>
                        <td className="text-center py-4 px-4 text-[#525252]">{row.free}</td>
                        <td className="text-center py-4 px-4 text-[#0a0a0a] font-bold">{row.creator}</td>
                        <td className="text-center py-4 px-4 text-[#525252]">{row.studio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-28 lg:pb-32">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">FAQ</p>
              <h2 className="mt-5 text-[36px] md:text-[44px] font-black tracking-[-0.04em] leading-[1.08] text-[#0a0a0a]">
                {t('faq_title')}
              </h2>
            </div>
            <div className="divide-y divide-black/[0.08]">
              {faqList.map((faq, i) => (
                <details key={i} className="group py-6 first:pt-0">
                  <summary className="flex cursor-pointer items-center justify-between gap-6 text-[16px] md:text-[17px] font-bold text-[#0a0a0a] list-none">
                    {faq.q}
                    <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#fafaf7] transition-transform group-open:rotate-45">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <div className="mt-4 text-[15px] leading-[1.7] text-[#525252]">{faq.a}</div>
                </details>
              ))}
            </div>
            <div className="mt-14 text-center">
              <p className="text-[14px] text-[#525252]">{isEn ? 'Have more questions?' : '더 궁금한 점이 있나요?'}</p>
              <a href="mailto:support@shuffla.ai" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#0a0a0a] hover:gap-2.5 transition-all">
                {isEn ? 'Contact us' : '문의하기'} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </div>
  )
}
