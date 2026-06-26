import Link from 'next/link'
import { ArrowRight, Check, Calendar, Zap, PlaySquare, TrendingUp, Clock, Download } from 'lucide-react'
import { MarketingNav } from '../../../components/MarketingNav'
import { MarketingFooter } from '../../../components/MarketingFooter'
import { getSessionUser } from '../../../../lib/auth/user'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
  return {
    title: isEn ? 'YouTube Automation — Shuffla' : '유튜브 자동화 솔루션 — Shuffla',
    description: isEn
      ? 'Automated daily YouTube Shorts production. AI generates 30 topics, scripts, and produces MP4 videos — ready to upload.'
      : 'AI가 매일 유튜브 쇼츠를 자동 제작합니다. 30개 주제 기획·스크립트·영상 제작·업로드 준비까지.',
    alternates: {
      canonical: `${base}/${locale}/solutions/youtube-automation`,
    },
    openGraph: {
      title: isEn ? 'YouTube Automation — Shuffla' : '유튜브 자동화 솔루션 — Shuffla',
      url: `${base}/${locale}/solutions/youtube-automation`,
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630 }],
    },
  }
}

const FEATURES = [
  { icon: Calendar, title: '30일 콘텐츠 기획', titleEn: '30-day Content Plan', desc: '채널 주제를 입력하면 AI가 30개의 숏폼 주제와 제목을 자동으로 기획합니다.', descEn: 'Enter your channel topic and AI plans 30 short-form titles and scripts.' },
  { icon: Zap, title: '원클릭 영상 제작', titleEn: 'One-click Video Production', desc: '제목을 클릭하면 스크립트·스톡 영상·TTS·자막이 자동으로 합성됩니다.', descEn: 'Click a title and script, stock video, TTS, and subtitles are auto-composited.' },
  { icon: TrendingUp, title: '유튜브 알고리즘 최적화', titleEn: 'Algorithm-friendly Cadence', desc: '하루 1편 제한으로 알고리즘 친화적인 업로드 패턴을 유지합니다.', descEn: 'One video per day keeps your upload pattern algorithm-friendly.' },
  { icon: Clock, title: '24시간 업로드 리듬', titleEn: '24-hour Upload Rhythm', desc: '다음 영상까지 남은 시간을 확인하고 꾸준한 업로드 습관을 만듭니다.', descEn: 'Track time until the next video to build a consistent upload habit.' },
  { icon: PlaySquare, title: '쇼츠 최적화 포맷', titleEn: 'Shorts-optimized Format', desc: '세로형 9:16 비율, 자막, 나레이션까지 유튜브 쇼츠에 최적화된 포맷으로 출력됩니다.', descEn: 'Vertical 9:16, subtitles, narration — optimized for YouTube Shorts.' },
  { icon: Download, title: 'MP4 즉시 다운로드', titleEn: 'Instant MP4 Download', desc: '완성된 영상을 즉시 다운로드해 유튜브에 업로드하세요.', descEn: 'Download finished MP4s instantly and upload to YouTube.' },
]

const STEPS = [
  { num: '01', ko: '채널 주제 입력', en: 'Enter Channel Topic', desc: '채널의 카테고리와 타겟 키워드를 입력합니다.', descEn: 'Enter your channel category and target keywords.' },
  { num: '02', ko: 'AI가 30일 기획', en: 'AI Plans 30 Days', desc: 'AI가 30개의 쇼츠 제목과 키워드를 즉시 생성합니다.', descEn: 'AI instantly generates 30 Shorts titles and keywords.' },
  { num: '03', ko: '제목 클릭 → 제작', en: 'Click → Produce', desc: '원하는 제목을 클릭하면 자동으로 영상이 제작됩니다.', descEn: 'Click any title to auto-produce the video.' },
  { num: '04', ko: '매일 업로드', en: 'Upload Daily', desc: '24시간마다 다음 영상을 제작해 유튜브 채널을 성장시킵니다.', descEn: 'Produce the next video every 24 hours to grow your channel.' },
]

export default async function YouTubeAutomationSolutionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const authenticated = Boolean(await getSessionUser())
  const accessHref = `/${locale}/youtube-automation`

  return (
    <main className="text-[#171714]">
      <MarketingNav authenticated={authenticated} locale={locale} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#0a0a0a]">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,0,0,0.14)_0%,transparent_65%)] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-28 text-center md:pt-36">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-[#c9bcb0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff0000]" />
            {isEn ? 'Solution' : '솔루션'}
          </div>

          <h1 className="mt-7 text-[clamp(2.6rem,7vw,6rem)] font-bold leading-[0.9] tracking-[-0.055em] text-white">
            {isEn ? (
              <>YouTube Shorts<br /><span className="text-[#ff4444]">on Autopilot</span></>
            ) : (
              <>유튜브 쇼츠<br /><span className="text-[#ff4444]">자동화</span></>
            )}
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-[15px] leading-8 text-[#9a9080]">
            {isEn
              ? 'AI plans 30 days of content, then produces each video with a single click — script, stock video, TTS, subtitles, all in MP4.'
              : 'AI가 30일 콘텐츠를 기획하고, 클릭 한 번에 스크립트·스톡 영상·TTS·자막을 MP4로 완성합니다.'}
          </p>

          <Link
            href={accessHref}
            className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-[#ff0000] px-8 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#dd0000]"
          >
            {isEn ? 'Try it free' : '무료로 시작하기'} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs text-[#6b6258]">{isEn ? 'No credit card required' : '신용카드 불필요'}</p>
        </div>

        {/* Video showcase */}
        <div className="relative z-10 mx-auto max-w-4xl px-4 pb-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-[#0a0a0a] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-white to-transparent" />

          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
            <video
              src="https://xpsfm8kjiynpuakq.public.blob.vercel-storage.com/solution-youtube-automation.mp4"
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
              {isEn ? 'Your channel, automated' : '채널 운영을 자동화하세요'}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#756e63]">
              {isEn
                ? 'From content planning to ready-to-upload MP4s — run your YouTube channel without a production team.'
                : '콘텐츠 기획부터 업로드 준비 MP4까지 — 제작팀 없이 유튜브 채널을 운영하세요.'}
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, titleEn, desc, descEn }) => (
              <div key={title} className="rounded-2xl border border-[#eee8e0] bg-[#faf8f5] p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ff0000]/10">
                  <Icon className="h-5 w-5 text-[#ff3333]" />
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
              {isEn ? '4 steps to daily uploads' : '4단계로 매일 업로드'}
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
              {isEn ? 'What you get' : '포함된 내용'}
            </p>
            <h2 className="mx-auto mt-6 max-w-2xl text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-0.055em]">
              {isEn ? '30 videos. One channel. Zero team.' : '영상 30개. 채널 1개. 팀은 0명.'}
            </h2>

            <ul className="mx-auto mt-10 inline-flex flex-col items-start gap-3 text-sm text-[#504a43]">
              {(isEn ? [
                '30-day content plan (AI-generated topics)',
                'One-click per-video production',
                'Stock video auto-selection (Pexels)',
                'TTS narration & subtitle sync',
                'MP4 export (Shorts 9:16)',
                '24-hour algorithm-friendly cadence',
              ] : [
                '30일 콘텐츠 기획 (AI 주제 생성)',
                '클릭 한 번으로 영상 제작',
                '스톡 영상 자동 선택 (Pexels)',
                'TTS 나레이션·자막 싱크',
                'MP4 내보내기 (쇼츠 9:16)',
                '유튜브 알고리즘 친화적 24시간 리듬',
              ]).map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-[#ff3333]" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href={accessHref}
              className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-[#171714] px-8 text-sm font-semibold text-white transition hover:-translate-y-px"
            >
              {isEn ? 'Start automating' : '자동화 시작하기'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter authenticated={authenticated} locale={locale} />
    </main>
  )
}
