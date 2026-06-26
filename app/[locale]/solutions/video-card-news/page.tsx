import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { MarketingNav } from '../../../components/MarketingNav'
import { MarketingFooter } from '../../../components/MarketingFooter'
import { FadeUp, ScaleIn } from '../../../components/ScrollAnimations'
import { getSessionUser } from '../../../../lib/auth/user'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'Video Card News — Shuffla' : '영상 카드뉴스 솔루션 — Shuffla',
    description: isEn
      ? 'Create AI-powered video card news from any topic. Script, scenes, stock video, subtitles — all automated.'
      : 'AI가 주제에서 영상 카드뉴스를 자동 제작합니다. 기획·스크립트·영상·자막까지 원클릭.',
    alternates: { canonical: `${base}/${locale}/solutions/video-card-news` },
    openGraph: {
      title: isEn ? 'Video Card News — Shuffla' : '영상 카드뉴스 솔루션 — Shuffla',
      url: `${base}/${locale}/solutions/video-card-news`,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  }
}

const STEPS = [
  {
    num: '01',
    ko: '주제 입력',
    en: 'Enter a topic',
    desc: 'URL 또는 키워드를 입력하면 AI가 채널·브랜드 컨텍스트를 파악합니다.',
    descEn: 'Enter a URL or keyword — AI reads the brand and topic context.',
  },
  {
    num: '02',
    ko: 'AI 씬 기획',
    en: 'AI plans the scenes',
    desc: '훅→전개→CTA 구조로 씬별 카피·스톡 영상 후보를 자동 설계합니다.',
    descEn: 'Hook → build → CTA structure is auto-designed with copy and stock video picks.',
  },
  {
    num: '03',
    ko: '렌더링',
    en: 'Render',
    desc: 'TTS 나레이션·자막·스톡 클립이 씬 타이밍에 맞게 합성되어 MP4가 완성됩니다.',
    descEn: 'TTS narration, subtitles, and stock clips are composited per-scene into an MP4.',
  },
  {
    num: '04',
    ko: '다운로드 & 게시',
    en: 'Download & post',
    desc: '완성 MP4를 즉시 다운로드하거나 이미지 카드뉴스도 함께 받으세요.',
    descEn: 'Download the finished MP4 — or grab the image card news set too.',
  },
]

const INCLUDED = {
  ko: [
    'AI 씬 기획 (훅 → 전개 → CTA)',
    '씬별 스크립트 & 카피 자동 생성',
    '스톡 영상 자동 선택 (Pexels)',
    'TTS 나레이션 (한국어 · 영어)',
    '씬 타이밍 자막 싱크',
    'MP4 내보내기',
    '인스타그램 이미지 카드뉴스 (4:5) 동시 생성',
  ],
  en: [
    'AI scene planning (hook → build → CTA)',
    'Per-scene script & copy generation',
    'Auto stock video selection (Pexels)',
    'TTS narration (Korean & English)',
    'Scene-timed subtitle sync',
    'MP4 export',
    'Instagram image card news (4:5) included',
  ],
}

export default async function VideoCardNewsSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/concept`

  return (
    <main className="bg-white text-[#171714] selection:bg-[#ec6238]/15">
      <MarketingNav authenticated={authenticated} locale={locale} />

      {/* ── Hero — white, editorial, same tone as homepage ── */}
      <section className="relative overflow-hidden bg-white">
        {/* Subtle warm glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[10%] left-[15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.06)_0%,transparent_70%)] blur-3xl" />
          <div className="absolute top-[5%] right-[5%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.04)_0%,transparent_70%)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-[900px] px-5 pb-12 pt-28 text-center md:pt-40">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-1.5 text-xs font-medium text-[#716a60]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
            {isEn ? 'Solution — Video Card News' : '솔루션 — 영상 카드뉴스'}
          </div>

          {/* Headline */}
          <h1 className="mt-8 text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.065em] text-[#171714]">
            {isEn ? (
              <>Video card news,<br /><span className="text-[#ed6238]">in minutes</span></>
            ) : (
              <>영상 카드뉴스,<br /><span className="text-[#ed6238]">몇 분 안에</span></>
            )}
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-[15px] leading-8 text-[#746e63] md:text-base">
            {isEn
              ? 'Enter a topic. AI plans scenes, writes copy, picks stock footage, adds TTS narration and subtitles — and delivers a finished MP4.'
              : '주제를 입력하면 AI가 씬을 기획하고 카피를 쓰고 스톡 영상을 선택하고 TTS 나레이션과 자막을 얹어 완성 MP4를 만듭니다.'}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={accessHref}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#302c26]"
            >
              {authenticated ? (isEn ? 'Go to studio' : '스튜디오로') : (isEn ? 'Try it free' : '무료로 시작하기')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {!authenticated && (
            <p className="mt-3 text-xs text-[#a89e94]">{isEn ? 'No credit card required' : '신용카드 불필요 · 무료 2회 제공'}</p>
          )}
        </div>

        {/* Video in browser-chrome frame */}
        <FadeUp className="relative z-10 mx-auto max-w-5xl px-5 pb-0">
          <div className="overflow-hidden rounded-2xl border border-[#e5e0d8] shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-[#e5e0d8] bg-[#f5f2ee] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="mx-auto text-[11px] text-[#a09890]">Shuffla / 영상 카드뉴스</span>
            </div>
            <video
              src="https://xpsfm8kjiynpuakq.public.blob.vercel-storage.com/solution-video-card-news.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full bg-[#f0ece6]"
              style={{ display: 'block' }}
            />
          </div>
        </FadeUp>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-slate-100 bg-white px-5 py-24 md:py-32">
        <div className="mx-auto max-w-[1300px]">
          <FadeUp className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
              {isEn ? 'How it works' : '작동 방식'}
            </p>
            <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.065em]">
              {isEn ? '4 steps to a finished video' : '4단계, 영상 완성'}
            </h2>
          </FadeUp>

          <div className="mt-20 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ num, ko, en, desc, descEn }) => (
              <FadeUp key={num}>
                <div className="relative border-t-2 border-[#ed6238] pt-6">
                  <span className="text-[3.5rem] font-bold leading-none tracking-tight text-[#f0ece7]">{num}</span>
                  <h3 className="mt-3 text-lg font-bold tracking-[-0.03em]">{isEn ? en : ko}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#756e63]">{isEn ? descEn : desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's included ── */}
      <section className="bg-[#f9f6f2] px-5 py-24 md:py-32">
        <div className="mx-auto max-w-[1300px]">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
                {isEn ? "What's included" : '포함된 내용'}
              </p>
              <h2 className="mt-5 text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn ? 'Everything,\nautomated.' : '전부\n자동입니다.'}
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#756e63]">
                {isEn
                  ? 'From story planning to the final MP4 — every step runs on AI. No video editing skills needed.'
                  : '스토리 기획부터 최종 MP4까지 — 모든 단계가 AI로 작동합니다. 영상 편집 지식 불필요.'}
              </p>
              <Link
                href={accessHref}
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#ed6238] px-7 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db5530]"
              >
                {isEn ? 'Start free' : '무료로 시작하기'} <ArrowRight className="h-4 w-4" />
              </Link>
            </FadeUp>

            <FadeUp>
              <ul className="space-y-4">
                {(isEn ? INCLUDED.en : INCLUDED.ko).map(item => (
                  <li key={item} className="flex items-start gap-3.5 rounded-xl border border-[#e6dfd5] bg-white px-5 py-4">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ed6238]/10">
                      <Check className="h-3 w-3 text-[#ed6238]" />
                    </span>
                    <span className="text-sm font-medium text-[#2d2925]">{item}</span>
                  </li>
                ))}
              </ul>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-white px-5 pb-24 pt-16 md:pb-32 md:pt-24">
        <ScaleIn>
          <div className="mx-auto max-w-[1300px] overflow-hidden rounded-[30px] border border-[#e6dfd5] bg-white px-6 py-16 text-center md:px-10 md:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
              {isEn ? 'Get started' : '지금 시작하기'}
            </p>
            <h2 className="mx-auto mt-6 max-w-2xl text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.065em]">
              {isEn ? 'Your first video\nis free.' : '첫 번째 영상은\n무료입니다.'}
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
              {isEn
                ? 'Sign up with Google and generate your first video card news — no credit card, no setup.'
                : 'Google로 가입하고 첫 영상 카드뉴스를 지금 만들어보세요. 신용카드 불필요.'}
            </p>
            <Link
              href={accessHref}
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db552d]"
            >
              {authenticated ? (isEn ? 'Back to studio' : '스튜디오로') : (isEn ? 'Try it free' : 'Google로 시작하기')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScaleIn>
      </section>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
