import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronDown,
  Layers,
  Wand2,
} from 'lucide-react'

export const metadata = {
  title: 'InstaAgent - AI 인스타그램 콘텐츠 운영 데스크',
  description: '카드뉴스 기획, 이미지 초안, 캡션, 예약 발행을 한 곳에서 관리합니다.',
}

const workflow = [
  {
    title: '브랜드를 읽고',
    desc: '말투, 금칙어, 컬러, CTA를 기준으로 삼습니다.',
    icon: Layers,
  },
  {
    title: '카드뉴스를 만들고',
    desc: '훅, 구조, 카피, 시각 방향을 한 번에 제안합니다.',
    icon: Wand2,
  },
  {
    title: '예약까지 이어갑니다',
    desc: '검토 후 캘린더에 올리고 발행 상태를 추적합니다.',
    icon: CalendarClock,
  },
]

const trustItems = ['Free demo', 'Mock Instagram ready', 'Brand rules', 'Scheduler flow', 'Card news pipeline']

export default function LandingPage() {
  return (
    <main className="app-shell min-h-screen overflow-hidden text-[#1f1512]">
      <div className="bg-[#080706] px-5 py-3 text-center text-sm font-bold text-white">
        AI 카드뉴스 운영 데모가 준비되어 있습니다.
        <Link href="/login" className="ml-3 underline decoration-white/50 underline-offset-4">
          지금 시작하기
        </Link>
      </div>

      <header className="sticky top-0 z-30 border-b border-[#ece2d6] bg-[#fffdf8]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-[-0.05em]">
            <span className="h-1.5 w-7 rounded-full bg-[#ff4f0a]" />
            InstaAgent
          </Link>
          <nav className="hidden items-center gap-9 text-sm font-black text-[#1f1512] lg:flex">
            <a href="#workflow" className="flex items-center gap-1">제품 <ChevronDown className="h-3.5 w-3.5" /></a>
            <a href="#preview">워크플로</a>
            <a href="#usecases">적용 분야</a>
            <a href="#pricing">요금</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-black text-[#1f1512] md:inline">
              로그인
            </Link>
            <Link href="/login" className="btn-primary px-5">
              무료로 시작
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[760px] max-w-[1500px] items-center gap-14 px-6 py-20 lg:grid-cols-[1fr_620px] lg:px-12">
        <div className="relative z-10 max-w-4xl">
          <div className="mb-10 flex flex-wrap gap-5 text-xs font-black uppercase tracking-[0.08em] text-[#746a62]">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Free forever for core demo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Local mock mode
            </span>
          </div>

          <h1 className="max-w-4xl text-[4rem] font-black leading-[0.95] tracking-[-0.075em] text-[#1f1512] md:text-[6.4rem]">
            Transform your Instagram workday with AI you can rely on
          </h1>
          <p className="mt-8 max-w-2xl text-[1.35rem] leading-8 text-[#332925]">
            브랜드 기준을 저장하고 상품 설명만 입력하세요. 카드뉴스 구조, 슬라이드 카피,
            캡션과 예약 흐름까지 하나의 부드러운 작업 경험으로 이어집니다.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary px-8 text-base">
              데모 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#preview" className="btn-secondary px-8 text-base">
              화면 보기
            </a>
          </div>
        </div>

        <div id="preview" className="relative">
          <div className="paper-noise overflow-hidden rounded-[10px] bg-[#8fa5c6] p-10 shadow-[0_34px_100px_rgba(57,69,90,0.22)]">
            <div className="mx-auto max-w-[430px] rounded-[8px] border border-[#e8dfd4] bg-[#fffdf8] p-7 shadow-[0_18px_50px_rgba(31,21,18,0.12)]">
              <button className="mb-6 flex h-14 w-full items-center justify-center gap-3 rounded-[5px] border border-[#7d756c] bg-white text-lg font-black">
                <span className="text-[#4285f4]">G</span>
                Sign up with Google
              </button>
              <div className="mb-6 flex items-center gap-5 text-sm font-bold text-[#a29a91]">
                <div className="h-px flex-1 bg-[#e8dfd4]" />
                OR
                <div className="h-px flex-1 bg-[#e8dfd4]" />
              </div>
              <label className="mb-2 block text-sm font-black">Work email *</label>
              <div className="mb-6 h-14 rounded-[5px] border border-[#d8cec2] bg-white" />
              <p className="mb-6 text-sm leading-6 text-[#4a4039]">
                By signing up, you agree to review AI-generated content before publishing.
              </p>
              <Link href="/login" className="btn-primary w-full rounded-[5px] text-lg">
                Get started for free
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 pb-20 text-center lg:px-12">
        <p className="mb-8 text-xs font-black uppercase tracking-[0.16em] text-[#746a62]">
          Built for teams that publish repeatedly
        </p>
        <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-2xl font-black tracking-[-0.04em] text-[#b8b1a8]">
          {trustItems.map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section id="workflow" className="relative border-y border-[#e8dfd4] bg-[#f3fbff] py-24">
        <div className="soft-grid absolute inset-0" />
        <div className="relative mx-auto max-w-[1300px] px-6 text-center lg:px-12">
          <div className="mb-6 flex justify-center">
            <span className="rounded-full border border-[#bde7fa] bg-white px-5 py-2 text-sm font-black text-[#146c96]">
              CODE → WORK
            </span>
          </div>
          <h2 className="mx-auto max-w-5xl text-5xl font-black leading-[1.05] tracking-[-0.06em] md:text-7xl">
            모든 콘텐츠 운영에 에이전틱 AI를 적용하세요
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-8 text-[#4c6070]">
            Snowflake 스타일의 시원한 히어로처럼, 복잡한 운영 흐름을 하나의 명확한 작업 흐름으로 보여줍니다.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/login" className="btn-primary bg-[#2aa2db] px-8 hover:bg-[#168cc3]">
              캠페인 만들기
            </Link>
            <a href="#usecases" className="btn-secondary bg-white px-8">
              적용 분야 보기
            </a>
          </div>

          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="rounded-t-[8px] bg-[#242933] px-5 py-3 text-left shadow-[0_28px_80px_rgba(30,41,59,0.28)]">
              <div className="flex gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
              </div>
            </div>
            <div className="min-h-[300px] rounded-b-[8px] bg-[#282d37] p-10 text-left text-[#d8dee9] shadow-[0_28px_80px_rgba(30,41,59,0.28)]">
              <p className="font-mono text-lg text-[#9aa7b8]">InstaAgent</p>
              <p className="mt-6 font-mono text-xl leading-9">
                generate campaign --brand=&quot;daily mocha&quot;<br />
                plan slides --count=7 --tone=&quot;premium calm&quot;<br />
                schedule post --review-required
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="usecases" className="mx-auto max-w-[1300px] px-6 py-24 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ff4f0a]">Workflow</p>
            <h2 className="mt-4 text-5xl font-black leading-[1.04] tracking-[-0.06em]">
              대충 만든 카드가 아니라, 운영 가능한 초안을 만듭니다.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {workflow.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="rounded-[8px] border border-[#e8dfd4] bg-white p-7 shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
                  <Icon className="h-6 w-6 text-[#ff4f0a]" />
                  <h3 className="mt-8 text-2xl font-black tracking-[-0.04em]">{item.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#746a62]">{item.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-[#e8dfd4] bg-white py-20">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12">
          <div className="rounded-[10px] bg-[#1f1512] p-10 text-white md:flex md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ffb69a]">Demo Ready</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">먼저 실제 흐름을 만져보세요.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                mock DB와 mock Instagram 연결로 바로 테스트할 수 있습니다.
              </p>
            </div>
            <Link href="/login" className="mt-8 inline-flex rounded-full bg-[#ff4f0a] px-8 py-4 text-base font-black text-white md:mt-0">
              데모 입장 <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8dfd4] py-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-6 text-sm font-bold text-[#746a62] md:flex-row md:items-center md:justify-between lg:px-12">
          <span className="text-xl font-black tracking-[-0.05em] text-[#1f1512]">InstaAgent</span>
          <div className="flex gap-5">
            <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" /> MVP Demo</span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
