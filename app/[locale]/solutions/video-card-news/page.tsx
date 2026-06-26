import Link from 'next/link'
import { ArrowRight, Check, Zap, Layers, Download, Brain, Film, Palette } from 'lucide-react'
import { MarketingNav } from '../../../components/MarketingNav'
import { MarketingFooter } from '../../../components/MarketingFooter'
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
    alternates: {
      canonical: `${base}/${locale}/solutions/video-card-news`,
    },
    openGraph: {
      title: isEn ? 'Video Card News — Shuffla' : '영상 카드뉴스 솔루션 — Shuffla',
      url: `${base}/${locale}/solutions/video-card-news`,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  }
}

const FEATURES = [
  { icon: Brain, title: '스토리 기획 자동화', titleEn: 'AI Story Planning', desc: 'AI가 주제를 분석하고 훅→전개→CTA로 이어지는 씬 플랜을 설계합니다.', descEn: 'AI designs a hook → build → CTA scene plan from your topic.' },
  { icon: Film, title: '스톡 영상 자동 매칭', titleEn: 'Stock Video Matching', desc: '씬별 키워드로 Pexels에서 최적 클립을 선택하고 타이밍에 맞게 배치합니다.', descEn: 'Auto-selects Pexels clips per scene and cuts them to the script timing.' },
  { icon: Layers, title: '자막 싱크 렌더링', titleEn: 'Subtitle Sync Rendering', desc: 'TTS 오디오 타이밍에 맞춰 자막이 씬마다 정확하게 표시됩니다.', descEn: 'Subtitles appear in sync with TTS audio timing, per scene.' },
  { icon: Palette, title: '이미지 카드뉴스 동시 생성', titleEn: 'Image Card News', desc: '영상과 함께 인스타그램 4:5 이미지 카드뉴스도 같이 만들어집니다.', descEn: 'Instagram 4:5 image card news is generated alongside the video.' },
  { icon: Zap, title: '원클릭 전체 파이프라인', titleEn: 'One-click Pipeline', desc: '기획·카피·영상·TTS·자막·편집까지 클릭 한 번에 완성됩니다.', descEn: 'Script, copy, video, TTS, subtitles, editing — all in one click.' },
  { icon: Download, title: 'MP4 즉시 다운로드', titleEn: 'Instant MP4 Export', desc: '완성된 영상을 바로 다운로드해 SNS에 업로드하세요.', descEn: 'Download the finished MP4 and upload directly to social media.' },
]

const STEPS = [
  { num: '01', ko: '주제 입력', en: 'Enter Topic', desc: '브랜드 URL 또는 주제 키워드를 입력합니다.', descEn: 'Enter a brand URL or topic keyword.' },
  { num: '02', ko: 'AI 기획', en: 'AI Plans', desc: 'AI가 씬 구성·카피·스톡 영상 후보를 자동으로 준비합니다.', descEn: 'AI prepares scene structure, copy, and stock video candidates.' },
  { num: '03', ko: '영상 렌더링', en: 'Render', desc: 'TTS·자막·영상이 합성되어 MP4 파일이 생성됩니다.', descEn: 'TTS, subtitles, and video are composited into an MP4.' },
  { num: '04', ko: '다운로드', en: 'Download', desc: '완성 영상을 다운로드하거나 편집하세요.', descEn: 'Download or further edit the finished video.' },
]

export default async function VideoCardNewsSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/concept`

  return (
    <main className="text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0d0d0b]">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(237,98,56,0.18)_0%,transparent_65%)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-28 text-center md:pt-36">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-[#c9bcb0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ed6238]" />
            {isEn ? 'Solution' : '솔루션'}
          </div>

          <h1 className="mt-7 text-[clamp(2.6rem,7vw,6rem)] font-bold leading-[0.9] tracking-[-0.055em] text-white">
            {isEn ? (
              <>Video Card News<br /><span className="text-[#ed6238]">Automated</span></>
            ) : (
              <>영상 카드뉴스<br /><span className="text-[#ed6238]">자동 제작</span></>
            )}
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-8 text-[#9a9080]">
            {isEn
              ? 'Enter a topic and AI generates a complete short-form video card news — scenes, scripts, stock video, TTS, and subtitles.'
              : '주제를 입력하면 AI가 씬 기획·스크립트·스톡 영상·TTS·자막까지 영상 카드뉴스를 완성합니다.'}
          </p>

          <Link
            href={accessHref}
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ed6238] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#db5530]"
          >
            {isEn ? 'Try it free' : '무료로 시작하기'} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-[#6b6258]">{isEn ? 'No credit card required' : '신용카드 불필요'}</p>
        </div>

        {/* Video showcase */}
        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-0">
          {/* Top fade */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-[#0d0d0b] to-transparent" />
          {/* Bottom fade into white */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-white to-transparent" />

          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
            <video
              src="https://xpsfm8kjiynpuakq.public.blob.vercel-storage.com/solution-video-card-news.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="w-full"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white px-5 py-24 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
              {isEn ? 'Features' : '기능'}
            </p>
            <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.055em]">
              {isEn ? 'Everything automated' : '전부 자동입니다'}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#756e63]">
              {isEn
                ? 'From story planning to final MP4 — every step runs on AI with zero manual editing required.'
                : '스토리 기획부터 최종 MP4까지 — 모든 단계가 AI로 자동화됩니다.'}
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, titleEn, desc, descEn }) => (
              <div key={title} className="rounded-2xl border border-[#eee8e0] bg-[#faf8f5] p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ed6238]/10">
                  <Icon className="h-5 w-5 text-[#ed6238]" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{isEn ? titleEn : title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#756e63]">{isEn ? descEn : desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#f9f6f2] px-5 py-24 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
              {isEn ? 'How it works' : '작동 방식'}
            </p>
            <h2 className="mt-5 text-[clamp(1.9rem,4.5vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.055em]">
              {isEn ? '4 steps to a finished video' : '4단계로 영상 완성'}
            </h2>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ num, ko, en, desc, descEn }) => (
              <div key={num} className="relative">
                <span className="text-5xl font-bold tracking-tight text-[#ede8e0]">{num}</span>
                <h3 className="mt-3 text-base font-semibold">{isEn ? en : ko}</h3>
                <p className="mt-2 text-sm leading-6 text-[#756e63]">{isEn ? descEn : desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Included ── */}
      <section className="bg-white px-5 py-24 md:py-28">
        <div className="mx-auto max-w-[900px]">
          <div className="overflow-hidden rounded-[28px] border border-[#e6dfd5] bg-[#faf8f5] px-8 py-14 text-center md:px-14 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#847d73]">
              {isEn ? "What you get" : "포함된 내용"}
            </p>
            <h2 className="mx-auto mt-6 max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.055em]">
              {isEn ? 'Complete video card news in minutes' : '몇 분 안에 완성된 영상 카드뉴스'}
            </h2>

            <ul className="mx-auto mt-10 inline-flex flex-col items-start gap-3 text-sm text-[#504a43]">
              {(isEn ? [
                'AI scene planning & script',
                'Auto stock video selection (Pexels)',
                'TTS narration (Korean & English)',
                'Subtitle sync per scene',
                'MP4 export',
                'Instagram image card news (4:5)',
              ] : [
                'AI 씬 기획 및 스크립트',
                '스톡 영상 자동 선택 (Pexels)',
                'TTS 나레이션 (한국어·영어)',
                '씬별 자막 싱크',
                'MP4 내보내기',
                '인스타그램 이미지 카드뉴스 (4:5)',
              ]).map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#ed6238]" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href={accessHref}
              className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px"
            >
              {isEn ? 'Start for free' : '무료로 시작하기'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
