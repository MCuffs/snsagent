import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, ClipboardList, Images, LogIn, PenLine, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'InstaAgent - 인스타그램 카드뉴스 자동화',
  description:
    '반복되는 카드뉴스 제작 업무를 간편하게 처리합니다. 주제만 입력하면 문구 정리, 화면 구성, 이미지 저장까지 이어집니다.',
}

const repeatedTasks = [
  '매번 새로 짜는 카드뉴스 구성',
  '제목과 본문을 다시 다듬는 작업',
  '피드에 어울리는 분위기 맞추기',
  '슬라이드별 핵심 문구 정리',
]

const supportCards = [
  {
    title: '내용을 정리합니다',
    desc: '긴 설명을 카드뉴스에 맞게 나누고, 첫 장에서 바로 읽히는 문장으로 다듬습니다.',
    icon: ClipboardList,
  },
  {
    title: '분위기를 맞춥니다',
    desc: '뉴스형, 트렌드형, 정보형 콘텐츠에 맞는 톤과 화면 구성을 추천합니다.',
    icon: Sparkles,
  },
  {
    title: '이미지로 완성합니다',
    desc: '검토할 수 있는 카드 이미지를 만들어 반복 편집 시간을 줄입니다.',
    icon: Images,
  },
]

const quickFlow = ['주제 입력', '내용 정리', '카드 구성', '결과 확인']

const showcaseImages = [
  { src: '/background-showcase/showcase-1.webp', alt: '카드뉴스 자동화 예시 이미지 1', className: 'showcase-slide-one' },
  { src: '/background-showcase/showcase-2.webp', alt: '카드뉴스 자동화 예시 이미지 2', className: 'showcase-slide-two' },
  { src: '/background-showcase/showcase-3.webp', alt: '카드뉴스 자동화 예시 이미지 3', className: 'showcase-slide-three' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#101827]">
      <section className="premium-blue-bg relative flex min-h-screen flex-col">
        <div className="ambient-lines" />
        <header className="relative z-20 border-b border-[#dbe8f7]/70 bg-white/68 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 lg:px-10">
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[-0.035em]">
              <span className="h-2 w-7 rounded-full bg-[#1c7ed6]" />
              InstaAgent
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-bold text-[#314158] md:flex">
              <a href="#identity">핵심 가치</a>
              <a href="#support">도움받는 일</a>
              <a href="#start">시작하기</a>
            </nav>
            <Link href="/login" className="btn-blue px-5">
              무료로 시작
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] lg:px-10 lg:py-20">
          <div className="order-2 lg:order-1">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c7ddf4] bg-white/72 px-4 py-2 text-sm font-black text-[#1c5f9e] shadow-[0_14px_40px_rgba(28,126,214,0.08)] backdrop-blur">
              <Sparkles className="h-4 w-4" />
              예시 카드가 순서대로 표시됩니다
            </div>

            <div className="hero-showcase-frame">
              <div className="showcase-carousel" aria-hidden="true">
                {showcaseImages.map((image) => (
                  <div key={image.alt} className={`showcase-slide ${image.className}`}>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      priority
                      sizes="(min-width: 1024px) 420px, 80vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {quickFlow.map((item, index) => (
                <div key={item} className="rounded-[8px] border border-[#d9e8f7] bg-white/66 p-4 shadow-[0_12px_36px_rgba(32,92,145,0.07)] backdrop-blur">
                  <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#e7f3ff] text-xs font-black text-[#1c7ed6]">
                    {index + 1}
                  </div>
                  <p className="text-sm font-black leading-5 tracking-[-0.02em] text-[#203047]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 rounded-[16px] border border-[#d9e8f7] bg-white/72 p-7 shadow-[0_28px_90px_rgba(32,92,145,0.12)] backdrop-blur-xl lg:order-2 lg:p-9">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">InstaAgent</p>
            <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-0.055em] text-[#0d1726] md:text-5xl">
              불필요한 반복 작업을 간편하게 처리합니다
            </h1>
            <p className="mt-6 text-base leading-7 text-[#40536b] md:text-lg">
              주제와 핵심 내용만 입력하면 카드뉴스에 맞게 내용을 정리하고, 바로 확인할 수 있는 결과물까지 만들어줍니다.
            </p>

            <div className="mt-8 grid gap-3">
              <Link href="/login" className="btn-blue min-h-[3.5rem] px-8 text-base">
                바로 이용하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="btn-blue-secondary min-h-[3.5rem] px-8 text-base">
                로그인하기
                <LogIn className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-7 grid gap-3 text-sm font-bold text-[#314158]">
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-[#1c7ed6]" />
                카드뉴스 초안을 빠르게 확인
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-[#1c7ed6]" />
                반복 편집 시간을 줄이는 제작 흐름
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="identity" className="relative border-y border-[#e3edf7] bg-white py-20">
        <div className="section-sheen" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 px-6 lg:grid-cols-[420px_1fr] lg:px-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">Core identity</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.045em] text-[#0d1726] md:text-5xl">
              매번 반복하던 준비 과정을 짧게 줄입니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#40536b]">
              카드뉴스를 만들 때마다 다시 고민하던 구성, 문구, 분위기, 저장 과정을 한 흐름으로 묶습니다.
            </p>
          </div>
          <div className="grid gap-4">
            {repeatedTasks.map((task) => (
              <div key={task} className="flex items-center gap-4 rounded-[8px] border border-[#e3edf7] bg-[#fbfdff]/88 p-5 shadow-[0_12px_40px_rgba(32,92,145,0.05)]">
                <Check className="h-5 w-5 shrink-0 text-[#1c7ed6]" />
                <p className="text-base font-bold text-[#314158]">{task}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="bg-[#f7fbff] py-20">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">What it helps</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.045em] text-[#0d1726] md:text-5xl">
              어려운 설정 없이 카드뉴스 초안을 만듭니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#40536b]">
              사용자는 만들고 싶은 내용을 입력하고, 결과를 확인하고, 필요한 부분만 고치면 됩니다.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {supportCards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.title} className="premium-card rounded-[10px] border border-[#dcebf8] bg-white p-7">
                  <Icon className="h-6 w-6 text-[#1c7ed6]" />
                  <h3 className="mt-7 text-2xl font-black tracking-[-0.04em] text-[#0d1726]">{card.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#53657b]">{card.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="start" className="bg-white py-20">
        <div className="mx-auto max-w-[1180px] px-6 text-center lg:px-10">
          <div className="mx-auto mb-7 flex h-12 w-12 items-center justify-center rounded-full border border-[#c7ddf4] bg-[#f1f8ff] text-[#1c7ed6] shadow-[0_14px_40px_rgba(28,126,214,0.1)]">
            <PenLine className="h-5 w-5" />
          </div>
          <h2 className="text-3xl font-black tracking-[-0.045em] text-[#0d1726] md:text-5xl">
            첫 카드뉴스를 바로 만들어보세요.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#40536b]">
            로그인 후 주제, 제목, 핵심 내용을 입력하면 카드뉴스 제작 흐름을 바로 테스트할 수 있습니다.
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
