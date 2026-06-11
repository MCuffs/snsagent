'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ArrowRight, Check, Download, MessageSquareText, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

const editorialCards = [
  '/front/shuffla-editorial-02.webp',
  '/front/shuffla-editorial-03.webp',
  '/front/shuffla-editorial-04.webp',
  '/front/shuffla-editorial-05.webp',
]

export function ProductShowcase({ authenticated = false }: { authenticated?: boolean }) {
  const t = useTranslations('landing')
  const accessHref = authenticated ? '/concept' : '/api/auth/google/start'

  return (
    <section id="product" className="border-t border-slate-100 bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1380px] px-5 md:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Product workflow</p>
          <h2 className="mt-5 text-[clamp(2.3rem,5vw,4.1rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-[#171714] whitespace-pre-line">
            {t('section_title')}
          </h2>
        </div>

        <div className="space-y-8">
          <ShowcaseRow
            number="01"
            title={t('row1_title')}
            body={t('row1_body')}
            action={t('row1_action')}
            href={accessHref}
          >
            <DirectorMockup />
          </ShowcaseRow>
          <ShowcaseRow
            reverse
            number="02"
            title={t('row2_title')}
            body={t('row2_body')}
            action={t('row2_action')}
            href={accessHref}
          >
            <EditorMockup />
          </ShowcaseRow>
        </div>
      </div>
    </section>
  )
}

function ShowcaseRow({
  number,
  title,
  body,
  action,
  href,
  reverse = false,
  children,
}: {
  number: string
  title: string
  body: string
  action: string
  href: string
  reverse?: boolean
  children: React.ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-[26px] border border-slate-200/60 bg-slate-50 p-5 md:p-8 lg:p-10">
      <div className={`grid items-center gap-9 lg:grid-cols-[0.35fr_0.65fr] lg:gap-12 ${reverse ? 'lg:grid-cols-[0.65fr_0.35fr]' : ''}`}>
        <div className={reverse ? 'lg:order-2' : ''}>
          <p className="font-mono text-xs tracking-[0.24em] text-[#999183]">{number} / SHUFFLA</p>
          <h3 className="mt-7 text-[clamp(1.65rem,3vw,2.35rem)] font-medium leading-[1.25] tracking-[-0.05em] text-[#24211d]">
            {title}
          </h3>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-[#716b63]">{body}</p>
          <a href={href} className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#e95b30]">
            {action} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className={reverse ? 'lg:order-1' : ''}>{children}</div>
      </div>
    </article>
  )
}

function BrowserShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_22px_65px_rgba(35,31,26,0.1)]">
      <div className="flex h-11 items-center border-b border-slate-100 bg-slate-50 px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
        </div>
        <p className="mx-auto text-[11px] font-medium text-[#8c8479]">{title}</p>
        <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] text-[#989185]">Live</span>
      </div>
      {children}
    </div>
  )
}

function DirectorMockup() {
  const t = useTranslations('landing')
  const [phase, setPhase] = useState<'ready' | 'generating' | 'done'>('ready')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slides = [
    ['01', 'Hook', t('slide_hook')],
    ['02', 'Context', t('slide_context')],
    ['03', 'Detail', t('slide_detail')],
    ['04', 'Value', t('slide_value')],
    ['05', 'CTA', t('slide_cta')],
  ]

  const generate = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (phase === 'done') {
      setPhase('ready')
      return
    }
    setPhase('generating')
    timerRef.current = setTimeout(() => setPhase('done'), 1100)
  }

  const directorMsg = phase === 'generating'
    ? t('director_thinking')
    : phase === 'done'
      ? t('director_done')
      : t('director_ready')

  const statusLabel = phase === 'generating'
    ? t('director_status_generating')
    : phase === 'done'
      ? t('director_status_done')
      : t('director_status_ready')

  const btnLabel = phase === 'generating'
    ? t('btn_generating')
    : phase === 'done'
      ? t('btn_done')
      : t('btn_ready')

  return (
    <BrowserShell title="Shuffla / Generate">
      <div className="grid min-h-[440px] md:grid-cols-[0.42fr_0.58fr]">
        <div className="border-b border-slate-100 bg-slate-50 p-5 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#362f29]">
            <MessageSquareText className="h-4 w-4 text-[#e95b30]" />
            {t('director_label')}
          </div>
          <div className="mt-6 rounded-xl bg-white p-3 text-[11px] leading-5 text-[#686156] shadow-sm ring-1 ring-slate-100">
            {t('director_user_msg')}
          </div>
          <div className="mt-3 rounded-xl bg-[#302c27] p-3 text-[11px] leading-5 text-white/82">
            {directorMsg}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] text-[#827a6f]">
            {t('msg_input')}
            <button type="button" onClick={generate} className="rounded-lg bg-[#171714] px-2.5 py-1 text-white transition active:scale-95">Send</button>
          </div>
        </div>
        <div className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#978f83]">Recommended plan</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[#211d19]">Daily UV Archive</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${phase === 'done' ? 'bg-[#eaf7ef] text-[#28784a]' : 'bg-[#fff0e9] text-[#e95b30]'}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['dark-editorial', '5 slides', '4:5 feed'].map(item => (
              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-center text-[10px] text-[#716a60]">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            {slides.map(([number, role, copy], index) => (
              <div
                key={number}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-500 ${
                  phase === 'generating' && index < 3 ? 'border-[#f0c6b7] bg-[#fff8f4]' : 'border-slate-200'
                } ${phase === 'done' ? 'translate-x-0 opacity-100' : ''}`}
              >
                <span className="font-mono text-[10px] text-[#aaa294]">{number}</span>
                <span className="w-12 text-[10px] font-semibold text-[#e95b30]">{role}</span>
                <span className="truncate text-[11px] text-[#5d574e]">{copy}</span>
                {phase === 'done' && <Check className="ml-auto h-3 w-3 text-[#3c9462]" />}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={generate}
            className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#171714] text-xs font-semibold text-white transition hover:bg-[#302c27] active:scale-[0.99]"
          >
            <Sparkles className={`h-3.5 w-3.5 ${phase === 'generating' ? 'animate-spin' : ''}`} />
            {btnLabel}
          </button>
        </div>
      </div>
    </BrowserShell>
  )
}

function EditorMockup() {
  const t = useTranslations('landing')
  const tabLabels = [t('tab_text'), t('tab_bg'), t('tab_effect')] as const
  type TabLabel = typeof tabLabels[number]
  const [selectedCard, setSelectedCard] = useState(2)
  const [tab, setTab] = useState<TabLabel>(tabLabels[0])
  const sliderKeys = [t('slider_text'), t('slider_darkness'), t('slider_contrast')]
  const [settings, setSettings] = useState<Record<string, number>>({
    [t('slider_text')]: 72,
    [t('slider_darkness')]: 82,
    [t('slider_contrast')]: 106,
  })
  const [exported, setExported] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const exportPng = () => {
    setExported(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExported(false), 1600)
  }

  return (
    <BrowserShell title="Shuffla / Editorial Studio">
      <div className="grid min-h-[445px] grid-cols-[0.66fr_0.34fr] bg-white">
        <div className="flex gap-3 border-r border-slate-200 p-4 md:p-5">
          <div className="hidden w-14 space-y-2 md:block">
            {editorialCards.slice(0, 3).map((image, index) => (
              <button type="button" key={image} onClick={() => setSelectedCard(index)} className={`relative block aspect-[4/5] w-full overflow-hidden rounded-md transition ${selectedCard === index ? 'ring-2 ring-[#e95b30]' : 'opacity-70 hover:opacity-100'}`}>
                <Image src={image} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
          <div className="relative mx-auto aspect-[4/5] max-h-[390px] min-h-[300px] flex-1 overflow-hidden rounded-lg bg-[#121212] shadow-[0_18px_45px_rgba(20,20,20,0.2)]">
            <Image src={editorialCards[selectedCard]} alt="Generated Shuffla card news editor" fill sizes="(min-width: 768px) 360px, 55vw" className="object-cover transition duration-500" />
            <div className="absolute inset-[7%] rounded-sm border border-dashed border-white/22" />
            {exported && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/94 px-3 py-1.5 text-[10px] font-medium text-[#211d19] shadow-lg">{t('export_done')}</div>}
          </div>
        </div>
        <div className="p-3 md:p-4">
          <p className="text-xs font-semibold text-[#27231f]">{t('editor_title')}</p>
          <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-[9px] text-[#82796e]">
            {tabLabels.map(label => (
              <button type="button" key={label} onClick={() => setTab(label)} className={`flex-1 rounded-md py-1.5 text-center transition ${tab === label ? 'bg-white font-semibold text-[#27231f]' : ''}`}>{label}</button>
            ))}
          </div>
          {tab === tabLabels[0] ? (
            <>
              <p className="mt-5 text-[10px] text-[#91887b]">Title</p>
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-[10px] text-[#3c372f]">Why Shuffla?</div>
            </>
          ) : (
            <div className="mt-5 rounded-md border border-slate-200 bg-white p-3 text-[10px] leading-5 text-[#6d665c]">
              {tab === tabLabels[1] ? t('bg_hint') : t('effect_hint')}
            </div>
          )}
          {sliderKeys.map((label) => (
            <label key={label} className="mt-4 block">
              <span className="mb-2 flex justify-between text-[9px] text-[#847b70]"><span>{label}</span><span>{settings[label]}</span></span>
              <input
                type="range"
                min={label === t('slider_contrast') ? 80 : 20}
                max={label === t('slider_contrast') ? 130 : 100}
                value={settings[label]}
                onChange={event => setSettings(current => ({ ...current, [label]: Number(event.target.value) }))}
                className="h-1 w-full cursor-pointer accent-[#e95b30]"
              />
            </label>
          ))}
          <button type="button" onClick={exportPng} className="mt-6 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#171714] text-[10px] font-medium text-white transition active:scale-[0.98]">
            <Download className="h-3 w-3" /> {t('export_png')}
          </button>
        </div>
      </div>
    </BrowserShell>
  )
}

export function CapabilityObjects() {
  const t = useTranslations('landing')
  const capabilities = [
    {
      figure: <LayerFigure />,
      title: t('capability_1_title'),
      body: t('capability_1_body'),
    },
    {
      figure: <AgentFigure />,
      title: t('capability_2_title'),
      body: t('capability_2_body'),
    },
    {
      figure: <ExportFigure />,
      title: t('capability_3_title'),
      body: t('capability_3_body'),
    },
  ]

  return (
    <section className="border-y border-slate-100 bg-white py-24 md:py-28">
      <div className="mx-auto max-w-[1300px] px-5 md:px-8">
        <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          {capabilities.map((item, index) => (
            <article key={item.title} className="px-0 py-10 first:pt-0 last:pb-0 md:px-10 md:py-0 md:first:pl-0 md:last:pr-0">
              <p className="font-mono text-[11px] tracking-[0.22em] text-slate-400">FIG 0.{index + 1}</p>
              <div className={`landing-capability-figure landing-capability-${index + 1} my-10 flex h-44 items-center justify-center text-[#9b9488]`}>{item.figure}</div>
              <h3 className="text-lg font-medium tracking-[-0.03em] text-[#211e1a]">{item.title}</h3>
              <p className="mt-3 max-w-xs text-sm leading-7 text-[#777064]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function LayerFigure() {
  return (
    <svg viewBox="0 0 190 145" className="h-40 w-52" fill="none" stroke="currentColor">
      {[44, 34, 24, 14].map((offset, index) => <path className="landing-layer-sheet" style={{ animationDelay: `${index * 0.18}s` }} key={offset} d={`M25 ${68 + offset} 95 ${105 + offset} 165 ${68 + offset} 95 ${31 + offset}Z`} />)}
      <path className="landing-layer-head" d="M25 54 95 17 165 54 95 91Z" strokeWidth="1.5" />
      <path d="M73 54h44M78 48h34M78 60h34" opacity=".65" />
    </svg>
  )
}

function AgentFigure() {
  return (
    <svg viewBox="0 0 190 145" className="h-40 w-52" fill="none" stroke="currentColor">
      <rect x="65" y="10" width="58" height="47" rx="6" />
      <rect x="20" y="48" width="58" height="47" rx="6" />
      <rect x="112" y="48" width="58" height="47" rx="6" />
      <rect x="65" y="86" width="58" height="47" rx="6" />
      <path className="landing-agent-route" d="M94 57v28M78 71H65m58 0h-11" opacity=".65" />
    </svg>
  )
}

function ExportFigure() {
  return (
    <svg viewBox="0 0 190 145" className="h-40 w-52" fill="none" stroke="currentColor">
      {[0, 10, 20, 30, 40].map((offset, index) => <rect className="landing-export-page" style={{ animationDelay: `${index * 0.14}s` }} key={offset} x={40 + offset} y={18 + offset} width="72" height="94" rx="4" />)}
      <path className="landing-export-arrow" d="M95 96v34m0 0-13-13m13 13 13-13" strokeWidth="1.5" />
    </svg>
  )
}

export function EditorialGallery() {
  return (
    <div id="gallery" className="mx-auto mt-20 max-w-[1240px] px-4 md:mt-24 md:px-7">
      <div className="overflow-hidden rounded-[24px] border border-[#e8e4dc] bg-[#171717] shadow-[0_24px_70px_rgba(22,20,18,0.14)]">
        <video
          className="block aspect-[1920/1244] w-full bg-[#171717] object-cover"
          src="/front/shuffla.mp4"
          aria-label="Shuffla product demo video"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  )
}

export function ConnectedWorkflow() {
  const t = useTranslations('landing')
  const stages = [
    { title: 'Concept', metric: t('workflow_stage1_metric'), detail: t('workflow_stage1_detail'), progress: '72%' },
    { title: 'Generate', metric: '5 slides ready', detail: t('workflow_stage2_detail'), progress: '100%' },
    { title: 'Export', metric: 'PNG / ZIP', detail: t('workflow_stage3_detail'), progress: '86%' },
  ]
  const [active, setActive] = useState(1)

  const activityItems = [
    [t('activity_1'), 'now'],
    [t('activity_2'), '04s'],
    [t('activity_3'), '12s'],
    [t('activity_4'), '18s'],
  ]

  return (
    <section id="workflow" className="bg-white py-24 md:py-32">
      <div className="mx-auto grid max-w-[1300px] gap-14 px-5 md:px-8 lg:grid-cols-[0.37fr_0.63fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">One connected system</p>
          <h2 className="mt-5 text-[clamp(2.2rem,4vw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.06em] whitespace-pre-line">
            {t('workflow_title')}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-7 text-slate-500">
            {t('workflow_desc')}
          </p>
        </div>
        <div className="landing-operations-panel overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#332f29]">
              <span className="landing-live-dot h-2 w-2 rounded-full bg-[#ed6238]" />
              Content operation / live
            </div>
            <span className="font-mono text-[10px] text-slate-400">05 assets synced</span>
          </div>
          <div className="grid md:grid-cols-[0.58fr_0.42fr]">
            <div className="border-b border-slate-200 p-5 md:border-b-0 md:border-r">
              <div className="relative flex justify-between pb-8">
                <span className="landing-pipeline-track absolute left-8 right-8 top-[17px] h-px bg-slate-200" />
                {stages.map((stage, index) => (
                  <button key={stage.title} type="button" onClick={() => setActive(index)} className="relative z-10 flex flex-col items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs transition ${active === index ? 'border-[#ed6238] bg-[#fff2ed] text-[#ed6238]' : 'border-slate-200 bg-white text-[#a29a8d]'}`}>
                      0{index + 1}
                    </span>
                    <span className={`text-[11px] transition ${active === index ? 'font-medium text-[#302c26]' : 'text-[#81796d]'}`}>{stage.title}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[#29251f]">{stages[active].metric}</p>
                  <p className="font-mono text-[11px] text-[#e95b30]">{stages[active].progress}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">{stages[active].detail}</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="landing-operation-progress h-full rounded-full bg-[#ed6238]" style={{ width: stages[active].progress }} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniAsset label="Brand profile" value="Matched" />
                <MiniAsset label="Format" value="1080 x 1350" />
              </div>
            </div>
            <div className="p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Activity stream</p>
              <div className="mt-5 space-y-4">
                {activityItems.map(([message, time], index) => (
                  <div key={message} className="landing-activity-item flex gap-3" style={{ animationDelay: `${index * 0.55}s` }}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ed6238]" />
                    <div className="flex-1 border-b border-slate-100 pb-3">
                      <p className="text-[11px] text-[#514b43]">{message}</p>
                      <p className="mt-1 font-mono text-[9px] text-[#a39b90]">{time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MiniAsset({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#eee7dd] px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.14em] text-[#a1988b]">{label}</p>
      <p className="mt-2 text-[11px] font-medium text-[#514b43]">{value}</p>
    </div>
  )
}
