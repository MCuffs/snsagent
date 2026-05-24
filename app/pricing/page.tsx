import { MarketingNav } from '../components/MarketingNav'
import { MarketingFooter } from '../components/MarketingFooter'
import Link from 'next/link'

export const metadata = {
    title: '요금제 - Shuffla',
    description: '무료부터 Pro까지, 내 계정 규모에 맞는 카드뉴스 자동화 플랜을 선택하세요.',
}

const plans = [
    {
        name: 'Free',
        price: '₩0',
        desc: '처음 시작하는 분들을 위한 기본 플랜',
        cta: '무료로 시작하기',
        features: ['월 5장 카드뉴스 제작', 'AI 주제·문구 자동 구성', '기본 템플릿 3종'],
        highlight: false,
    },
    {
        name: 'Standard',
        price: '₩22,000',
        period: '/ month',
        desc: '꾸준히 콘텐츠를 올려야 하는 1인 크리에이터',
        cta: '시작하기',
        features: ['월 20장 카드뉴스 제작', 'AI 주제·문구 자동 구성', '프리미엄 템플릿 전체 제공', '상업적 사용 권한', '고해상도 다운로드'],
        highlight: true,
    },
    {
        name: 'Pro',
        price: '₩55,000',
        period: '/ month',
        desc: '여러 계정을 운영하는 마케터·에이전시',
        cta: '시작하기',
        features: ['월 60장 카드뉴스 제작', 'AI 주제·문구 자동 구성', '프리미엄 템플릿 전체 제공', '상업적 사용 권한', '고해상도 다운로드', '새로운 기능 우선 액세스'],
        highlight: false,
    },
    {
        name: 'Pro Plus',
        price: '₩110,000',
        period: '/ month',
        desc: '대량 콘텐츠 생산이 필요한 전문 팀',
        cta: '시작하기',
        features: ['월 150장 카드뉴스 제작', 'AI 주제·문구 자동 구성', '프리미엄 템플릿 전체 제공', '상업적 사용 권한', '고해상도 다운로드', '새로운 기능 우선 액세스'],
        highlight: false,
    },
]

export default function PricingPage() {
    return (
        <div className="min-h-screen bg-[#FDFDFD] text-[#111111] flex flex-col">
            <MarketingNav />

            <main className="flex-1 py-24 px-6">
                <div className="mx-auto max-w-7xl">
                    <div className="text-center mb-20">
                        <h1 className="text-[40px] font-bold tracking-tight text-gray-900 md:text-[48px] mb-6">
                            내 채널에 맞는 플랜으로<br />카드뉴스를 자동화하세요
                        </h1>
                        <p className="text-gray-500 text-lg">월 구독 기반, 언제든지 플랜 변경 가능합니다.</p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-start">
                        {plans.map((plan) => (
                            <div
                                key={plan.name}
                                className={`relative rounded-3xl p-8 transition-all duration-300 ${plan.highlight ? 'bg-blue-600 text-white shadow-2xl shadow-blue-900/20 scale-105 z-10' : 'bg-white text-gray-900 border border-gray-200'}`}
                            >
                                {plan.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full text-[11px] font-bold text-white tracking-widest uppercase">
                                        Most Popular
                                    </div>
                                )}
                                <h3 className={`text-xl font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                                <p className={`text-sm mb-6 ${plan.highlight ? 'text-blue-100' : 'text-gray-500'}`}>{plan.desc}</p>
                                <div className="mb-8">
                                    <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                                    {plan.period && <span className={`text-sm ml-1 ${plan.highlight ? 'text-blue-100' : 'text-gray-500'}`}>{plan.period}</span>}
                                </div>
                                <Link
                                    href="/login"
                                    className={`flex w-full items-center justify-center rounded-xl py-3.5 text-[15px] font-semibold transition-all ${plan.highlight ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                >
                                    {plan.cta}
                                </Link>
                                <ul className="mt-8 space-y-4">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-[14px]">
                                            <svg className={`h-5 w-5 shrink-0 ${plan.highlight ? 'text-blue-200' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className={plan.highlight ? 'text-blue-50' : 'text-gray-600'}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 rounded-3xl border border-gray-200 bg-white p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
                            <p className="text-gray-500">대규모 팀·에이전시를 위한 대량 제작 및 맞춤 도입 상담</p>
                        </div>
                        <a href="mailto:support@shuffla.ai" className="px-8 py-3.5 rounded-xl border border-gray-300 text-[15px] font-semibold text-gray-900 hover:bg-gray-50 transition-colors whitespace-nowrap">
                            도입 문의하기
                        </a>
                    </div>
                </div>
            </main>

            <MarketingFooter />
        </div>
    )
}
