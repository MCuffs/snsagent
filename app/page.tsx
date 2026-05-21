import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, ClipboardList, Images, PenLine, Sparkles } from 'lucide-react'

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

const showcaseImages = [
  { src: '/background-showcase/showcase-1.webp', alt: '카드뉴스 자동화 예시 이미지 1' },
  { src: '/background-showcase/showcase-2.webp', alt: '카드뉴스 자동화 예시 이미지 2' },
  { src: '/background-showcase/showcase-3.webp', alt: '카드뉴스 자동화 예시 이미지 3' },
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

          <div className="order-1 rounded-[16px] border border-[#d9e8f7] bg-white/76 p-8 text-center shadow-[0_28px_90px_rgba(32,92,145,0.12)] backdrop-blur-xl lg:order-2 lg:p-10">
            <h1 className="text-4xl font-black tracking-[-0.055em] text-[#0d1726] md:text-5xl">
              InstaAgent
            </h1>
            <Link href="/api/auth/google/start" className="btn-google mt-9 w-full text-base">
              <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
                />
              </svg>
              Google 계정으로 계속하기
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
