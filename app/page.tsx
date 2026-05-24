import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Calendar, Send, Sparkles, Wand2 } from 'lucide-react'
import { MarketingNav } from './components/MarketingNav'
import { MarketingFooter } from './components/MarketingFooter'

export const metadata = {
  title: 'Shuffla — AI 카드뉴스 자동화',
  description: '브랜드 정보만 입력하면 AI가 카드뉴스를 만들고 인스타그램에 자동 발행합니다.',
}

const showcaseImages = [
  { src: '/background-showcase/showcase-1.webp', alt: 'Shuffla 카드뉴스 예시 1' },
  { src: '/background-showcase/showcase-2.webp', alt: 'Shuffla 카드뉴스 예시 2' },
  { src: '/background-showcase/showcase-3.webp', alt: 'Shuffla 카드뉴스 예시 3' },
]

const features = [
  {
    icon: Wand2,
    title: 'AI 카드뉴스 생성',
    desc: '주제만 입력하면 슬라이드 구성, 헤드라인, 본문, 이미지까지 한 번에 완성됩니다.',
    color: 'from-[#ff6b35] to-[#f7931e]',
  },
  {
    icon: Sparkles,
    title: '브랜드 톤 자동 학습',
    desc: '브랜드 URL 한 번이면 AI가 업종·타깃·말투를 학습해 일관된 카드뉴스를 만듭니다.',
    color: 'from-[#1c7ed6] to-[#339af0]',
  },
  {
    icon: Send,
    title: 'Instagram 자동 발행',
    desc: '계정 한 번 연결하면 승인된 카드뉴스가 예약 시간에 자동으로 게시됩니다.',
    color: 'from-[#0a0a0a] to-[#404040]',
  },
  {
    icon: Calendar,
    title: '캘린더 콘텐츠 관리',
    desc: '예약된 게시물을 한 화면에서 보고, 발행 전 수정·재예약·삭제가 가능합니다.',
    color: 'from-[#7950f2] to-[#9775fa]',
  },
]

const steps = [
  { n: '01', title: '브랜드 설정', desc: 'URL이나 몇 가지 질문으로 브랜드 프로필 한 번에 완성' },
  { n: '02', title: '카드뉴스 생성', desc: '주제 입력 → AI가 슬라이드·문구·이미지 자동 생성' },
  { n: '03', title: '검토 & 발행', desc: '확인 후 승인하면 예약된 시간에 자동으로 인스타 게시' },
]

const stats = [
  { value: '5분', label: '카드뉴스 1세트 제작 시간' },
  { value: '90%', label: '반복 작업 시간 절감' },
  { value: '24/7', label: '예약 자동 발행' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#0a0a0a] selection:bg-[#ff6b35]/20">
      <MarketingNav />

      {/* ───────── HERO ───────── */}
      <section className="relative overflow-hidden bg-[#fafaf7]">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[700px] w-[1200px] rounded-full bg-gradient-to-br from-[#ff6b35]/8 via-[#ffd6a5]/12 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-40 right-0 h-[400px] w-[400px] rounded-full bg-gradient-to-bl from-[#1c7ed6]/10 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:px-8 lg:pt-28 lg:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[12px] font-bold text-[#525252] shadow-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ff6b35] animate-pulse" />
              AI 카드뉴스 자동화 플랫폼 · Beta 오픈
            </div>
            <h1 className="mt-7 text-[44px] font-black leading-[1.05] tracking-[-0.045em] text-[#0a0a0a] md:text-[68px]">
              인스타그램 카드뉴스,<br />
              <span className="relative inline-block">
                <span className="relative z-10">AI가 만들고 올립니다</span>
                <span className="absolute -bottom-1 left-0 right-0 h-3 bg-[#ff6b35]/25 -z-0" />
              </span>
            </h1>
            <p className="mx-auto mt-7 max-w-xl text-[17px] leading-[1.6] text-[#525252]">
              브랜드 정보만 입력하면 AI가 슬라이드를 구성하고,<br className="hidden md:inline" />
              검토 후 승인하면 인스타그램으로 자동 발행됩니다.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#0a0a0a] px-7 text-[15px] font-bold text-white transition-all hover:bg-[#1a1a1a] hover:-translate-y-[1px] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
              >
                무료로 시작하기
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-7 text-[15px] font-bold text-[#0a0a0a] transition-all hover:border-black/20"
              >
                작동 방식 보기
              </a>
            </div>
            <p className="mt-5 text-[13px] text-[#8a8a8a]">신용카드 불필요 · 무료 플랜 제공</p>
          </div>

          {/* Hero visual */}
          <div className="relative mt-16 lg:mt-20">
            <div className="absolute inset-0 -top-8 bg-gradient-to-b from-transparent via-[#fafaf7]/60 to-[#fafaf7] z-10 pointer-events-none" />
            <div className="relative mx-auto max-w-5xl">
              <div className="relative rounded-[28px] border border-black/[0.06] bg-white p-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.02)]">
                <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#f5f1ea] via-[#fbf8f3] to-[#f0eae0] p-8 md:p-12">
                  <div className="grid grid-cols-3 gap-4 md:gap-6">
                    {showcaseImages.map((img, i) => (
                      <div
                        key={img.alt}
                        className={`relative aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_20px_50px_-15px_rgba(0,0,0,0.25)] ${i === 1 ? 'translate-y-0' : 'translate-y-6'}`}
                      >
                        <Image
                          src={img.src}
                          alt={img.alt}
                          fill
                          priority
                          sizes="(min-width: 1024px) 300px, 30vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── STATS ───────── */}
      <section className="relative border-y border-black/[0.06] bg-white py-14">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center md:text-left">
                <div className="text-[44px] md:text-[52px] font-black tracking-[-0.04em] text-[#0a0a0a] leading-none">
                  {s.value}
                </div>
                <p className="mt-3 text-[14px] font-medium text-[#525252]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section id="features" className="bg-[#fafaf7] py-28 lg:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl mb-16 lg:mb-20">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Features</p>
            <h2 className="mt-5 text-[36px] md:text-[48px] font-black leading-[1.08] tracking-[-0.04em] text-[#0a0a0a]">
              기획부터 발행까지,<br />하나의 워크플로우로
            </h2>
            <p className="mt-5 text-[17px] leading-[1.6] text-[#525252]">
              디자이너·기획자·운영자 따로 둘 필요 없이 Shuffla 하나로 모든 카드뉴스 작업을 처리합니다.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <article
                  key={f.title}
                  className="group relative overflow-hidden rounded-[20px] border border-black/[0.06] bg-white p-8 md:p-10 transition-all hover:border-black/[0.12] hover:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.08)]"
                >
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.color} text-white shadow-lg`}>
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <h3 className="mt-7 text-[22px] font-black tracking-[-0.025em] text-[#0a0a0a]">{f.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.65] text-[#525252]">{f.desc}</p>
                  <div className="absolute right-8 top-8 opacity-0 transition-opacity group-hover:opacity-100">
                    <ArrowUpRight className="h-5 w-5 text-[#0a0a0a]" />
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ───────── HOW IT WORKS ───────── */}
      <section id="how-it-works" className="relative bg-[#0a0a0a] py-28 lg:py-32 text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(28,126,214,0.08),transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl mb-16 lg:mb-20">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">How it works</p>
            <h2 className="mt-5 text-[36px] md:text-[48px] font-black leading-[1.08] tracking-[-0.04em] text-white">
              세 단계로 끝나는<br />카드뉴스 자동화
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 border border-white/15 text-[13px] font-black text-white">
                    {s.n}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden md:block flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                </div>
                <h3 className="text-[24px] font-black tracking-[-0.025em] text-white">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-[1.65] text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FINAL CTA ───────── */}
      <section className="relative overflow-hidden bg-[#fafaf7] py-24 lg:py-28">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff6b35] via-[#ff8b3d] to-[#ffd6a5] p-12 md:p-20 text-center">
            <div className="pointer-events-none absolute -top-32 -right-32 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#0a0a0a]/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-[36px] md:text-[56px] font-black tracking-[-0.04em] leading-[1.05] text-[#0a0a0a]">
                첫 카드뉴스를<br />지금 바로 만들어 보세요
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-[16px] leading-[1.6] text-[#0a0a0a]/75">
                로그인 후 브랜드를 설정하고 주제를 입력하면 AI가 카드뉴스를 완성합니다.
              </p>
              <Link
                href="/login"
                className="mt-10 inline-flex h-13 items-center gap-2 rounded-full bg-[#0a0a0a] px-8 py-3.5 text-[16px] font-bold text-white hover:bg-[#1a1a1a] hover:-translate-y-[1px] transition-all"
              >
                무료로 시작하기 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
