import { MarketingNav } from '../components/MarketingNav'
import { MarketingFooter } from '../components/MarketingFooter'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { PRICING_PLANS } from '../../lib/limits-types'

export const metadata = {
    title: '요금제 — Shuffla',
    description: '월 3,000원 1회부터, 제작 빈도에 맞는 Shuffla 카드뉴스 생성 플랜을 선택하세요.',
}

const plans = [
    {
        name: PRICING_PLANS.LITE.name,
        tagline: '첫 캠페인',
        price: PRICING_PLANS.LITE.price,
        period: '',
        desc: PRICING_PLANS.LITE.description,
        cta: 'Google Login',
        features: ['월 1회 카드뉴스 생성', '브랜드 URL 분석', 'AI 문구·이미지 생성', '결과 편집 및 다운로드'],
        highlight: false,
    },
    {
        name: PRICING_PLANS.PRO.name,
        tagline: '브랜드 운영',
        price: PRICING_PLANS.PRO.price,
        period: '',
        desc: PRICING_PLANS.PRO.description,
        cta: 'Google Login',
        features: [
            '월 10회 카드뉴스 생성',
            '브랜드 URL 분석',
            '상품 참고 이미지 최대 4장',
            'AI 문구·이미지 생성',
            '결과 편집 및 다운로드',
        ],
        highlight: true,
    },
    {
        name: PRICING_PLANS.UNLIMITED.name,
        tagline: '콘텐츠 팀',
        price: PRICING_PLANS.UNLIMITED.price,
        period: '',
        desc: PRICING_PLANS.UNLIMITED.description,
        cta: 'Google Login',
        features: [
            '월 30회 카드뉴스 생성',
            '브랜드 URL 분석',
            '상품 참고 이미지 최대 4장',
            'AI 문구·이미지 생성',
            '결과 편집 및 다운로드',
        ],
        highlight: false,
    },
]

const faqs = [
    {
        q: '월 3,000원 플랜에서는 무엇을 만들 수 있나요?',
        a: 'Single 플랜은 한 달에 카드뉴스 1세트를 생성할 수 있습니다. 브랜드 분석, 참고 이미지 입력, 결과 편집과 다운로드 흐름을 그대로 사용할 수 있습니다.',
    },
    {
        q: 'AI가 만든 카드뉴스를 직접 수정할 수 있나요?',
        a: '네. 생성된 헤드라인과 본문, 문안 메모를 편집하고 이미지 스타일 또는 배경을 다시 적용한 뒤 다운로드할 수 있습니다.',
    },
    {
        q: '브랜드가 여러 개인 경우에도 사용할 수 있나요?',
        a: '현재는 계정당 브랜드 1개를 지원합니다. 여러 브랜드 도입은 별도 문의로 확인해 주세요.',
    },
    {
        q: '플랜 간 차이는 무엇인가요?',
        a: '현재 플랜 차이는 매월 생성 가능한 카드뉴스 수입니다. 실제 사용 빈도에 맞춰 Single, Creator, Studio 중 선택할 수 있습니다.',
    },
    {
        q: '로그인만 하면 바로 생성할 수 있나요?',
        a: 'Google Login으로 브랜드 설정을 시작할 수 있으며, 카드뉴스 생성은 이용권 구독 후 가능합니다.',
    },
    {
        q: '플랜은 언제든지 변경할 수 있나요?',
        a: '현재 구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 이후 원하는 새 플랜을 선택할 수 있습니다.',
    },
    {
        q: '결제는 어디에서 진행되나요?',
        a: 'Google Login 후 브랜드를 설정하면 요금제 화면에서 PayPal로 구독을 승인할 수 있습니다. 승인된 플랜은 즉시 계정에 반영됩니다.',
    },
]

const compareFeatures = [
    { feature: '월 카드뉴스 생성 수', single: '1회', creator: '10회', studio: '30회' },
    { feature: '브랜드 URL 분석', single: '✓', creator: '✓', studio: '✓' },
    { feature: 'AI 문구·이미지 생성', single: '✓', creator: '✓', studio: '✓' },
    { feature: '상품 참고 이미지 입력', single: '최대 4장', creator: '최대 4장', studio: '최대 4장' },
    { feature: '결과 편집 및 다운로드', single: '✓', creator: '✓', studio: '✓' },
]

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a] flex flex-col selection:bg-[#ff6b35]/20">
            <MarketingNav />

            <main className="flex-1">
                {/* HEADER */}
                <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-20">
                    <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-br from-[#ff6b35]/8 to-transparent blur-3xl" />
                    <div className="relative mx-auto max-w-7xl px-6 lg:px-8 text-center">
                        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Pricing</p>
                        <h1 className="mt-5 text-[44px] md:text-[60px] font-black tracking-[-0.045em] leading-[1.05] text-[#0a0a0a]">
                            필요한 만큼 선택하고<br />카드뉴스를 제작하세요
                        </h1>
                        <p className="mt-7 text-[17px] text-[#525252] max-w-md mx-auto">
                            월 3,000원으로 1회부터 시작하고,<br />제작 빈도에 맞춰 플랜을 선택하세요.
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
                                        {plan.period && (
                                            <span className={`text-[14px] font-medium ${plan.highlight ? 'text-white/60' : 'text-[#8a8a8a]'}`}>
                                                {plan.period}
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        href="/login"
                                        className={`mt-7 flex h-11 items-center justify-center rounded-full text-[14px] font-bold transition-all ${
                                            plan.highlight
                                                ? 'bg-white text-[#0a0a0a] hover:bg-white/90'
                                                : 'bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]'
                                        }`}
                                    >
                                        {plan.cta}
                                    </Link>
                                    <ul className="mt-7 space-y-3">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-[13.5px]">
                                                <Check
                                                    className={`h-4 w-4 shrink-0 mt-0.5 ${plan.highlight ? 'text-[#ff6b35]' : 'text-[#0a0a0a]'}`}
                                                    strokeWidth={2.8}
                                                />
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
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0a0a0a] text-white text-[20px] font-black">
                                    E
                                </div>
                                <div>
                                    <h3 className="text-[22px] font-black tracking-[-0.025em] text-[#0a0a0a]">Enterprise</h3>
                                <p className="mt-1 text-[14px] text-[#525252]">월 30회를 넘어서는 대량 제작 및 맞춤 도입 상담</p>
                                </div>
                            </div>
                            <a
                                href="mailto:support@shuffla.ai"
                                className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0a0a0a] px-6 text-[14px] font-bold text-white hover:bg-[#1a1a1a] transition-colors whitespace-nowrap"
                            >
                                도입 문의하기 <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </section>

                {/* COMPARISON TABLE */}
                <section className="pb-28 lg:pb-32">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="rounded-[22px] border border-black/[0.06] bg-white overflow-hidden">
                            <div className="px-8 py-7 border-b border-black/[0.06]">
                                <h3 className="text-[20px] font-black tracking-[-0.025em] text-[#0a0a0a]">기능별 비교</h3>
                                <p className="mt-1 text-[14px] text-[#525252]">한눈에 보는 플랜별 기능</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-[14px]">
                                    <thead>
                                        <tr className="border-b border-black/[0.06] bg-[#fafaf7]">
                                            <th className="text-left py-4 px-6 font-bold text-[#525252]">기능</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#525252]">Single</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#ff6b35]">Creator</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#525252]">Studio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/[0.06]">
                                        {compareFeatures.map((row, i) => (
                                            <tr key={i}>
                                                <td className="py-4 px-6 font-medium text-[#0a0a0a]">{row.feature}</td>
                                                <td className="text-center py-4 px-4 text-[#525252]">{row.single}</td>
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
                                자주 묻는 질문
                            </h2>
                        </div>
                        <div className="divide-y divide-black/[0.08]">
                            {faqs.map((faq, i) => (
                                <details key={i} className="group py-6 first:pt-0">
                                    <summary className="flex cursor-pointer items-center justify-between gap-6 text-[16px] md:text-[17px] font-bold text-[#0a0a0a] list-none">
                                        {faq.q}
                                        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#fafaf7] transition-transform group-open:rotate-45">
                                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                            </svg>
                                        </span>
                                    </summary>
                                    <div className="mt-4 text-[15px] leading-[1.7] text-[#525252]">
                                        {faq.a}
                                    </div>
                                </details>
                            ))}
                        </div>
                        <div className="mt-14 text-center">
                            <p className="text-[14px] text-[#525252]">더 궁금한 점이 있나요?</p>
                            <a
                                href="mailto:support@shuffla.ai"
                                className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#0a0a0a] hover:gap-2.5 transition-all"
                            >
                                문의하기 <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            <MarketingFooter />
        </div>
    )
}
