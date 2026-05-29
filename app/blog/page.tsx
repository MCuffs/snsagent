import { MarketingNav } from '../components/MarketingNav'
import { MarketingFooter } from '../components/MarketingFooter'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import { getSessionUser } from '../../lib/auth/user'

export const metadata = {
    title: '블로그 — Shuffla',
    description: '카드뉴스 제작 가이드, 업데이트 소식, 자주 묻는 질문을 확인하세요.',
}

const categories = [
    { name: '전체', color: 'bg-[#0a0a0a] text-white', tagColor: '' },
    { name: '공지사항', color: 'bg-white border border-black/10 text-[#525252]', tagColor: 'bg-[#fff4e6] text-[#ff6b35]' },
    { name: '이용 가이드', color: 'bg-white border border-black/10 text-[#525252]', tagColor: 'bg-[#e7f5ff] text-[#1c7ed6]' },
    { name: '릴리즈 노트', color: 'bg-white border border-black/10 text-[#525252]', tagColor: 'bg-[#f3f0ff] text-[#7950f2]' },
    { name: '자주 묻는 질문', color: 'bg-white border border-black/10 text-[#525252]', tagColor: 'bg-[#eefbf0] text-[#2f9e44]' },
]

const featured = {
    category: '공지사항',
    tagClass: 'bg-[#fff4e6] text-[#ff6b35]',
    date: '2026.05.20',
    title: 'Shuffla 카드뉴스 스튜디오 안내',
    desc: '브랜드 분석부터 AI 카드뉴스 생성, 편집, 다운로드까지 연결된 Shuffla의 현재 기능을 소개합니다.',
    readTime: '3분 읽기',
}

const posts = [
    {
        category: '이용 가이드',
        tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
        date: '2026.05.20',
        title: '카드뉴스 첫 번째 제작하기 — 5분 완성 가이드',
        desc: '주제 입력부터 슬라이드 구성, 디자인 선택, 다운로드까지 전 과정을 단계별로 안내합니다.',
        readTime: '5분 읽기',
    },
    {
        category: '이용 가이드',
        tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
        date: '2026.05.20',
        title: '어떤 주제가 카드뉴스에 잘 맞나요?',
        desc: '뉴스 요약, 꿀팁 정리, 순위, 비교 분석 등 카드뉴스에 잘 맞는 주제 유형을 소개합니다.',
        readTime: '4분 읽기',
    },
    {
        category: '이용 가이드',
        tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
        date: '2026.05.20',
        title: '상품 참고 이미지로 생성 품질 높이기',
        desc: '상품 이미지를 추가해 카드뉴스의 비주얼 방향을 더 구체적으로 전달하는 방법을 안내합니다.',
        readTime: '3분 읽기',
    },
    {
        category: '릴리즈 노트',
        tagClass: 'bg-[#f3f0ff] text-[#7950f2]',
        date: '2026.05.20',
        title: '2026.05.20 정식 오픈 릴리즈',
        desc: '카드뉴스 자동 구성, 슬라이드 편집, 프리미엄 템플릿 10종 추가 등 이번 릴리즈의 주요 기능을 안내합니다.',
        readTime: '6분 읽기',
    },
    {
        category: '자주 묻는 질문',
        tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
        date: '2026.05.20',
        title: '요금제 및 결제 FAQ',
        desc: '월 생성 횟수별 플랜 선택, 구독 변경, 환불 정책 등 결제 관련 질문을 모았습니다.',
        readTime: '4분 읽기',
    },
    {
        category: '자주 묻는 질문',
        tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
        date: '2026.05.20',
        title: 'AI 기능 및 저작권 FAQ',
        desc: 'AI가 생성한 카드뉴스의 저작권, 상업적 사용 가능 여부, 이미지 출처 등 자주 묻는 질문을 안내합니다.',
        readTime: '5분 읽기',
    },
]

const guides = [
    { title: '브랜드 설정 마스터하기', duration: '2:47', accent: 'from-[#ff6b35] to-[#f7931e]' },
    { title: '카드뉴스 9:22분 만에 만들기', duration: '9:22', accent: 'from-[#1c7ed6] to-[#339af0]' },
    { title: '결과 화면 편집과 다운로드', duration: '4:07', accent: 'from-[#7950f2] to-[#9775fa]' },
    { title: 'AI 프롬프트 잘 쓰는 법', duration: '4:07', accent: 'from-[#2f9e44] to-[#51cf66]' },
]

export default async function BlogPage() {
    const authenticated = Boolean(await getSessionUser())

    return (
        <div className="min-h-screen bg-[#fafaf7] text-[#0a0a0a] flex flex-col selection:bg-[#ff6b35]/20">
            <MarketingNav authenticated={authenticated} />

            <main className="flex-1">
                {/* HEADER */}
                <section className="relative overflow-hidden pt-20 pb-12 lg:pt-28 lg:pb-16">
                    <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-gradient-to-br from-[#ff6b35]/8 to-transparent blur-3xl" />
                    <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
                        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Blog</p>
                        <h1 className="mt-5 text-[44px] md:text-[60px] font-black tracking-[-0.045em] leading-[1.05] text-[#0a0a0a] max-w-3xl">
                            카드뉴스 제작 가이드부터<br />최신 업데이트까지
                        </h1>
                        <p className="mt-7 text-[17px] text-[#525252] max-w-md">
                            Shuffla의 모든 소식과 활용법을 한눈에 확인하세요.
                        </p>
                    </div>
                </section>

                {/* FEATURED + GUIDES */}
                <section className="pb-16">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="grid gap-6 lg:grid-cols-3">
                            {/* Featured */}
                            <Link
                                href="#"
                                className="lg:col-span-2 group relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#fff4e6] via-[#ffe8cc] to-[#ffd6a5] p-10 md:p-12 flex flex-col justify-end min-h-[400px]"
                            >
                                <div className="pointer-events-none absolute top-8 right-8 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
                                <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-[#0a0a0a]/5 blur-2xl" />

                                <div className="relative">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className={`inline-block px-3 py-1.5 rounded-full text-[12px] font-black ${featured.tagClass}`}>
                                            {featured.category}
                                        </span>
                                        <span className="text-[13px] text-[#0a0a0a]/60 font-bold">{featured.date}</span>
                                        <span className="text-[13px] text-[#0a0a0a]/60">·</span>
                                        <span className="text-[13px] text-[#0a0a0a]/60 font-bold">{featured.readTime}</span>
                                    </div>
                                    <h2 className="text-[32px] md:text-[40px] font-black tracking-[-0.04em] leading-[1.1] text-[#0a0a0a]">
                                        {featured.title}
                                    </h2>
                                    <p className="mt-5 text-[16px] leading-[1.65] text-[#0a0a0a]/75 max-w-xl">
                                        {featured.desc}
                                    </p>
                                    <div className="mt-8 inline-flex items-center gap-2 text-[14px] font-black text-[#0a0a0a] group-hover:gap-3 transition-all">
                                        자세히 읽기 <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </Link>

                            {/* Side info */}
                            <div className="rounded-[22px] bg-[#0a0a0a] text-white p-10 flex flex-col justify-between">
                                <div>
                                    <Sparkles className="h-7 w-7 text-[#ff6b35]" strokeWidth={2.2} />
                                    <h3 className="mt-6 text-[24px] font-black tracking-[-0.025em] leading-[1.2]">
                                        영상으로 한눈에 보기
                                    </h3>
                                    <p className="mt-4 text-[14px] leading-[1.6] text-white/60">
                                        짧은 영상으로 Shuffla의 핵심 기능을 빠르게 익혀보세요.
                                    </p>
                                </div>
                                <div className="mt-8 space-y-3">
                                    {guides.slice(0, 2).map((g) => (
                                        <Link
                                            key={g.title}
                                            href="#"
                                            className="flex items-center gap-3 group"
                                        >
                                            <div className={`h-10 w-14 shrink-0 rounded-lg bg-gradient-to-br ${g.accent} flex items-center justify-center text-[11px] font-black text-white`}>
                                                {g.duration}
                                            </div>
                                            <span className="text-[13px] font-bold text-white/85 group-hover:text-white">{g.title}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CATEGORIES */}
                <section className="pb-8">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="flex items-center gap-2 flex-wrap">
                            {categories.map((c) => (
                                <button
                                    key={c.name}
                                    className={`px-4 py-2 rounded-full text-[13px] font-bold transition-all hover:-translate-y-[1px] ${c.color}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                            <span className="ml-auto text-[13px] font-medium text-[#8a8a8a]">전체 {posts.length + 1}개</span>
                        </div>
                    </div>
                </section>

                {/* POSTS */}
                <section className="pb-28">
                    <div className="mx-auto max-w-7xl px-6 lg:px-8">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {posts.map((post, idx) => (
                                <Link
                                    key={idx}
                                    href="#"
                                    className="group relative flex flex-col p-7 rounded-[22px] bg-white border border-black/[0.06] hover:border-black/[0.12] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)] transition-all"
                                >
                                    <div className="flex items-center gap-2 mb-5">
                                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-black ${post.tagClass}`}>{post.category}</span>
                                        <span className="text-[12px] text-[#8a8a8a] font-medium">{post.date}</span>
                                    </div>
                                    <h3 className="text-[18px] font-black tracking-[-0.02em] text-[#0a0a0a] leading-[1.3] mb-3 group-hover:text-[#ff6b35] transition-colors">
                                        {post.title}
                                    </h3>
                                    <p className="text-[14px] leading-[1.6] text-[#525252] line-clamp-3 mb-6 flex-1">{post.desc}</p>
                                    <div className="flex items-center justify-between pt-4 border-t border-black/[0.06]">
                                        <span className="text-[12px] font-bold text-[#8a8a8a]">{post.readTime}</span>
                                        <ArrowUpRight className="h-4 w-4 text-[#525252] group-hover:text-[#ff6b35] group-hover:-translate-y-[1px] group-hover:translate-x-[1px] transition-all" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <MarketingFooter authenticated={authenticated} />
        </div>
    )
}
