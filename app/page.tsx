import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, Download, Images, PenLine, Type } from 'lucide-react'

export const metadata = {
  title: 'Shuffla - AI 카드뉴스 스튜디오',
  description: '주제만 입력하면 카드뉴스를 만들고, 문구를 편집하고, 이미지로 다운로드하는 AI 제작 도구입니다.',
}

const repeatedTasks = [
  '카드뉴스 구성 잡기',
  '제목과 본문 다시 다듬기',
  '브랜드 톤에 맞는 비주얼 만들기',
  '슬라이드별 이미지 저장하기',
]

const supportCards = [
  {
    title: '문구를 정리합니다',
    desc: '긴 설명을 카드뉴스에 맞는 헤드라인과 짧은 본문으로 나눕니다.',
    icon: Type,
  },
  {
    title: '이미지를 만듭니다',
    desc: '브랜드와 주제에 맞는 배경 이미지를 만들고 카드 형태로 합성합니다.',
    icon: Images,
  },
  {
    title: '바로 다운로드합니다',
    desc: '완성된 슬라이드를 개별 또는 전체 이미지 파일로 저장할 수 있습니다.',
    icon: Download,
  },
]

const showcaseImages = [
  { src: '/background-showcase/showcase-1.webp', alt: 'Shuffla 카드뉴스 예시 1' },
  { src: '/background-showcase/showcase-2.webp', alt: 'Shuffla 카드뉴스 예시 2' },
  { src: '/background-showcase/showcase-3.webp', alt: 'Shuffla 카드뉴스 예시 3' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#101827]">
      <section className="premium-blue-bg relative flex min-h-screen flex-col">
        <div className="ambient-lines" />
        <header className="relative z-20 border-b border-[#dbe8f7]/70 bg-white/68 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 lg:px-10">
            <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[-0.035em]">
              <span className="h-1.5 w-7 rounded-[2px] bg-[#1c7ed6]" />
              Shuffla
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-bold text-[#314158] md:flex">
              <a href="#identity">핵심 가치</a>
              <a href="#support">기능</a>
              <a href="#start">시작하기</a>
            </nav>
            <Link href="/api/auth/google/start" className="btn-blue px-5">
              구글 로그인하기
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-[1180px] flex-1 items-center gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] lg:px-10 lg:py-20">
          <div className="order-2 lg:order-1">
            <div className="hero-showcase-frame">
              <div className="showcase-carousel" aria-hidden="true">
                <div className="showcase-track">
                  {showcaseImages.map((image) => (
                    <Image
                      key={image.alt}
                      src={image.src}
                      alt={image.alt}
                      width={410}
                      height={512}
                      priority
                      sizes="(min-width: 1024px) 420px, 80vw"
                      className="showcase-image"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="login-panel order-1 p-8 text-center lg:order-2 lg:p-10">
            <h1 className="login-brand">Shuffla</h1>
            <p className="mt-5 text-sm font-bold leading-6 text-[#40536b]">
              카드뉴스 생성, 편집, 다운로드를 한 화면에서 끝내는 AI 스튜디오
            </p>
            <Link href="/api/auth/google/start" className="btn-blue mt-9 w-full text-base">
              구글 로그인하기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="identity" className="relative border-y border-[#e3edf7] bg-white py-20">
        <div className="section-sheen" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 px-6 lg:grid-cols-[420px_1fr] lg:px-10">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#1c7ed6]">Core identity</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.12] tracking-[-0.045em] text-[#0d1726] md:text-5xl">
              카드뉴스 제작의 반복 작업을 줄입니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#40536b]">
              주제와 브랜드 정보만 입력하면 구성, 문구, 이미지, 렌더링까지 이어서 처리합니다.
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
              만들고, 고치고, 저장합니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#40536b]">
              SNS 자동 업로드는 추후 출시 예정이며, 현재는 카드뉴스 제작과 다운로드 경험에 집중합니다.
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
            첫 카드뉴스를 바로 만들어 보세요.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#40536b]">
            로그인 후 브랜드를 설정하고 주제를 입력하면 결과 화면에서 편집과 다운로드를 할 수 있습니다.
          </p>
          <Link href="/api/auth/google/start" className="btn-blue mt-8 px-8 text-base">
            구글 로그인하기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
