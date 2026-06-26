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
    title: isEn ? 'YouTube Automation — Shuffla' : '유튜브 자동화 솔루션 — Shuffla',
    description: isEn
      ? 'Automated daily YouTube Shorts. AI plans 30 topics, scripts each video, produces MP4 — ready to upload.'
      : 'AI가 30일 콘텐츠를 기획하고 매일 유튜브 쇼츠를 자동 제작합니다.',
    alternates: { canonical: `${base}/${locale}/solutions/youtube-automation` },
    openGraph: {
      title: isEn ? 'YouTube Automation — Shuffla' : '유튜브 자동화 솔루션 — Shuffla',
      url: `${base}/${locale}/solutions/youtube-automation`,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  }
}

const STEPS = [
  {
    num: '01',
    ko: '채널 주제 입력',
    en: 'Enter channel topic',
    desc: '채널 카테고리와 타겟 키워드를 입력합니다.',
    descEn: 'Enter your channel category and target keywords.',
  },
  {
    num: '02',
    ko: 'AI가 30일 기획',
    en: 'AI plans 30 days',
    desc: 'AI가 30개의 쇼츠 제목과 키워드를 즉시 생성합니다.',
    descEn: 'AI instantly generates 30 Shorts titles and keywords.',
  },
  {
    num: '03',
    ko: '제목 클릭 → 제작',
    en: 'Click → produce',
    desc: '원하는 제목을 클릭하면 스크립트·영상·TTS·자막이 자동 합성됩니다.',
    descEn: 'Click any title — script, video, TTS, and subtitles are auto-composited.',
  },
  {
    num: '04',
    ko: '매일 업로드',
    en: 'Upload daily',
    desc: '24시간마다 다음 영상을 제작해 채널을 성장시킵니다.',
    descEn: 'Produce the next video every 24 hours to grow your channel.',
  },
]

const INCLUDED = {
  ko: [
    '30일 콘텐츠 기획 (AI 주제 생성)',
    '클릭 한 번으로 영상 제작',
    '스톡 영상 자동 선택 (Pexels)',
    'TTS 나레이션 & 씬별 자막 싱크',
    'MP4 내보내기 (9:16 쇼츠 최적화)',
    '유튜브 알고리즘 친화적 24시간 리듬',
    '작업 히스토리 & 진행 상황 관리',
  ],
  en: [
    '30-day content plan (AI-generated topics)',
    'One-click per-video production',
    'Auto stock video selection (Pexels)',
    'TTS narration & per-scene subtitle sync',
    'MP4 export (9:16 Shorts-optimized)',
    'Algorithm-friendly 24-hour upload cadence',
    'Work history & progress tracking',
  ],
}

export default async function YouTubeAutomationSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/youtube-automation`

  return (
    <main className="bg-white text-[#171714] selection:bg-[#ec6238]/15">
      <MarketingNav authenticated={authenticated} locale={locale} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-[10%] right-[10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.05)_0%,transparent_70%)] blur-3xl" />
          <div className="absolute top-[20%] left-[0%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.04)_0%,transparent_70%)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-[900px] px-5 pb-12 pt-28 text-center md:pt-40">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-1.5 text-xs font-medium text-[#716a60]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
            {isEn ? 'Solution — YouTube Automation' : '솔루션 — 유튜브 자동화'}
          </div>

          <h1 className="mt-8 text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.065em] text-[#171714]">
            {isEn ? (
              <>YouTube Shorts,<br /><span className="text-[#ed6238]">on autopilot</span></>
            ) : (
              <>유튜브 쇼츠,<br /><span className="text-[#ed6238]">자동화</span></>
            )}
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-[15px] leading-8 text-[#746e63] md:text-base">
            {isEn
              ? 'AI plans 30 days of Shorts content, then produces each video with a single click — script, stock footage, TTS, subtitles, all in MP4.'
              : 'AI가 30일치 쇼츠 콘텐츠를 기획하고 클릭 한 번에 스크립트·스톡 영상·TTS·자막을 MP4로 완성합니다.'}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={accessHref}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#302c26]"
            >
              {authenticated ? (isEn ? 'Go to YouTube' : '유튜브 자동화로') : (isEn ? 'Try it free' : '무료로 시작하기')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {!authenticated && (
            <p className="mt-3 text-xs text-[#a89e94]">{isEn ? 'No credit card required' : '신용카드 불필요'}</p>
          )}
        </div>

        {/* Video in browser-chrome frame */}
        <FadeUp className="relative z-10 mx-auto max-w-5xl px-5 pb-0">
          <div className="overflow-hidden rounded-2xl border border-[#e5e0d8] shadow-[0_20px_60px_rgba(0,0,0,0.10)]">
            <div className="flex items-center gap-1.5 border-b border-[#e5e0d8] bg-[#f5f2ee] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
              <span className="mx-auto text-[11px] text-[#a09890]">Shuffla / 유튜브 자동화</span>
            </div>
            <video
              src="https://xpsfm8kjiynpuakq.public.blob.vercel-storage.com/solution-youtube-automation.mp4"
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
              {isEn ? '4 steps to daily uploads' : '4단계, 매일 업로드'}
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
                {isEn ? '30 videos.\nZero production team.' : '30개 영상.\n팀원 0명.'}
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#756e63]">
                {isEn
                  ? 'From content planning to upload-ready MP4s — run your YouTube channel without a production team.'
                  : '콘텐츠 기획부터 업로드 준비 MP4까지 — 제작팀 없이 유튜브 채널을 운영하세요.'}
              </p>
              <Link
                href={accessHref}
                className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#ed6238] px-7 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db5530]"
              >
                {isEn ? 'Start free' : '자동화 시작하기'} <ArrowRight className="h-4 w-4" />
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
              {isEn ? 'Your channel,\nautomated.' : '채널 운영,\n이제 자동으로.'}
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
              {isEn
                ? 'Sign up with Google and let AI plan and produce your first 30 Shorts — free to try.'
                : 'Google로 가입하고 AI가 기획한 30개 쇼츠를 지금 바로 제작해보세요.'}
            </p>
            <Link
              href={accessHref}
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db552d]"
            >
              {authenticated ? (isEn ? 'Go to YouTube' : '유튜브 자동화로') : (isEn ? 'Try it free' : 'Google로 시작하기')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScaleIn>
      </section>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
