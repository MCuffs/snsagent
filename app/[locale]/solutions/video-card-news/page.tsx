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
      ? 'AI Video Card News Generator — Shuffla'
      : 'AI 영상 카드뉴스 자동 제작 — Shuffla | 영상 카드뉴스 생성기',
    description: isEn
      ? 'Generate AI video card news from any topic. Shuffla plans scenes, writes copy, selects stock footage, adds TTS and subtitles — exports a finished MP4 in one click. The fastest AI video card news maker.'
      : 'AI 영상 카드뉴스 자동 제작 솔루션. Shuffla가 주제에서 씬 기획·카피·스톡 영상·TTS·자막까지 MP4를 원클릭으로 완성합니다. 영상 카드뉴스 생성기, 영상 카드뉴스 만들기.',
    keywords: isEn
      ? ['AI video card news', 'video card news generator', 'video card news maker', 'AI video card news maker', 'card news video', 'short form video generator', 'Instagram video card news', 'social video generator']
      : ['AI 영상 카드뉴스', '영상 카드뉴스 만들기', '영상 카드뉴스 자동 제작', '영상 카드뉴스 생성기', 'AI 카드뉴스 영상', '카드뉴스 영상 제작', '인스타그램 영상 카드뉴스', '셔플라 영상 카드뉴스'],
    alternates: {
      canonical: `${base}/${locale}/solutions/video-card-news`,
      languages: {
        ko: `${base}/ko/solutions/video-card-news`,
        en: `${base}/en/solutions/video-card-news`,
        'x-default': `${base}/ko/solutions/video-card-news`,
      },
    },
    openGraph: {
      title: isEn ? 'AI Video Card News Generator — Shuffla' : 'AI 영상 카드뉴스 자동 제작 — Shuffla',
      description: isEn
        ? 'Enter a topic — AI generates a complete video card news: scenes, script, stock footage, TTS, subtitles, MP4.'
        : '주제 입력 → AI가 씬·스크립트·스톡 영상·TTS·자막 MP4 완성. 가장 빠른 AI 영상 카드뉴스 생성기.',
      url: `${base}/${locale}/solutions/video-card-news`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: isEn ? 'Shuffla AI Video Card News Generator' : 'Shuffla AI 영상 카드뉴스 생성기' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: isEn ? 'AI Video Card News Generator — Shuffla' : 'AI 영상 카드뉴스 자동 제작 — Shuffla',
      description: isEn
        ? 'AI plans scenes and produces a finished video card news MP4 from any topic.'
        : 'AI가 씬을 기획하고 어떤 주제에서도 완성 MP4 영상 카드뉴스를 만듭니다.',
      images: [`${base}/og-image.png`],
    },
  }
}

const STEPS = [
  {
    num: '01',
    ko: '주제 입력',
    en: 'Enter a topic',
    desc: 'URL 또는 키워드를 입력합니다. AI가 브랜드·채널 컨텍스트를 분석해 최적 영상 카드뉴스 방향을 설정합니다.',
    descEn: 'Enter a URL or keyword. AI analyzes context to set the optimal video card news direction.',
  },
  {
    num: '02',
    ko: 'AI 씬 기획',
    en: 'AI plans scenes',
    desc: '훅→전개→CTA 구조로 씬별 카피·스톡 영상 후보를 자동 설계합니다.',
    descEn: 'AI auto-designs a hook → build → CTA scene structure with copy and stock footage picks.',
  },
  {
    num: '03',
    ko: '렌더링',
    en: 'Render',
    desc: 'TTS 나레이션·자막·스톡 클립이 씬 타이밍에 맞게 합성되어 MP4 영상 카드뉴스가 완성됩니다.',
    descEn: 'TTS narration, subtitles, and stock clips are composited per-scene into a finished MP4.',
  },
  {
    num: '04',
    ko: '다운로드 & 게시',
    en: 'Download & post',
    desc: '완성 MP4를 즉시 다운로드하거나 이미지 카드뉴스도 함께 받으세요.',
    descEn: 'Download the finished video card news MP4 — or grab the image card news set too.',
  },
]

const INCLUDED = {
  ko: [
    'AI 씬 기획 (훅 → 전개 → CTA)',
    '씬별 스크립트 & 카피 자동 생성',
    '스톡 영상 자동 선택 (Pexels)',
    'TTS 나레이션 (한국어 · 영어)',
    '씬 타이밍 자막 싱크',
    'MP4 내보내기 — 영상 카드뉴스 완성',
    '인스타그램 이미지 카드뉴스 (4:5) 동시 생성',
  ],
  en: [
    'AI scene planning (hook → build → CTA)',
    'Per-scene script & copy generation',
    'Auto stock video selection (Pexels)',
    'TTS narration (Korean & English)',
    'Scene-timed subtitle sync',
    'MP4 export — finished video card news',
    'Instagram image card news (4:5) included',
  ],
}

const FAQ = {
  ko: [
    {
      q: 'AI 영상 카드뉴스란 무엇인가요?',
      a: 'AI 영상 카드뉴스는 주제·브랜드 URL을 입력하면 AI가 씬 기획·스크립트·스톡 영상·TTS 나레이션·자막을 합성해 완성 MP4로 만들어주는 콘텐츠 형식입니다. Shuffla는 이 과정을 원클릭으로 자동화합니다.',
    },
    {
      q: '영상 카드뉴스를 만드는 데 얼마나 걸리나요?',
      a: 'Shuffla의 AI 영상 카드뉴스 제작은 기획·렌더링 포함 평균 3~5분이 소요됩니다. 씬 수에 따라 달라질 수 있습니다.',
    },
    {
      q: '영상 카드뉴스 제작에 영상 편집 기술이 필요한가요?',
      a: '아닙니다. Shuffla는 씬 기획·카피·스톡 영상 선택·TTS·자막·편집을 모두 AI가 처리합니다. 별도의 편집 프로그램이나 기술 없이 완성 MP4를 받을 수 있습니다.',
    },
    {
      q: '어떤 플랫폼에 영상 카드뉴스를 올릴 수 있나요?',
      a: 'Shuffla가 생성하는 MP4는 인스타그램 릴스, 유튜브 쇼츠, 틱톡, 네이버 TV 등 모든 숏폼 플랫폼에 업로드할 수 있습니다.',
    },
    {
      q: '이미지 카드뉴스도 함께 만들어주나요?',
      a: '네. 영상 카드뉴스와 함께 인스타그램 4:5 비율 이미지 카드뉴스도 동시에 생성됩니다.',
    },
    {
      q: '무료로 영상 카드뉴스를 만들 수 있나요?',
      a: 'Google 계정으로 가입하면 영상 카드뉴스를 무료로 생성할 수 있습니다. 신용카드 없이 바로 시작 가능합니다.',
    },
  ],
  en: [
    {
      q: 'What is AI video card news?',
      a: 'AI video card news is a content format where AI plans scenes, writes scripts, selects stock footage, adds TTS narration and subtitles, and delivers a finished MP4 — all from a single topic or URL. Shuffla automates this in one click.',
    },
    {
      q: 'How long does it take to generate a video card news?',
      a: "Shuffla's AI video card news generation takes an average of 3–5 minutes including planning and rendering. Time may vary depending on the number of scenes.",
    },
    {
      q: 'Do I need video editing skills to make video card news?',
      a: 'No. Shuffla handles scene planning, copy, stock video selection, TTS, subtitles, and editing entirely with AI. No editing software or skills needed.',
    },
    {
      q: 'What platforms can I post video card news on?',
      a: 'The MP4 Shuffla generates can be uploaded to Instagram Reels, YouTube Shorts, TikTok, and any other short-form video platform.',
    },
    {
      q: 'Is image card news also included?',
      a: 'Yes. Instagram 4:5 image card news is generated alongside the video card news automatically.',
    },
    {
      q: 'Can I generate video card news for free?',
      a: 'Yes. Sign up with your Google account to generate video card news for free — no credit card required.',
    },
  ],
}

export default async function VideoCardNewsSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/concept`
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  const faqItems = isEn ? FAQ.en : FAQ.ko

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: isEn ? 'Shuffla — AI Video Card News Generator' : 'Shuffla — AI 영상 카드뉴스 생성기',
        applicationCategory: ['VideoEditingApplication', 'DesignApplication', 'BusinessApplication'],
        operatingSystem: 'Web',
        url: `${base}/${locale}/solutions/video-card-news`,
        description: isEn
          ? 'AI video card news generator: enter a topic or URL to generate scene planning, scripts, stock footage, TTS narration, subtitles, and MP4.'
          : 'AI 영상 카드뉴스 생성기: 주제 또는 URL 입력 → 씬 기획·스크립트·스톡 영상·TTS 나레이션·자막·MP4 자동 완성.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'KRW',
          description: isEn ? 'Free plan available — generate video card news at no cost' : '무료 플랜 제공 — 영상 카드뉴스 무료 생성',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Shuffla',
          url: base,
          contactPoint: { '@type': 'ContactPoint', email: 'admin@shuffla.io', contactType: 'customer support' },
        },
        featureList: isEn
          ? ['AI scene planning', 'Script and copy generation', 'Stock video auto-selection', 'TTS narration', 'Subtitle sync', 'MP4 export', 'Instagram image card news 4:5']
          : ['AI 씬 기획', '스크립트·카피 자동 생성', '스톡 영상 자동 선택', 'TTS 나레이션', '자막 싱크', 'MP4 내보내기', '인스타그램 이미지 카드뉴스 4:5'],
        keywords: isEn
          ? 'AI video card news, video card news generator, video card news maker, AI card news video'
          : 'AI 영상 카드뉴스, 영상 카드뉴스 만들기, 영상 카드뉴스 자동 제작, 영상 카드뉴스 생성기',
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
        name: isEn ? 'How to generate AI video card news' : 'AI 영상 카드뉴스 만드는 방법',
        description: isEn
          ? 'Use Shuffla to automatically generate video card news from any topic or URL.'
          : 'Shuffla를 사용해 주제 또는 URL에서 영상 카드뉴스를 자동 생성하는 방법.',
        step: STEPS.map(({ num, ko, en, desc, descEn }) => ({
          '@type': 'HowToStep',
          position: parseInt(num),
          name: isEn ? en : ko,
          text: isEn ? descEn : desc,
        })),
      },
      {
        '@type': 'WebPage',
        '@id': `${base}/${locale}/solutions/video-card-news`,
        url: `${base}/${locale}/solutions/video-card-news`,
        name: isEn ? 'AI Video Card News Generator — Shuffla' : 'AI 영상 카드뉴스 생성기 — Shuffla',
        isPartOf: { '@type': 'WebSite', url: base, name: 'Shuffla' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Shuffla', item: `${base}/${locale}` },
            { '@type': 'ListItem', position: 2, name: isEn ? 'Solutions' : '솔루션', item: `${base}/${locale}` },
            { '@type': 'ListItem', position: 3, name: isEn ? 'Video Card News' : '영상 카드뉴스', item: `${base}/${locale}/solutions/video-card-news` },
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
            <div className="absolute -top-[10%] left-[15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.06)_0%,transparent_70%)] blur-3xl" />
            <div className="absolute top-[5%] right-[5%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.04)_0%,transparent_70%)] blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-[900px] px-5 pb-12 pt-28 text-center md:pt-40">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2d8] bg-white/80 px-4 py-1.5 text-xs font-medium text-[#716a60]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
              {isEn ? 'AI Video Card News Generator' : 'AI 영상 카드뉴스 생성기'}
            </div>

            <h1 className="mt-8 text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.065em] text-[#171714]">
              {isEn ? (
                <>Video card news,<br /><span className="text-[#ed6238]">in minutes</span></>
              ) : (
                <>영상 카드뉴스,<br /><span className="text-[#ed6238]">몇 분 안에</span></>
              )}
            </h1>

            <p className="mx-auto mt-7 max-w-xl text-[15px] leading-8 text-[#746e63] md:text-base">
              {isEn
                ? 'The fastest AI video card news maker. Enter a topic — AI plans scenes, writes copy, picks stock footage, adds TTS narration and subtitles, and delivers a finished MP4.'
                : '가장 빠른 AI 영상 카드뉴스 생성기. 주제를 입력하면 AI가 씬을 기획하고 카피를 쓰고 스톡 영상을 선택하고 TTS 나레이션과 자막을 얹어 완성 MP4를 만듭니다.'}
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={accessHref}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#302c26]"
              >
                {authenticated
                  ? (isEn ? 'Go to studio' : '스튜디오로')
                  : (isEn ? 'Try video card news free' : '영상 카드뉴스 무료 생성')}
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
              <div className="flex items-center gap-1.5 border-b border-[#e5e0d8] bg-[#f5f2ee] px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
                <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
                <span className="h-3 w-3 rounded-full bg-[#e0d8ce]" />
                <span className="mx-auto text-[11px] text-[#a09890]">Shuffla / {isEn ? 'Video Card News' : '영상 카드뉴스'}</span>
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

        {/* ── Why AI video card news — GEO 친화적 섹션 ── */}
        <section className="border-t border-slate-100 bg-white px-5 py-20 md:py-28">
          <div className="mx-auto max-w-[900px] text-center">
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
                {isEn ? 'Why AI video card news?' : 'AI 영상 카드뉴스가 필요한 이유'}
              </p>
              <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn
                  ? 'Video content drives 3× more engagement'
                  : '영상 콘텐츠는 이미지보다 3배 더 많은 반응을 만듭니다'}
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-8 text-[#756e63]">
                {isEn
                  ? 'Video card news combines the readability of card news with the engagement power of video. But producing video content takes hours. Shuffla\'s AI video card news generator compresses the entire workflow — planning, scripting, editing, captioning — into a single click.'
                  : '영상 카드뉴스는 카드뉴스의 가독성과 영상의 참여율을 결합합니다. 하지만 영상 콘텐츠 제작에는 수 시간이 소요됩니다. Shuffla AI 영상 카드뉴스 생성기는 기획·스크립트·편집·자막 전체 워크플로우를 클릭 한 번으로 압축합니다.'}
              </p>
            </FadeUp>

            <FadeUp className="mt-12 grid gap-6 sm:grid-cols-3">
              {(isEn ? [
                { stat: '3–5 min', label: 'Average time to finished video card news MP4' },
                { stat: '1-click', label: 'Full pipeline — plan, script, video, TTS, subtitles' },
                { stat: '4:5 + 9:16', label: 'Instagram & Shorts formats included' },
              ] : [
                { stat: '3~5분', label: '완성 영상 카드뉴스 MP4까지 평균 소요 시간' },
                { stat: '원클릭', label: '기획·스크립트·영상·TTS·자막 전체 파이프라인' },
                { stat: '4:5 + 9:16', label: '인스타그램 & 쇼츠 포맷 동시 지원' },
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
                {isEn ? 'How AI video card news works' : 'AI 영상 카드뉴스 작동 방식'}
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
                    ? 'From story planning to the final MP4 — every step of video card news production runs on AI. No cameras, no editors, no designers.'
                    : '스토리 기획부터 최종 MP4까지 — 영상 카드뉴스 제작의 모든 단계가 AI로 자동화됩니다. 카메라·편집자·디자이너 불필요.'}
                </p>
                <Link
                  href={accessHref}
                  className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#ed6238] px-7 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db5530]"
                >
                  {isEn ? 'Generate video card news free' : '영상 카드뉴스 무료 생성'} <ArrowRight className="h-4 w-4" />
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

        {/* ── FAQ — GEO 최적화 ── */}
        <section className="border-t border-slate-100 bg-white px-5 py-24 md:py-32">
          <div className="mx-auto max-w-[860px]">
            <FadeUp className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">FAQ</p>
              <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.2rem)] font-bold leading-[1.05] tracking-[-0.065em]">
                {isEn ? 'AI video card news — FAQ' : 'AI 영상 카드뉴스 자주 묻는 질문'}
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
                {isEn ? 'Your first video card news\nis free.' : '첫 번째 영상 카드뉴스는\n무료입니다.'}
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-[#756e63]">
                {isEn
                  ? "Sign up with Google and generate your first AI video card news — no credit card, no setup needed."
                  : 'Google로 가입하고 첫 AI 영상 카드뉴스를 지금 만들어보세요. 신용카드 불필요.'}
              </p>
              <Link
                href={accessHref}
                className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db552d]"
              >
                {authenticated
                  ? (isEn ? 'Back to studio' : '스튜디오로')
                  : (isEn ? 'Generate video card news free' : 'Google로 시작하기')}
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
