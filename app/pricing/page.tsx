import { MarketingNav } from '../components/MarketingNav'
import { MarketingFooter } from '../components/MarketingFooter'
import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
    title: '요금제 — Shuffla',
    description: '무료부터 Pro까지, 내 채널 규모에 맞는 카드뉴스 자동화 플랜을 선택하세요.',
}

const plans = [
    {
        name: 'Free',
        tagline: '무료 체험',
        price: '₩0',
        period: '',
        desc: '처음 시작하는 분들을 위한 기본 플랜',
        cta: '무료로 시작하기',
        features: ['월 5장 카드뉴스 제작', 'AI 주제·문구 자동 구성', '기본 템플릿 3종', '이미지 다운로드'],
        highlight: false,
    },
    {
        name: 'Standard',
        tagline: '1인 크리에이터',
        price: '₩22,000',
        period: '/월',
        desc: '꾸준히 콘텐츠를 올려야 하는 1인 크리에이터',
        cta: '시작하기',
        features: [
            '월 20장 카드뉴스 제작',
            'AI 주제·문구 자동 구성',
            '프리미엄 템플릿 전체 제공',
            'Instagram 자동 발행',
            '상업적 사용 권한',
            '고해상도 다운로드',
        ],
        highlight: true,
    },
    {
        name: 'Pro',
        tagline: '마케터 · 에이전시',
        price: '₩55,000',
        period: '/월',
        desc: '여러 계정을 운영하는 마케터·에이전시',
        cta: '시작하기',
        features: [
            '월 60장 카드뉴스 제작',
            'AI 주제·문구 자동 구성',
            '프리미엄 템플릿 전체 제공',
            'Instagram 자동 발행',
            '상업적 사용 권한',
            '고해상도 다운로드',
            '신기능 우선 액세스',
        ],
        highlight: false,
    },
    {
        name: 'Pro Plus',
        tagline: '전문 팀',
        price: '₩110,000',
        period: '/월',
        desc: '대량 콘텐츠 생산이 필요한 전문 팀',
        cta: '시작하기',
        features: [
            '월 150장 카드뉴스 제작',
            'AI 주제·문구 자동 구성',
            '프리미엄 템플릿 전체 제공',
            'Instagram 자동 발행',
            '상업적 사용 권한',
            '고해상도 다운로드',
            '신기능 우선 액세스',
        ],
        highlight: false,
    },
]

const faqs = [
    {
        q: '인스타그램 계정이 비즈니스 계정이어야 하나요?',
        a: 'Instagram API 정책상 자동 발행은 프로페셔널 계정(비즈니스 또는 크리에이터)만 가능합니다. 인스타 앱에서 무료로 전환할 수 있으며, 전환 후 바로 연결할 수 있습니다.',
    },
    {
        q: 'AI가 만든 카드뉴스를 직접 수정할 수 있나요?',
        a: '네. AI가 생성한 헤드라인, 본문, 해시태그, 캡션을 발행 전 언제든지 직접 편집할 수 있고, 이미지도 프롬프트 수정해 재생성할 수 있습니다.',
    },
    {
        q: '브랜드가 여러 개인 경우에도 사용할 수 있나요?',
        a: '현재는 계정당 브랜드 1개를 지원합니다. 여러 계정·브랜드를 운영하는 에이전시는 Enterprise 플랜으로 문의해 주세요.',
    },
    {
        q: '생성된 이미지의 저작권은 어떻게 되나요?',
        a: 'Standard 플랜 이상에서 상업적 사용 권한을 제공합니다. 생성된 결과물은 외부에 공유되지 않습니다.',
    },
    {
        q: '무료 플랜에서도 인스타그램 자동 발행이 되나요?',
        a: '무료 플랜은 카드뉴스 생성과 다운로드까지 지원되며, Instagram 자동 발행은 Standard 플랜부터 사용 가능합니다.',
    },
    {
        q: '플랜은 언제든지 변경할 수 있나요?',
        a: '네. 언제든지 업그레이드·다운그레이드가 가능합니다. 다운그레이드 시 다음 결제 주기부터 적용되며, 업그레이드는 즉시 반영됩니다.',
    },
    {
        q: '환불 정책은 어떻게 되나요?',
        a: '결제일로부터 7일 이내 미사용 상태일 경우 전액 환불 가능합니다. 사용 내역이 있는 경우 환불은 어렵습니다.',
    },
]

const compareFeatures = [
    { feature: '월 카드뉴스 제작 수', free: '5장', standard: '20장', pro: '60장', proplus: '150장' },
    { feature: 'AI 자동 문구 생성', free: '✓', standard: '✓', pro: '✓', proplus: '✓' },
    { feature: '프리미엄 템플릿', free: '3종', standard: '전체', pro: '전체', proplus: '전체' },
    { feature: 'Instagram 자동 발행', free: '—', standard: '✓', pro: '✓', proplus: '✓' },
    { feature: '상업적 사용 권한', free: '—', standard: '✓', pro: '✓', proplus: '✓' },
    { feature: '고해상도 다운로드', free: '—', standard: '✓', pro: '✓', proplus: '✓' },
    { feature: '신기능 우선 액세스', free: '—', standard: '—', pro: '✓', proplus: '✓' },
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
                            내 채널에 맞는 플랜으로<br />카드뉴스를 자동화하세요
                        </h1>
                        <p className="mt-7 text-[17px] text-[#525252] max-w-md mx-auto">
                            무료로 시작하고, 필요할 때 업그레이드.<br />언제든지 플랜 변경 가능합니다.
                        </p>
                    </div>
                </section>

                {/* PLANS */}
                <section className="pb-20">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 items-start">
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
                                    <p className="mt-1 text-[14px] text-[#525252]">대규모 팀·에이전시를 위한 대량 제작 및 맞춤 도입 상담</p>
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
                                            <th className="text-center py-4 px-4 font-bold text-[#525252]">Free</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#ff6b35]">Standard</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#525252]">Pro</th>
                                            <th className="text-center py-4 px-4 font-bold text-[#525252]">Pro Plus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/[0.06]">
                                        {compareFeatures.map((row, i) => (
                                            <tr key={i}>
                                                <td className="py-4 px-6 font-medium text-[#0a0a0a]">{row.feature}</td>
                                                <td className="text-center py-4 px-4 text-[#525252]">{row.free}</td>
                                                <td className="text-center py-4 px-4 text-[#0a0a0a] font-bold">{row.standard}</td>
                                                <td className="text-center py-4 px-4 text-[#525252]">{row.pro}</td>
                                                <td className="text-center py-4 px-4 text-[#525252]">{row.proplus}</td>
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
