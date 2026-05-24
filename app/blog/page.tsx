import { MarketingNav } from '../components/MarketingNav'
import { MarketingFooter } from '../components/MarketingFooter'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata = {
    title: '블로그 - Shuffla',
    description: '카드뉴스 제작 가이드, 업데이트 소식, 자주 묻는 질문을 확인하세요.',
}

const posts = [
    {
        category: '공지사항',
        date: '2026.05.20',
        title: 'Shuffla 정식 오픈 안내',
        desc: 'AI로 인스타그램 카드뉴스를 자동 제작하는 Shuffla가 정식 서비스를 시작합니다. 오픈 기념 무료 크레딧도 확인하세요.',
        href: '#',
    },
    {
        category: '이용 가이드',
        date: '2026.05.20',
        title: '카드뉴스 첫 번째 제작하기 — 5분 완성 가이드',
        desc: '주제 입력부터 슬라이드 구성, 디자인 선택, 다운로드까지 전 과정을 단계별로 안내합니다.',
        href: '#',
    },
    {
        category: '이용 가이드',
        date: '2026.05.20',
        title: '어떤 주제가 카드뉴스에 잘 맞나요?',
        desc: '뉴스 요약, 꿀팁 정리, OO 순위, 비교 분석 등 인스타그램에서 반응이 좋은 카드뉴스 주제 유형을 소개합니다.',
        href: '#',
    },
    {
        category: '릴리즈 노트',
        date: '2026.05.20',
        title: '2026.05.20 정식 오픈 릴리즈',
        desc: '카드뉴스 자동 구성, 슬라이드 편집, 프리미엄 템플릿 10종 추가 등 이번 릴리즈의 주요 기능을 안내합니다.',
        href: '#',
    },
    {
        category: '자주 묻는 질문',
        date: '2026.05.20',
        title: '결제 및 크레딧 FAQ',
        desc: '크레딧 충전 방법, 플랜 변경, 환불 정책 등 결제와 관련된 자주 묻는 질문을 모았습니다.',
        href: '#',
    },
    {
        category: '자주 묻는 질문',
        date: '2026.05.20',
        title: 'AI 기능 및 저작권 FAQ',
        desc: 'AI가 생성한 카드뉴스의 저작권, 상업적 사용 가능 여부, 이미지 출처 등 자주 묻는 질문을 안내합니다.',
        href: '#',
    },
]

export default function BlogPage() {
    return (
        <div className="min-h-screen bg-[#FDFDFD] text-[#111111] flex flex-col">
            <MarketingNav />

            <main className="flex-1 py-24 px-6">
                <div className="mx-auto max-w-5xl">
                    <div className="mb-20">
                        <h1 className="text-[40px] font-bold tracking-tight text-gray-900 md:text-[48px] mb-6 leading-tight">
                            카드뉴스 제작 가이드부터<br />최신 업데이트까지
                        </h1>
                        <p className="text-gray-500 text-lg">Shuffla의 모든 소식과 활용법을 한눈에 확인하세요.</p>
                    </div>

                    <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-8">
                        <h2 className="text-xl font-bold text-gray-900">전체 게시글</h2>
                        <span className="text-sm font-medium text-gray-500">전체 {posts.length}개의 게시글</span>
                    </div>

                    <div className="grid gap-6">
                        {posts.map((post, idx) => (
                            <Link
                                key={idx}
                                href={post.href}
                                className="group flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-white border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,102,255,0.08)] hover:border-blue-100"
                            >
                                <div className="md:w-48 shrink-0 flex flex-col justify-center">
                                    <span className="inline-block px-3 py-1 rounded-md bg-gray-50 text-gray-600 text-[13px] font-semibold mb-2 self-start">{post.category}</span>
                                    <span className="text-[14px] text-gray-400 font-medium px-1">{post.date}</span>
                                </div>
                                <div className="flex-1 flex flex-col justify-center">
                                    <h3 className="text-[20px] font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                                    <p className="text-[15px] text-gray-500 leading-relaxed line-clamp-2">{post.desc}</p>
                                </div>
                                <div className="hidden md:flex shrink-0 items-center justify-center w-12 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                    <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <ArrowRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </main>

            <MarketingFooter />
        </div>
    )
}
