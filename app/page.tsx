import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ImagePlus,
  LayoutTemplate,
  Newspaper,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react'

export const metadata = {
  title: 'InstaAgent - 한국형 인스타그램 카드뉴스 생성 SaaS',
  description:
    '주제와 핵심 내용을 입력하면 뉴스형, 트렌드형, 정보형 인스타그램 카드뉴스를 기획부터 PNG 렌더링까지 생성합니다.',
}

const workflow = [
  {
    title: '콘텐츠 입력',
    desc: '주제, 카테고리, 제목, 핵심 내용을 입력하면 카드뉴스에 맞는 정보 구조를 먼저 정리합니다.',
    icon: Newspaper,
  },
  {
    title: '스타일 선택',
    desc: '뉴스형, 트렌드형, 정보형, 미디어형 중 콘텐츠 목적에 맞는 레이아웃을 자동으로 고릅니다.',
    icon: LayoutTemplate,
  },
  {
    title: '배경 생성',
    desc: '이미지 모델은 분위기와 장면만 만들고, 한글 텍스트는 렌더러에서 별도로 합성합니다.',
    icon: ImagePlus,
  },
  {
    title: 'PNG 렌더링',
    desc: '타이포그래피, 오버레이, 워터마크, 페이지 표시를 합성해 1080x1350 결과물을 만듭니다.',
    icon: Wand2,
  },
]

const styleCards = [
  {
    title: '뉴스형 카드뉴스',
    desc: '이슈 요약, 정책 변화, 시장 뉴스처럼 신뢰감과 가독성이 중요한 콘텐츠에 맞춥니다.',
  },
  {
    title: '트렌드형 카드뉴스',
    desc: '커뮤니티 반응, 밈, 소비 트렌드를 빠르게 훑을 수 있는 피드형 구성으로 만듭니다.',
  },
  {
    title: '정보형 카드뉴스',
    desc: '체크리스트, 가이드, 비교표처럼 저장 가치가 높은 구조로 정리합니다.',
  },
  {
    title: '미디어형 카드뉴스',
    desc: '강한 헤드라인과 이미지 무드가 필요한 에디토리얼 콘텐츠에 사용합니다.',
  },
]

const trustItems = ['한글 타이포그래피', '1080x1350 PNG', '오버레이 합성', '카드뉴스 레이아웃', '검수 체크']

export default function LandingPage() {
  return (
    <main className="app-shell min-h-screen overflow-hidden text-[#1f1512]">
      <div className="bg-[#080706] px-5 py-3 text-center text-sm font-bold text-white">
        한국형 인스타그램 카드뉴스 생성 엔진을 개발 중입니다.
        <Link href="/login" className="ml-3 underline decoration-white/50 underline-offset-4">
          무료로 시작하기
        </Link>
      </div>

      <header className="sticky top-0 z-30 border-b border-[#ece2d6] bg-[#fffdf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-[-0.04em]">
            <span className="h-1.5 w-7 rounded-full bg-[#ff4f0a]" />
            InstaAgent
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-black text-[#1f1512] lg:flex">
            <a href="#service">서비스</a>
            <a href="#workflow">생성 흐름</a>
            <a href="#styles">예시 스타일</a>
            <a href="#start">시작하기</a>
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

      <section
        id="service"
        className="relative mx-auto grid min-h-[720px] max-w-[1500px] items-center gap-14 px-6 py-18 lg:grid-cols-[1fr_560px] lg:px-12 lg:py-20"
      >
        <div className="relative z-10 max-w-4xl">
          <div className="mb-8 flex flex-wrap gap-4 text-xs font-black uppercase tracking-[0.08em] text-[#746a62]">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" /> Korean media card engine
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-4 w-4" /> AI image + renderer pipeline
            </span>
          </div>

          <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-[-0.055em] text-[#1f1512] sm:text-5xl lg:text-[4.7rem]">
            인스타그램 카드뉴스를
            <br />
            기획부터 PNG 렌더링까지
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#332925] md:text-xl">
            주제와 핵심 내용만 입력하면 뉴스형, 트렌드형, 정보형 카드뉴스를 자동으로 구성합니다.
            배경 이미지는 AI가 만들고, 한글 제목과 본문은 별도 렌더러가 합성해 실제 미디어 계정처럼
            읽히는 결과물을 만듭니다.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary px-8 text-base">
              카드뉴스 만들기
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#workflow" className="btn-secondary px-8 text-base">
              생성 흐름 보기
            </a>
          </div>
        </div>

        <div id="preview" className="relative">
          <div className="paper-noise overflow-hidden rounded-[10px] bg-[#eef3ef] p-6 shadow-[0_34px_100px_rgba(57,69,90,0.16)] md:p-8">
            <div className="grid gap-5">
              <div className="rounded-[8px] border border-[#e4d8ca] bg-[#fffdf8] p-5 shadow-[0_18px_50px_rgba(31,21,18,0.08)]">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-[#746a62]">
                  <span>Preview</span>
                  <span>1080x1350</span>
                </div>
                <div className="mt-4 aspect-[4/5] overflow-hidden rounded-[8px] bg-[#171412] p-6 text-white">
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#ff4f0a] px-3 py-1 text-xs font-black">
                        AI 뉴스
                      </span>
                      <span className="text-xs font-bold text-white/65">1 / 5</span>
                    </div>
                    <div>
                      <p className="mb-4 text-sm font-bold text-[#ffb69a]">오늘의 핵심 이슈</p>
                      <h2 className="text-4xl font-black leading-[1.05] tracking-[-0.055em]">
                        생성형 AI가
                        <br />
                        콘텐츠 팀의
                        <br />
                        작업 방식을 바꾼다
                      </h2>
                      <p className="mt-5 text-sm leading-6 text-white/78">
                        배경 이미지는 분위기만 담당하고, 제목과 본문은 렌더링 엔진에서 정확하게 합성합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[8px] border border-[#e4d8ca] bg-white p-5 shadow-[0_18px_50px_rgba(31,21,18,0.05)]">
                <div className="mb-4 flex items-center gap-2 text-sm font-black text-[#1f1512]">
                  <Sparkles className="h-4 w-4 text-[#ff4f0a]" />
                  생성 파이프라인
                </div>
                <div className="grid gap-3 text-sm font-bold text-[#4a4039]">
                  <div className="flex items-center justify-between rounded-[6px] bg-[#fff7ef] px-4 py-3">
                    <span>레이아웃 선택</span>
                    <Check className="h-4 w-4 text-[#ff4f0a]" />
                  </div>
                  <div className="flex items-center justify-between rounded-[6px] bg-[#f5f1ea] px-4 py-3">
                    <span>한글 타이포그래피 계획</span>
                    <Check className="h-4 w-4 text-[#ff4f0a]" />
                  </div>
                  <div className="flex items-center justify-between rounded-[6px] bg-[#eef5f2] px-4 py-3">
                    <span>최종 PNG 렌더링</span>
                    <Check className="h-4 w-4 text-[#ff4f0a]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-6 pb-18 text-center lg:px-12">
        <p className="mb-8 text-xs font-black uppercase tracking-[0.16em] text-[#746a62]">
          카드뉴스 제작에 필요한 핵심 구성
        </p>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-xl font-black tracking-[-0.035em] text-[#b8b1a8] md:text-2xl">
          {trustItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section id="workflow" className="relative border-y border-[#e8dfd4] bg-[#f8f5ef] py-22 md:py-24">
        <div className="soft-grid absolute inset-0" />
        <div className="relative mx-auto max-w-[1300px] px-6 lg:px-12">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full border border-[#ead8c6] bg-white px-5 py-2 text-sm font-black text-[#8f4b20]">
              이미지 생성기가 아니라 콘텐츠 렌더링 엔진
            </span>
            <h2 className="mt-6 text-3xl font-black leading-[1.12] tracking-[-0.05em] md:text-5xl">
              예쁜 이미지보다, 읽고 저장하고 싶은 카드뉴스를 만듭니다.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#5d544d]">
              이미지 생성, 레이아웃, 타이포그래피, 오버레이, 텍스트 렌더링을 분리해 한글 가독성을
              우선합니다.
            </p>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.title}
                  className="rounded-[8px] border border-[#e8dfd4] bg-white p-6 shadow-[0_18px_50px_rgba(31,21,18,0.05)]"
                >
                  <Icon className="h-6 w-6 text-[#ff4f0a]" />
                  <h3 className="mt-7 text-xl font-black tracking-[-0.035em]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#746a62]">{item.desc}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="styles" className="mx-auto max-w-[1300px] px-6 py-22 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[420px_1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ff4f0a]">Card styles</p>
            <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-[-0.05em] md:text-5xl">
              콘텐츠 목적에 따라 다른 카드뉴스 구조를 사용합니다.
            </h2>
            <p className="mt-5 text-base leading-7 text-[#746a62]">
              모든 결과물은 모바일 피드에서 먼저 읽히도록 제목 크기, 줄바꿈, 안전 영역을 계산합니다.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {styleCards.map((item) => (
              <article
                key={item.title}
                className="rounded-[8px] border border-[#e8dfd4] bg-white p-7 shadow-[0_18px_50px_rgba(31,21,18,0.05)]"
              >
                <Type className="h-5 w-5 text-[#ff4f0a]" />
                <h3 className="mt-7 text-2xl font-black tracking-[-0.04em]">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-[#746a62]">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="border-t border-[#e8dfd4] bg-white py-20">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12">
          <div className="rounded-[10px] bg-[#1f1512] p-8 text-white md:flex md:items-center md:justify-between md:p-10">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ffb69a]">MVP Demo</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] md:text-4xl">
                지금 바로 카드뉴스 생성 흐름을 테스트하세요.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
                로그인 후 주제와 핵심 내용을 입력하면 미디어 카드뉴스 초안을 생성하고 결과 이미지를 확인할 수 있습니다.
              </p>
            </div>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-full bg-[#ff4f0a] px-8 py-4 text-base font-black text-white md:mt-0"
            >
              시작하기 <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e8dfd4] py-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-6 text-sm font-bold text-[#746a62] md:flex-row md:items-center md:justify-between lg:px-12">
          <span className="text-xl font-black tracking-[-0.05em] text-[#1f1512]">InstaAgent</span>
          <div className="flex gap-5">
            <span className="inline-flex items-center gap-1">
              <Check className="h-4 w-4" /> MVP Demo
            </span>
            <span>2026</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
