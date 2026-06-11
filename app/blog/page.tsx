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

const postImages = [
  '/front/card-10.png',
  '/front/card-13.png',
  '/front/card-11.png',
  '/front/card-04.png',
  '/front/card-01.png',
  '/front/card-15.png',
]

export default async function BlogPage() {
  const authenticated = Boolean(await getSessionUser())
  const featuredImage = '/front/card-04.png'

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col relative overflow-hidden selection:bg-sky-500/20">
      {/* Background glow and grid pattern */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-sky-100/20 via-sky-50/5 to-transparent rounded-full blur-3xl opacity-70 z-0" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.15] z-0" />

      <MarketingNav authenticated={authenticated} />

      <main className="flex-1 relative z-10">
        {/* Header Section */}
        <section className="relative pt-20 pb-12 lg:pt-28 lg:pb-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-brand-blue">Blog</p>
            <h1 className="mt-5 max-w-3xl text-[40px] font-black leading-[1.1] tracking-[-0.04em] text-slate-900 md:text-[54px]">
              카드뉴스 자동화 가이드부터<br />최신 업데이트까지
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-7 text-slate-500 font-medium">
              Shuffla의 모든 소식과 활용법을 한눈에 확인하세요.
            </p>
          </div>
        </section>

        {/* Featured Post Split-Layout Section */}
        <section className="pb-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <Link
              href="#"
              className="group block rounded-[28px] border border-slate-200/80 bg-white/60 backdrop-blur-md p-6 md:p-8 shadow-[0_12px_40px_-20px_rgba(14,165,233,0.08)] hover:border-sky-200 hover:shadow-[0_20px_50px_-15px_rgba(14,165,233,0.12)] transition-all duration-300"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                {/* Left: Rounded Image Container */}
                <div className="aspect-[4/3] w-full relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                  <img
                    src={featuredImage}
                    alt={featured.title}
                    className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-102"
                  />
                </div>

                {/* Right: Info and Text Details */}
                <div className="flex flex-col justify-center">
                  <div className="mb-4 flex items-center gap-3 text-xs">
                    <span className={`inline-block rounded-full px-3 py-1.5 text-[11px] font-bold ${featured.tagClass}`}>{featured.category}</span>
                    <span className="text-slate-400 font-semibold">{featured.date}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 font-semibold">{featured.readTime}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold leading-[1.2] tracking-[-0.03em] text-slate-900 group-hover:text-brand-blue transition-colors duration-300">
                    {featured.title}
                  </h2>
                  <p className="mt-5 text-[15px] leading-relaxed text-slate-500 font-medium">
                    {featured.desc}
                  </p>
                  <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue group-hover:text-brand-blue-hover transition-colors">
                    자세히 읽기 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Categories Bar */}
        <section className="pb-10">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-6">
              {categories.map((category) => {
                const isAll = category.name === '전체';
                return (
                  <button
                    key={category.name}
                    className={`rounded-full px-4.5 py-2 text-[13px] font-bold transition-all ${
                      isAll
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {category.name}
                  </button>
                );
              })}
              <span className="ml-auto text-[13px] font-bold text-slate-400">
                전체 {posts.length + 1}개
              </span>
            </div>
          </div>
        </section>

        {/* Recent Posts Grid */}
        <section className="pb-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, idx) => {
                const postImage = postImages[idx] || '/front/card-01.png'
                return (
                  <Link
                    key={idx}
                    href="#"
                    className="group relative flex flex-col rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_4px_20px_-10px_rgba(0,0,0,0.03)] transition-all duration-300 hover:border-sky-200 hover:shadow-[0_20px_40px_-15px_rgba(14,165,233,0.08)] hover:-translate-y-1"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-slate-50 relative">
                      <img
                        src={postImage}
                        alt={post.title}
                        className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-102"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-4 flex items-center gap-3 text-xs">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${post.tagClass}`}>{post.category}</span>
                        <span className="text-slate-400 font-semibold">{post.date}</span>
                      </div>
                      <h3 className="mb-3 text-[18px] font-bold leading-[1.4] text-slate-900 group-hover:text-brand-blue transition-colors duration-300 line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="mb-6 flex-1 text-[14px] leading-relaxed text-slate-500 font-medium line-clamp-3">
                        {post.desc}
                      </p>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-[12px] font-bold text-slate-400">{post.readTime}</span>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 group-hover:text-brand-blue transition-colors">
                          읽기 <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter authenticated={authenticated} />
    </div>
  )
}
