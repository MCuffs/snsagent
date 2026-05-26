import { ArrowRight, Check } from 'lucide-react'
import { MarketingFooter } from './components/MarketingFooter'
import { MarketingNav } from './components/MarketingNav'
import { CapabilityObjects, EditorialGallery, ProductShowcase } from './components/LandingProductShowcase'

export const metadata = {
  title: 'Shuffla - AI Card News Studio',
  description: '브랜드 분석부터 카드뉴스 생성, 편집, 다운로드까지 이어지는 AI 콘텐츠 스튜디오.',
}

const workflow = [
  {
    title: 'Concept',
    desc: '브랜드 URL과 상품 정보를 읽고 타겟에 맞는 콘텐츠 방향을 설계합니다.',
  },
  {
    title: 'Generate',
    desc: '슬라이드별 카피와 비주얼을 하나의 완성된 카드뉴스 세트로 생성합니다.',
  },
  {
    title: 'Publish',
    desc: '에디터에서 디테일을 조정하고 게시 가능한 PNG와 ZIP으로 내보냅니다.',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#171714] selection:bg-[#ec6238]/15">
      <MarketingNav />

      <section className="relative overflow-hidden pb-24 pt-16 md:pb-32 md:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[560px] w-[880px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(237,101,57,0.075),transparent_66%)]" />
        <div className="relative mx-auto max-w-5xl px-5 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-2 text-xs font-medium text-[#716a60]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
            AI Editorial Studio for Brands
          </div>
          <h1 className="mt-8 text-[clamp(3.3rem,9.2vw,7.8rem)] font-semibold leading-[0.94] tracking-[-0.075em] text-[#171714]">
            카드뉴스를
            <br />
            더 정확하게, 빠르게.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-8 text-[#746e65] md:text-lg">
            Shuffla는 브랜드를 이해하고, 흐름 있는 카피와 비주얼을 생성하고,
            <br className="hidden sm:block" />
            바로 편집하고 다운로드할 수 있는 AI 콘텐츠 스튜디오입니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/api/auth/google/start"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-7 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#302c26]"
            >
              무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#product"
              className="inline-flex h-12 items-center rounded-full border border-[#dfd9ce] bg-white px-7 text-sm font-medium text-[#342f29] transition hover:border-[#bfb7ab]"
            >
              제품 화면 보기
            </a>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-7 gap-y-2 text-xs text-[#857e73]">
            {['브랜드 분석', 'AI 카피 및 이미지 생성', '4:5 고해상도 다운로드'].map(item => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#ed6238]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <EditorialGallery />
      </section>

      <ProductShowcase />
      <CapabilityObjects />

      <section id="workflow" className="bg-[#fbfaf7] py-24 md:py-32">
        <div className="mx-auto grid max-w-[1300px] gap-16 px-5 md:px-8 lg:grid-cols-[0.45fr_0.55fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">One connected system</p>
            <h2 className="mt-5 text-[clamp(2.2rem,4vw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.06em]">
              콘텐츠 운영을
              <br />
              하나의 흐름으로
            </h2>
          </div>
          <div className="border-t border-[#dfdad0]">
            {workflow.map((item, index) => (
              <article key={item.title} className="grid gap-3 border-b border-[#dfdad0] py-8 sm:grid-cols-[80px_150px_1fr] sm:items-start">
                <p className="font-mono text-xs text-[#aaa294]">0{index + 1}</p>
                <h3 className="text-xl font-medium tracking-[-0.04em]">{item.title}</h3>
                <p className="text-sm leading-7 text-[#777064]">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 md:px-8 md:pb-32">
        <div className="mx-auto max-w-[1300px] overflow-hidden rounded-[30px] border border-[#e6dfd5] bg-white px-6 py-16 text-center md:px-10 md:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">Start with Shuffla</p>
          <h2 className="mx-auto mt-6 max-w-3xl text-[clamp(2.35rem,5vw,4.5rem)] font-semibold leading-[1.08] tracking-[-0.065em]">
            다음 카드뉴스를
            <br />
            지금 설계하세요.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
            브랜드 설정부터 AI 생성, 편집, 결과물 다운로드까지 한 번의 워크플로우로 진행합니다.
          </p>
          <a
            href="/api/auth/google/start"
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#db552d]"
          >
            Google로 시작하기 <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
