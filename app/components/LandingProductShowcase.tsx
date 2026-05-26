import Image from 'next/image'
import { ArrowRight, Download, MessageSquareText, Sparkles } from 'lucide-react'

const editorialCards = [
  '/front/shuffla-editorial-02.webp',
  '/front/shuffla-editorial-03.webp',
  '/front/shuffla-editorial-04.webp',
  '/front/shuffla-editorial-05.webp',
]

export function ProductShowcase() {
  return (
    <section id="product" className="border-t border-[#ebe8e2] bg-[#fbfaf7] py-24 md:py-32">
      <div className="mx-auto max-w-[1380px] px-5 md:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#847d73]">Product workflow</p>
          <h2 className="mt-5 text-[clamp(2.3rem,5vw,4.1rem)] font-semibold leading-[1.08] tracking-[-0.06em] text-[#171714]">
            아이디어에서 게시 가능한
            <br />
            카드뉴스까지 한 화면에서
          </h2>
        </div>

        <div className="space-y-8">
          <ShowcaseRow
            number="01"
            title="브랜드를 읽고, 콘텐츠 방향을 제안합니다"
            body="URL과 주제를 입력하면 브랜드 DNA, 타겟 고객, 콘텐츠 목적을 분석해 슬라이드별 흐름을 먼저 설계합니다."
            action="AI 기획 경험 살펴보기"
          >
            <DirectorMockup />
          </ShowcaseRow>
          <ShowcaseRow
            reverse
            number="02"
            title="생성된 결과를 바로 편집하고 완성합니다"
            body="문구, 배경 이미지, 오버레이와 타이포그래피를 조정하고 4:5 고해상도 이미지로 내려받습니다."
            action="편집 스튜디오 살펴보기"
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
  reverse = false,
  children,
}: {
  number: string
  title: string
  body: string
  action: string
  reverse?: boolean
  children: React.ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-[26px] border border-[#ebe8e2] bg-[#f5f3ee] p-5 md:p-8 lg:p-10">
      <div className={`grid items-center gap-9 lg:grid-cols-[0.35fr_0.65fr] lg:gap-12 ${reverse ? 'lg:grid-cols-[0.65fr_0.35fr]' : ''}`}>
        <div className={reverse ? 'lg:order-2' : ''}>
          <p className="font-mono text-xs tracking-[0.24em] text-[#999183]">{number} / SHUFFLA</p>
          <h3 className="mt-7 text-[clamp(1.65rem,3vw,2.35rem)] font-medium leading-[1.25] tracking-[-0.05em] text-[#24211d]">
            {title}
          </h3>
          <p className="mt-5 max-w-sm text-[15px] leading-7 text-[#716b63]">{body}</p>
          <a href="/api/auth/google/start" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-[#e95b30]">
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
    <div className="overflow-hidden rounded-[18px] border border-[#ddd9d1] bg-white shadow-[0_22px_65px_rgba(35,31,26,0.1)]">
      <div className="flex h-11 items-center border-b border-[#ede9e2] bg-[#fcfbf8] px-4">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#dbd7d0]" />
        </div>
        <p className="mx-auto text-[11px] font-medium text-[#8c8479]">{title}</p>
        <span className="rounded-full border border-[#e9e4db] px-2 py-1 text-[10px] text-[#989185]">Live</span>
      </div>
      {children}
    </div>
  )
}

function DirectorMockup() {
  return (
    <BrowserShell title="Shuffla / Generate">
      <div className="grid min-h-[440px] md:grid-cols-[0.42fr_0.58fr]">
        <div className="border-b border-[#eee9e1] bg-[#faf8f3] p-5 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#362f29]">
            <MessageSquareText className="h-4 w-4 text-[#e95b30]" />
            AI 콘텐츠 디렉터
          </div>
          <div className="mt-6 rounded-xl bg-white p-3 text-[11px] leading-5 text-[#686156] shadow-sm ring-1 ring-[#ebe6dc]">
            여름 신상품 선크림의 저장형 카드뉴스를 만들어줘.
          </div>
          <div className="mt-3 rounded-xl bg-[#302c27] p-3 text-[11px] leading-5 text-white/82">
            민감 피부 고객이 매일 확인할 수 있는 사용 팁 흐름으로 기획하겠습니다.
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl border border-[#e6e0d6] bg-white px-3 py-2.5 text-[10px] text-[#827a6f]">
            메시지 입력...
            <span className="rounded-lg bg-[#171714] px-2.5 py-1 text-white">Send</span>
          </div>
        </div>
        <div className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#978f83]">Recommended plan</p>
              <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[#211d19]">Daily UV Archive</p>
            </div>
            <span className="rounded-full bg-[#fff0e9] px-3 py-1 text-[10px] font-semibold text-[#e95b30]">저장형</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['dark-editorial', '5 slides', '4:5 feed'].map(item => (
              <div key={item} className="rounded-lg border border-[#ece6dc] bg-[#fcfbf9] px-2 py-3 text-center text-[10px] text-[#716a60]">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            {[
              ['01', 'Hook', '매일 바르는 선크림, 기준은?'],
              ['02', 'Context', '민감한 피부가 확인할 포인트'],
              ['03', 'Detail', '사용감과 루틴을 정리'],
              ['04', 'Value', '브랜드의 차별점을 전달'],
              ['05', 'CTA', '저장하고 상세 정보 확인'],
            ].map(([number, role, copy]) => (
              <div key={number} className="flex items-center gap-3 rounded-lg border border-[#eee9e1] px-3 py-2.5">
                <span className="font-mono text-[10px] text-[#aaa294]">{number}</span>
                <span className="w-12 text-[10px] font-semibold text-[#e95b30]">{role}</span>
                <span className="truncate text-[11px] text-[#5d574e]">{copy}</span>
              </div>
            ))}
          </div>
          <button className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#171714] text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" /> 카드뉴스 생성하기
          </button>
        </div>
      </div>
    </BrowserShell>
  )
}

function EditorMockup() {
  return (
    <BrowserShell title="Shuffla / Editorial Studio">
      <div className="grid min-h-[445px] grid-cols-[0.66fr_0.34fr] bg-[#fbfaf7]">
        <div className="flex gap-3 border-r border-[#ede8df] p-4 md:p-5">
          <div className="hidden w-14 space-y-2 md:block">
            {editorialCards.slice(0, 3).map((image, index) => (
              <div key={image} className={`relative aspect-[4/5] overflow-hidden rounded-md ${index === 1 ? 'ring-2 ring-[#e95b30]' : ''}`}>
                <Image src={image} alt="" fill sizes="56px" className="object-cover" />
              </div>
            ))}
          </div>
          <div className="relative mx-auto aspect-[4/5] max-h-[390px] min-h-[300px] flex-1 overflow-hidden rounded-lg bg-[#121212] shadow-[0_18px_45px_rgba(20,20,20,0.2)]">
            <Image src={editorialCards[2]} alt="생성된 Shuffla 카드뉴스 편집 화면" fill sizes="(min-width: 768px) 360px, 55vw" className="object-cover" />
            <div className="absolute inset-[7%] rounded-sm border border-dashed border-white/22" />
          </div>
        </div>
        <div className="p-3 md:p-4">
          <p className="text-xs font-semibold text-[#27231f]">카드 디자인 편집</p>
          <div className="mt-4 flex gap-1 rounded-lg bg-[#f1ede6] p-1 text-[9px] text-[#82796e]">
            {['글자', '배경', '효과'].map((label, index) => (
              <span key={label} className={`flex-1 rounded-md py-1.5 text-center ${index === 0 ? 'bg-white font-semibold text-[#27231f]' : ''}`}>{label}</span>
            ))}
          </div>
          <p className="mt-5 text-[10px] text-[#91887b]">타이틀</p>
          <div className="mt-2 rounded-md border border-[#e6dfd4] bg-white p-2 text-[10px] text-[#3c372f]">Why Shuffla?</div>
          {[
            ['글자 크기', '72'],
            ['어둡기', '82'],
            ['대비', '106'],
          ].map(([label, value]) => (
            <div key={label} className="mt-4">
              <div className="mb-2 flex justify-between text-[9px] text-[#847b70]"><span>{label}</span><span>{value}</span></div>
              <div className="h-1 rounded-full bg-[#e6e0d6]"><div className="h-1 w-2/3 rounded-full bg-[#e95b30]" /></div>
            </div>
          ))}
          <button className="mt-6 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-[#171714] text-[10px] font-medium text-white">
            <Download className="h-3 w-3" /> PNG 내보내기
          </button>
        </div>
      </div>
    </BrowserShell>
  )
}

export function CapabilityObjects() {
  const capabilities = [
    {
      figure: <LayerFigure />,
      title: '브랜드 중심 기획',
      body: '브랜드 URL, 톤앤매너, 핵심 상품 정보를 기반으로 콘텐츠 방향을 세웁니다.',
    },
    {
      figure: <AgentFigure />,
      title: 'AI 카피와 이미지',
      body: '슬라이드 흐름에 맞는 문구와 제품 중심의 비주얼을 함께 생성합니다.',
    },
    {
      figure: <ExportFigure />,
      title: '편집과 다운로드',
      body: '텍스트와 배경을 보정한 뒤 Instagram 4:5 결과물로 출력합니다.',
    },
  ]

  return (
    <section className="border-y border-[#ebe8e2] bg-white py-24 md:py-28">
      <div className="mx-auto max-w-[1300px] px-5 md:px-8">
        <div className="grid divide-y divide-[#ebe8e2] md:grid-cols-3 md:divide-x md:divide-y-0">
          {capabilities.map((item, index) => (
            <article key={item.title} className="px-0 py-10 first:pt-0 last:pb-0 md:px-10 md:py-0 md:first:pl-0 md:last:pr-0">
              <p className="font-mono text-[11px] tracking-[0.22em] text-[#aaa294]">FIG 0.{index + 1}</p>
              <div className="my-10 flex h-44 items-center justify-center text-[#9b9488]">{item.figure}</div>
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
      {[44, 34, 24, 14].map(offset => <path key={offset} d={`M25 ${68 + offset} 95 ${105 + offset} 165 ${68 + offset} 95 ${31 + offset}Z`} />)}
      <path d="M25 54 95 17 165 54 95 91Z" strokeWidth="1.5" />
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
      <path d="M94 57v28M78 71H65m58 0h-11" opacity=".65" />
    </svg>
  )
}

function ExportFigure() {
  return (
    <svg viewBox="0 0 190 145" className="h-40 w-52" fill="none" stroke="currentColor">
      {[0, 10, 20, 30, 40].map(offset => <rect key={offset} x={40 + offset} y={18 + offset} width="72" height="94" rx="4" />)}
      <path d="M95 96v34m0 0-13-13m13 13 13-13" strokeWidth="1.5" />
    </svg>
  )
}

export function EditorialGallery() {
  return (
    <div id="gallery" className="mx-auto mt-20 max-w-[1440px] px-4 md:mt-24 md:px-7">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {editorialCards.map((image, index) => (
          <figure
            key={image}
            className={`relative aspect-[4/5] overflow-hidden rounded-[16px] border border-[#e8e4dc] bg-[#171717] shadow-[0_18px_52px_rgba(22,20,18,0.1)] ${index % 2 === 1 ? 'md:translate-y-8' : ''}`}
          >
            <Image src={image} alt={`Shuffla가 생성한 브랜드 카드뉴스 ${index + 1}`} fill priority={index < 2} sizes="(min-width: 768px) 24vw, 48vw" className="object-cover" />
          </figure>
        ))}
      </div>
    </div>
  )
}
