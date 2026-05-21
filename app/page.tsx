import Link from 'next/link'
import { ArrowRight, Check, Layers, Sparkles, Type, Wand2 } from 'lucide-react'

export const metadata = {
  title: 'InstaAgent - 인스타그램 카드뉴스 자동화',
  description:
    '주제와 핵심 내용을 입력하면 한국형 인스타그램 카드뉴스를 기획, 레이아웃, 타이포그래피, PNG 렌더링까지 자동화합니다.',
}

const steps = [
  '주제와 핵심 내용 입력',
  '뉴스형/트렌드형/정보형 레이아웃 선택',
  '배경 이미지와 오버레이 생성',
  '한글 타이포그래피 합성',
  '1080x1350 PNG 결과물 저장',
]

const features = [
  {
    title: '카드뉴스 구조 설계',
    desc: '제목, 본문, 강조 문구, 페이지 흐름을 먼저 잡아 정보 전달력을 높입니다.',
    icon: Layers,
  },
  {
    title: '한글 타이포그래피',
    desc: '이미지 모델에 글자를 맡기지 않고 렌더러에서 줄바꿈과 강조를 제어합니다.',
    icon: Type,
  },
  {
    title: '최종 이미지 렌더링',
    desc: '배경, 오버레이, 워터마크, 페이지 표시를 합성해 바로 확인 가능한 PNG를 만듭니다.',
    icon: Wand2,
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#101827]">
      <section className="blue-animated-bg relative flex min-h-screen flex-col">
        <header className="relative z-20 border-b border-[#dbe8f7]/70 bg-white/72 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 lg:px-10">
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[-0.035em]">
              <span className="h-2 w-7 rounded-full bg-[#1c7ed6]" />
              InstaAgent
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-bold text-[#314158] md:flex">
              <a href="#flow">생성 흐름</a>
              <a href="#features">핵심 기능</a>
              <a href="#start">시작하기</a>
            </nav>
            <Link href="/login" className="btn-blue px-5">
              무료로 시작
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-1 flex-col items-center justify-center px-6 py-20 text-center lg:px-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#c7ddf4] bg-white/72 px-4 py-2 text-sm font-black text-[#1c5f9e] shadow-[0_14px_40px_rgba(28,126,214,0.08)] backdrop-blur">
            <Sparkles className="h-4 w-4" />
            한국형 인스타그램 카드뉴스 생성 SaaS
          </div>

          <h1 className="max-w-4xl text-[2.65rem] font-black leading-[1.08] tracking-[-0.055em] text-[#0d1726] sm:text-5xl lg:text-[4.8rem]">
            인스타그램 카드뉴스 자동화를
            <br className="hidden sm:block" />
            지금 시도해보세요
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-7 text-[#40536b] sm:text-lg md:text-xl md:leading-8">
            주제와 핵심 내용만 입력하면 카드뉴스 스타일 선택, 레이아웃 구성, 배경 이미지 생성,
            한글 타이포그래피 합성, PNG 렌더링까지 한 번에 진행합니다.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login" className="btn-blue px-8 text-base">
              카드뉴스 자동화 시작하기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#flow" className="btn-blue-secondary px-8 text-base">
              어떻게 만들어지는지 보기
            </a>
          </div>

          <div className="mt-14 grid w-full max-w-4xl gap-3 rounded-[10px] border border-[#d9e8f7] bg-white/68 p-4 text-left shadow-[0_24px_80px_rgba(32,92,145,0.12)] backdrop-blur md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[8px] bg-white/74 p-4">
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#e7f3ff] text-xs font-black text-[#1c7ed6]">
                  {index + 1}
                </div>
                <p className="text-sm font-black leading-5 tracking-[-0.02em] text-[#203047]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="flow" className="border-y border-[#e3edf7] bg-white py-20">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-6 lg:grid-cols-[420px_1fr] lg:px-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">Automation flow</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.045em] text-[#0d1726] md:text-5xl">
              이미지는 분위기만, 글자는 렌더러가 정확하게 합성합니다.
            </h2>
          </div>
          <div className="grid gap-4">
            {steps.map((step) => (
              <div key={step} className="flex items-center gap-4 rounded-[8px] border border-[#e3edf7] bg-[#fbfdff] p-5">
                <Check className="h-5 w-5 shrink-0 text-[#1c7ed6]" />
                <p className="text-base font-bold text-[#314158]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#f7fbff] py-20">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">Core engine</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.045em] text-[#0d1726] md:text-5xl">
              카드뉴스 전체를 이미지 모델에 맡기지 않습니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#40536b]">
              배경 생성, 레이아웃, 타이포그래피, 오버레이를 분리해 실제 피드에서 읽히는 결과물을 만듭니다.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <article key={feature.title} className="rounded-[10px] border border-[#dcebf8] bg-white p-7 shadow-[0_18px_60px_rgba(32,92,145,0.08)]">
                  <Icon className="h-6 w-6 text-[#1c7ed6]" />
                  <h3 className="mt-7 text-2xl font-black tracking-[-0.04em] text-[#0d1726]">{feature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#53657b]">{feature.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="start" className="bg-white py-20">
        <div className="mx-auto max-w-[1180px] px-6 text-center lg:px-10">
          <h2 className="text-3xl font-black tracking-[-0.045em] text-[#0d1726] md:text-5xl">
            첫 카드뉴스 생성을 바로 테스트하세요.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#40536b]">
            로그인 후 주제, 카테고리, 제목, 핵심 내용을 입력하면 자동화된 카드뉴스 생성 흐름을 확인할 수 있습니다.
          </p>
          <Link href="/login" className="btn-blue mt-8 px-8 text-base">
            시작하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
