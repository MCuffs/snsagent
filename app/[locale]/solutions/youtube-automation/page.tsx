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
    title: isEn
      ? 'YouTube Shorts AI Automation — Shuffla'
      : '유튜브 쇼츠 AI 자동화 — Shuffla | 유튜브 자동화 솔루션',
    description: isEn
      ? 'Automate your YouTube Shorts with AI. Shuffla plans 30 topics, writes scripts, selects stock footage, adds TTS narration and subtitles — and exports MP4 in one click. The easiest YouTube Shorts automation tool.'
      : 'AI 유튜브 쇼츠 자동화 솔루션. Shuffla가 30일 콘텐츠를 기획하고 스크립트·스톡 영상·TTS·자막까지 MP4를 원클릭으로 완성합니다. 유튜브 자동화, 유튜브 쇼츠 자동화, 쇼츠 AI 제작 도구.',
    keywords: isEn
      ? ['YouTube Shorts AI', 'YouTube automation', 'YouTube Shorts automation', 'AI YouTube video maker', 'auto YouTube Shorts', 'YouTube content automation', 'AI Shorts generator', 'YouTube Shorts creator tool']
      : ['유튜브 쇼츠 AI', '유튜브 자동화', '유튜브 쇼츠 자동화', 'AI 유튜브 영상 만들기', '쇼츠 자동 제작', '유튜브 콘텐츠 자동화', 'AI 쇼츠 생성기', '유튜브 쇼츠 만들기', '쇼츠 제작 도구', '셔플라 유튜브'],
    alternates: {
      canonical: `${base}/${locale}/solutions/youtube-automation`,
      languages: {
        ko: `${base}/ko/solutions/youtube-automation`,
        en: `${base}/en/solutions/youtube-automation`,
        'x-default': `${base}/ko/solutions/youtube-automation`,
      },
    },
    openGraph: {
      title: isEn ? 'YouTube Shorts AI Automation — Shuffla' : '유튜브 쇼츠 AI 자동화 — Shuffla',
      description: isEn
        ? 'Plan 30 days of YouTube Shorts content and produce each video in one click — AI script, stock footage, TTS, subtitles, MP4.'
        : '30일 유튜브 쇼츠 콘텐츠를 기획하고 클릭 한 번에 스크립트·영상·TTS·자막 MP4를 완성하는 AI 유튜브 자동화 도구.',
      url: `${base}/${locale}/solutions/youtube-automation`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: isEn ? 'Shuffla YouTube Shorts AI Automation' : 'Shuffla 유튜브 쇼츠 AI 자동화' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'YouTube Shorts AI Automation — Shuffla' : '유튜브 쇼츠 AI 자동화 — Shuffla',
      description: isEn
        ? 'AI plans 30 Shorts topics and produces each video in one click.'
        : 'AI가 30개 쇼츠 주제를 기획하고 클릭 한 번에 영상을 완성합니다.',
      images: [`${base}/og-image.png`],
    },
  }
}

const STEPS = [
  {
    num: '01',
    ko: '채널 주제 입력',
    en: 'Enter channel topic',
    desc: '채널 카테고리와 타겟 키워드를 입력합니다. AI가 채널 컨텍스트를 파악해 최적 콘텐츠 방향을 설정합니다.',
    descEn: 'Enter your channel category and target keywords. AI reads context to set the optimal content direction.',
  },
  {
    num: '02',
    ko: 'AI가 30일 기획',
    en: 'AI plans 30 days',
    desc: 'AI가 30개의 유튜브 쇼츠 제목과 키워드를 즉시 생성합니다. 알고리즘 친화적인 주제로 구성됩니다.',
    descEn: 'AI instantly generates 30 YouTube Shorts titles and keywords — structured for algorithm-friendly reach.',
  },
  {
    num: '03',
    ko: '클릭 한 번 → 영상 완성',
    en: 'One click → video done',
    desc: '제목을 클릭하면 스크립트·스톡 영상 선택·TTS 나레이션·자막이 자동 합성되어 MP4가 완성됩니다.',
    descEn: 'Click a title — script, stock footage, TTS narration, and subtitles are auto-composited into MP4.',
  },
  {
    num: '04',
    ko: '다운로드 후 업로드',
    en: 'Download & upload',
    desc: '완성된 MP4를 다운로드해 채널에 올리기만 하면 됩니다. 12시간 간격으로 다음 영상이 열려 꾸준한 업로드 루틴을 만들 수 있습니다.',
    descEn: 'Download the finished MP4 and post it to your channel. The next video unlocks every 12 hours to keep a consistent upload routine.',
  },
]

const INCLUDED = {
  ko: [
    '30일 콘텐츠 기획 — AI 유튜브 쇼츠 주제 자동 생성',
    '클릭 한 번으로 영상 제작 (유튜브 쇼츠 자동화)',
    '스톡 영상 자동 선택 (Pexels)',
    'TTS 나레이션 & 씬별 자막 싱크',
    'MP4 내보내기 (9:16 쇼츠 최적화)',
    '12시간 간격의 빠른 제작 리듬',
    '작업 히스토리 & 진행 상황 관리',
  ],
  en: [
    '30-day content plan — AI YouTube Shorts topic generation',
    'One-click video production (YouTube Shorts automation)',
    'Auto stock video selection (Pexels)',
    'TTS narration & per-scene subtitle sync',
    'MP4 export (9:16 Shorts-optimized)',
    'Fast 12-hour production cadence',
    'Work history & progress tracking',
  ],
}

const FAQ = {
  ko: [
    {
      q: '유튜브 쇼츠 AI 자동화가 무엇인가요?',
      a: 'Shuffla의 유튜브 쇼츠 AI 자동화는 채널 주제를 입력하면 AI가 30일치 콘텐츠를 기획하고, 클릭 한 번에 스크립트·스톡 영상·TTS·자막을 합성해 MP4를 완성하는 서비스입니다.',
    },
    {
      q: '유튜브 자동화로 어떤 형식의 영상을 만들 수 있나요?',
      a: '9:16 세로형 유튜브 쇼츠에 최적화된 MP4를 제작합니다. TTS 나레이션, 씬별 자막, 스톡 영상 클립이 포함됩니다.',
    },
    {
      q: '유튜브 쇼츠 자동화에 영상 편집 기술이 필요한가요?',
      a: '아닙니다. Shuffla는 기획·카피·영상 선택·나레이션·자막·편집을 모두 AI가 처리합니다. 영상 편집 경험이 전혀 없어도 완성 MP4를 받을 수 있습니다.',
    },
    {
      q: '하루에 몇 개의 유튜브 쇼츠를 만들 수 있나요?',
      a: 'Shuffla는 12시간 간격으로 다음 영상을 제작할 수 있도록 설계되어 하루 최대 2편의 쇼츠 제작 흐름을 지원합니다.',
    },
    {
      q: '무료로 유튜브 자동화를 사용할 수 있나요?',
      a: 'Google 계정으로 가입하면 유튜브 자동화를 무료로 체험할 수 있습니다. 신용카드 없이 시작 가능합니다.',
    },
    {
      q: 'Shuffla 유튜브 자동화와 다른 AI 영상 도구의 차이는?',
      a: 'Shuffla는 단순 영상 생성이 아닌 30일 콘텐츠 기획→스크립트→스톡 영상 선택→TTS→자막까지 전체 제작 파이프라인을 원클릭으로 제공합니다. 완성된 MP4를 다운로드해 채널에 업로드하기만 하면 됩니다.',
    },
  ],
  en: [
    {
      q: 'What is YouTube Shorts AI automation?',
      a: "Shuffla's YouTube Shorts AI automation lets you enter a channel topic, then AI plans 30 days of content and produces each video — script, stock footage, TTS, and subtitles — in one click as a finished MP4.",
    },
    {
      q: 'What video format does the YouTube automation produce?',
      a: 'Shuffla produces 9:16 vertical MP4 optimized for YouTube Shorts, including TTS narration, per-scene subtitles, and stock video clips.',
    },
    {
      q: 'Do I need video editing skills for YouTube Shorts automation?',
      a: 'No. Shuffla handles planning, copy, stock video selection, narration, subtitles, and editing entirely with AI. No editing experience needed.',
    },
    {
      q: 'How many YouTube Shorts can I produce per day?',
      a: 'Shuffla opens the next video every 12 hours, supporting a production rhythm of up to two Shorts per day.',
    },
    {
      q: 'Can I use YouTube automation for free?',
      a: 'Yes. Sign up with your Google account to try Shuffla YouTube automation for free — no credit card required.',
    },
    {
      q: 'How is Shuffla different from other AI video tools?',
      a: 'Shuffla offers an end-to-end production pipeline — 30-day content planning → script → stock video selection → TTS → subtitles — all in one click. You simply download the finished MP4 and upload it to your channel.',
    },
  ],
}

export default async function YouTubeAutomationSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/youtube-automation`
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  const faqItems = isEn ? FAQ.en : FAQ.ko

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: isEn ? 'Shuffla — YouTube Shorts AI Automation' : 'Shuffla — 유튜브 쇼츠 AI 자동화',
        applicationCategory: ['VideoEditingApplication', 'BusinessApplication', 'UtilitiesApplication'],
        operatingSystem: 'Web',
        url: `${base}/${locale}/solutions/youtube-automation`,
        description: isEn
          ? 'AI-powered YouTube Shorts automation: enter a channel topic, get 30-day content plan, produce each Short with one click — script, stock footage, TTS, subtitles, MP4.'
          : 'AI 유튜브 쇼츠 자동화: 채널 주제 입력 → 30일 기획 → 클릭 한 번으로 스크립트·스톡 영상·TTS·자막·MP4 완성.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
          description: isEn ? 'Free plan available — try YouTube automation at no cost' : '무료 플랜 제공 — 유튜브 자동화 무료 체험',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Shuffla',
          url: base,
          contactPoint: { '@type': 'ContactPoint', email: 'admin@shuffla.io', contactType: 'customer support' },
        },
        featureList: isEn
          ? ['30-day YouTube Shorts content planning', 'AI script writing', 'Stock video auto-selection', 'TTS narration', 'Subtitle sync', 'MP4 export 9:16', 'Fast 12-hour production cadence']
          : ['30일 유튜브 쇼츠 콘텐츠 기획', 'AI 스크립트 자동 작성', '스톡 영상 자동 선택', 'TTS 나레이션', '자막 싱크', 'MP4 9:16 내보내기', '12시간 간격의 빠른 제작 리듬'],
        keywords: isEn
          ? 'YouTube Shorts AI, YouTube automation, YouTube Shorts automation, AI Shorts generator'
          : '유튜브 쇼츠 AI, 유튜브 자동화, 유튜브 쇼츠 자동화, AI 쇼츠 생성기, 쇼츠 자동 제작',
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
      {
        '@type': 'HowTo',
        name: isEn ? 'How to automate YouTube Shorts with AI' : 'AI로 유튜브 쇼츠 자동화하는 방법',
        description: isEn
          ? 'Use Shuffla to plan and produce YouTube Shorts automatically with AI, then download upload-ready MP4s.'
          : 'Shuffla를 사용해 유튜브 쇼츠를 AI로 자동 기획·제작하고 업로드 준비된 MP4를 받는 방법.',
        step: STEPS.map(({ num, ko, en, desc, descEn }) => ({
          '@type': 'HowToStep',
          position: parseInt(num),
          name: isEn ? en : ko,
          text: isEn ? descEn : desc,
        })),
      },
      {
        '@type': 'WebPage',
        '@id': `${base}/${locale}/solutions/youtube-automation`,
        url: `${base}/${locale}/solutions/youtube-automation`,
        name: isEn ? 'YouTube Shorts AI Automation — Shuffla' : '유튜브 쇼츠 AI 자동화 — Shuffla',
        isPartOf: { '@type': 'WebSite', url: base, name: 'Shuffla' },
        about: {
          '@type': 'Thing',
          name: isEn ? 'YouTube Shorts Automation' : '유튜브 쇼츠 자동화',
          description: isEn
            ? 'AI-powered automation for YouTube Shorts content planning and video production'
            : 'AI 기반 유튜브 쇼츠 콘텐츠 기획 및 영상 제작 자동화',
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Shuffla', item: `${base}/${locale}` },
            { '@type': 'ListItem', position: 2, name: isEn ? 'Solutions' : '솔루션', item: `${base}/${locale}` },
            { '@type': 'ListItem', position: 3, name: isEn ? 'YouTube Automation' : '유튜브 자동화', item: `${base}/${locale}/solutions/youtube-automation` },
          ],
        },
        inLanguage: isEn ? 'en' : 'ko',
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
              {isEn ? 'YouTube Shorts AI Automation' : '유튜브 쇼츠 AI 자동화'}
            </div>

            {/* H1 — keyword-rich */}
            <h1 className="mt-8 text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.065em] text-[#171714]">
              {isEn ? (
                <>YouTube Shorts,<br /><span className="text-[#ed6238]">on autopilot</span></>
              ) : (
                <>유튜브 쇼츠<br /><span className="text-[#ed6238]">자동화</span></>
              )}
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-[15px] leading-8 text-[#746e63] md:text-base">
              {isEn
                ? 'The simplest YouTube Shorts AI tool. Enter a channel topic — AI plans 30 days of content and produces each Short with one click: script, stock footage, TTS narration, subtitles, all in MP4.'
                : '가장 쉬운 유튜브 쇼츠 자동화 도구. 채널 주제를 입력하면 AI가 30일 콘텐츠를 기획하고 클릭 한 번에 스크립트·스톡 영상·TTS 나레이션·자막을 MP4로 완성합니다.'}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={accessHref}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#302c26]"
              >
                {authenticated
                  ? (isEn ? 'Go to YouTube automation' : '유튜브 자동화로')
                  : (isEn ? 'Try YouTube automation free' : '유튜브 자동화 무료 체험')}
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
                <span className="mx-auto text-[11px] text-[#a09890]">Shuffla / {isEn ? 'YouTube Shorts Automation' : '유튜브 쇼츠 자동화'}</span>
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

        {/* ── Why YouTube Shorts automation — GEO 친화적 설명 섹션 ── */}
        <section className="border-t border-slate-100 bg-white px-5 py-20 md:py-28">
          <div className="mx-auto max-w-[900px] text-center">
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
                {isEn ? 'Why automate YouTube Shorts?' : '유튜브 쇼츠 자동화가 필요한 이유'}
              </p>
              <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn
                  ? 'YouTube Shorts algorithm rewards consistency'
                  : '유튜브 쇼츠 알고리즘은 꾸준함에 반응합니다'}
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-8 text-[#756e63]">
                {isEn
                  ? 'YouTube\'s algorithm favors channels that upload regularly. Producing a Short every day takes hours of planning, scripting, filming, editing, and captioning. Shuffla\'s YouTube Shorts AI cuts that to minutes — so you can focus on growing your channel, not on production.'
                  : '유튜브 알고리즘은 규칙적으로 업로드하는 채널을 선호합니다. 매일 쇼츠 한 편을 만들려면 기획·스크립트·촬영·편집·자막 작업에 수 시간이 필요합니다. Shuffla의 유튜브 쇼츠 AI는 이 과정을 몇 분으로 단축합니다. 제작에 쓸 시간을 채널 성장에 투자하세요.'}
              </p>
            </FadeUp>

            <FadeUp className="mt-12 grid gap-6 sm:grid-cols-3">
              {(isEn ? [
                { stat: '30', label: 'Days of content planned in seconds' },
                { stat: '1-click', label: 'Per-video production — no editing' },
                { stat: '12h', label: 'Next Short unlock cycle' },
              ] : [
                { stat: '30일', label: '몇 초 만에 콘텐츠 기획 완성' },
                { stat: '원클릭', label: '영상 제작 — 편집 불필요' },
                { stat: '12시간', label: '다음 쇼츠 오픈 주기' },
              ]).map(({ stat, label }) => (
                <div key={stat} className="rounded-2xl border border-[#e6dfd5] bg-[#faf8f5] px-6 py-8">
                  <p className="text-[2.5rem] font-bold tracking-[-0.04em] text-[#171714]">{stat}</p>
                  <p className="mt-2 text-sm leading-6 text-[#756e63]">{label}</p>
                </div>
              ))}
            </FadeUp>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-t border-slate-100 bg-white px-5 py-24 md:py-32">
          <div className="mx-auto max-w-[1300px]">
            <FadeUp className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
                {isEn ? 'How YouTube Shorts automation works' : '유튜브 쇼츠 자동화 작동 방식'}
              </p>
              <h2 className="mt-5 text-[clamp(2rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn ? '4 steps to a daily video' : '4단계, 매일 새 영상'}
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
                  {isEn ? '30 Shorts.\nZero production team.' : '쇼츠 30편.\n팀원 0명.'}
                </h2>
                <p className="mt-6 max-w-sm text-sm leading-7 text-[#756e63]">
                  {isEn
                    ? 'Shuffla\'s YouTube Shorts automation handles every step — from content strategy to upload-ready MP4. No cameras, no editors, no designers needed.'
                    : 'Shuffla 유튜브 쇼츠 자동화는 콘텐츠 전략부터 업로드 준비 MP4까지 모든 단계를 처리합니다. 카메라·편집자·디자이너 불필요.'}
                </p>
                <Link
                  href={accessHref}
                  className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#ed6238] px-7 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db5530]"
                >
                  {isEn ? 'Start YouTube automation free' : '유튜브 자동화 무료 시작'} <ArrowRight className="h-4 w-4" />
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

        {/* ── FAQ — GEO: AI 검색엔진 인용 최적화 ── */}
        <section className="border-t border-slate-100 bg-white px-5 py-24 md:py-32">
          <div className="mx-auto max-w-[860px]">
            <FadeUp className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">FAQ</p>
              <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.2rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn ? 'YouTube Shorts automation — FAQ' : '유튜브 쇼츠 자동화 자주 묻는 질문'}
              </h2>
            </FadeUp>

            <div className="mt-14 space-y-5">
              {faqItems.map(({ q, a }) => (
                <FadeUp key={q}>
                  <div className="rounded-2xl border border-[#e6dfd5] bg-[#faf8f5] px-7 py-6">
                    <h3 className="text-base font-bold tracking-[-0.02em] text-[#171714]">{q}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#756e63]">{a}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-white px-5 pb-24 pt-8 md:pb-32 md:pt-12">
          <ScaleIn>
            <div className="mx-auto max-w-[1300px] overflow-hidden rounded-[30px] border border-[#e6dfd5] bg-white px-6 py-16 text-center md:px-10 md:py-24">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
                {isEn ? 'Get started free' : '무료로 시작하기'}
              </p>
              <h2 className="mx-auto mt-6 max-w-2xl text-[clamp(2.2rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn ? 'Automate your\nYouTube channel today.' : '오늘부터 유튜브\n채널을 자동화하세요.'}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
                {isEn
                  ? 'Sign up with Google and let Shuffla\'s YouTube Shorts AI plan and produce your first 30 videos — free to try, no credit card.'
                  : 'Google로 가입하고 Shuffla 유튜브 쇼츠 AI가 첫 30개 영상을 기획·제작합니다. 무료 체험, 신용카드 불필요.'}
              </p>
              <Link
                href={accessHref}
                className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db552d]"
              >
                {authenticated
                  ? (isEn ? 'Go to YouTube automation' : '유튜브 자동화로')
                  : (isEn ? 'Try free — no signup required' : 'Google로 시작하기')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </ScaleIn>
        </section>

        <MarketingFooter authenticated={authenticated} locale={locale} />
      </main>
    </>
  )
}
