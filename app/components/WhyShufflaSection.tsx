'use client'

import { useState } from 'react'
import { RefreshCw, Layers, Zap, Palette, PenTool } from 'lucide-react'

const reasons = [
  {
    id: 'no-repeat',
    tab: '반복 없음',
    icon: RefreshCw,
    accentColor: '#22c55e',
    title: '한 번 설정하면 끝',
    subtitle: '매번 설명할 필요 없습니다',
    desc: '브랜드 이름, 타겟 고객, 어조를 딱 한 번만 입력하세요. 이후로는 상품 정보만 넣으면 Shuffla가 브랜드에 맞는 카드뉴스를 자동으로 완성합니다. 매번 "이런 스타일로 해줘"라고 설명하는 일은 없어요.',
    visual: (
      <div className="w-full h-full flex flex-col justify-center gap-3 px-2">
        <div className="rounded-xl bg-white shadow-sm border border-black/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-wider">브랜드 설정</span>
            <span className="text-[10px] font-bold text-[#22c55e] bg-[#f0fdf4] px-2 py-0.5 rounded-full">저장됨 ✓</span>
          </div>
          <div className="space-y-2">
            {['브랜드명 · 코어핏', '업종 · 스포츠 의류', '어조 · 활기차고 직접적'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
                <span className="text-[12px] text-[#525252]">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['1번째', '2번째', '3번째'].map((n, i) => (
            <div key={n} className={`flex-1 rounded-lg border text-center py-2.5 text-[11px] font-bold transition-all ${i === 2 ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]' : 'bg-white text-[#8a8a8a] border-black/[0.08]'}`}>
              {n} 생성
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] text-[#22c55e] font-bold">↑ 3번 모두 같은 브랜드 톤</div>
      </div>
    ),
  },
  {
    id: 'versatile',
    tab: '다양한 활용',
    icon: Layers,
    accentColor: '#6366f1',
    title: '인스타만이 아닙니다',
    subtitle: '블로그, 썸네일까지 한 번에',
    desc: '인스타그램 카드뉴스뿐만 아니라 블로그 썸네일, 스마트스토어 상세 이미지, 뉴스레터 헤더까지 폭넓게 활용할 수 있습니다. 한 번의 작업으로 여러 채널을 동시에 채워보세요.',
    visual: (
      <div className="w-full h-full flex flex-col justify-center gap-2 px-2">
        <div className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-wider mb-1">활용 채널</div>
        {[
          { label: '인스타그램 카드뉴스', color: 'bg-[#fce7f3] text-[#be185d]', size: '1:1 · 4:5' },
          { label: '블로그 썸네일', color: 'bg-[#ede9fe] text-[#6d28d9]', size: '16:9' },
          { label: '스마트스토어 상세', color: 'bg-[#fef9c3] text-[#a16207]', size: '1:1 · 세로형' },
          { label: '뉴스레터 헤더', color: 'bg-[#dcfce7] text-[#15803d]', size: '가로형' },
        ].map((ch) => (
          <div key={ch.label} className="flex items-center justify-between rounded-xl bg-white border border-black/[0.06] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className={`rounded-md px-2 py-0.5 text-[10px] font-black ${ch.color}`}>{ch.size}</div>
              <span className="text-[13px] font-medium text-[#0a0a0a]">{ch.label}</span>
            </div>
            <div className="w-4 h-4 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'affordable',
    tab: '저렴한 시작',
    icon: Zap,
    accentColor: '#ff6b35',
    title: '결제 없이 오늘 바로',
    subtitle: '무료로 첫 카드뉴스를 완성하세요',
    desc: 'Google 로그인 하나로 시작합니다. 무료 플랜으로 하루 한 번 완성도 높은 카드뉴스를 만들어보고, 실제로 필요해질 때 업그레이드하면 됩니다. 초기 비용 부담 없이 충분히 경험해보세요.',
    visual: (
      <div className="w-full h-full flex flex-col justify-center items-center gap-4 px-2">
        <div className="rounded-2xl bg-white border border-black/[0.06] shadow-sm p-6 w-full text-center">
          <div className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-wider mb-2">Free 플랜</div>
          <div className="text-[52px] font-black tracking-[-0.04em] text-[#0a0a0a] leading-none">₩0</div>
          <div className="mt-2 text-[13px] text-[#525252]">신용카드 불필요 · 즉시 시작</div>
          <div className="mt-4 space-y-1.5">
            {['하루 1회 카드뉴스 생성', '편집·다운로드 가능', 'Google 로그인 하나로'].map((f) => (
              <div key={f} className="flex items-center justify-center gap-1.5 text-[12px] text-[#525252]">
                <span className="text-[#ff6b35]">✓</span> {f}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-[#8a8a8a]">마음에 들면 그때 업그레이드하세요</div>
      </div>
    ),
  },
  {
    id: 'brand',
    tab: '브랜드 일관성',
    icon: Palette,
    accentColor: '#f59e0b',
    title: '매번 같은 브랜드 느낌',
    subtitle: '어조·색감·문구 스타일이 통일됩니다',
    desc: '브랜드 DNA 설정을 통해 생성되는 모든 카드뉴스가 동일한 아이덴티티를 유지합니다. 혼자 만들든, 팀원이 만들든 브랜드 목소리가 일관됩니다. 들쑥날쑥한 퀄리티는 이제 그만.',
    visual: (
      <div className="w-full h-full flex flex-col justify-center gap-3 px-2">
        <div className="text-[11px] font-bold text-[#8a8a8a] uppercase tracking-wider">생성된 카드뉴스 3종</div>
        <div className="space-y-2">
          {[
            { headline: '사기 전에 꼭 보세요', body: '비슷해도 소재가 다릅니다', tag: '신상품 론칭' },
            { headline: '이거 하나로 정리 끝', body: '트레이닝 루틴을 바꿨습니다', tag: '시즌 기획' },
            { headline: '후기 좋은 이유 있음', body: '3개월 사용 후 솔직 평가', tag: '고객 리뷰' },
          ].map((card) => (
            <div key={card.tag} className="rounded-xl bg-white border border-black/[0.06] px-4 py-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-bold text-[#0a0a0a]">{card.headline}</div>
                  <div className="text-[11px] text-[#525252] mt-0.5">{card.body}</div>
                </div>
                <span className="shrink-0 text-[9px] font-bold text-[#f59e0b] bg-[#fef9c3] px-1.5 py-0.5 rounded-full">{card.tag}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] text-[#f59e0b] font-bold">↑ 같은 브랜드, 다른 캠페인</div>
      </div>
    ),
  },
  {
    id: 'copy',
    tab: 'AI 에디토리얼',
    icon: PenTool,
    accentColor: '#8b5cf6',
    title: 'AI가 카피도 씁니다',
    subtitle: '클리셰 없는 네이티브 한국어',
    desc: '"혁신적인", "최고의" 같은 흔한 표현 대신, 대학내일·뉴닉 스타일의 네이티브 한국어 카피를 생성합니다. 타겟 독자가 스크롤을 멈추고 싶어지는 문장이 만들어집니다.',
    visual: (
      <div className="w-full h-full flex flex-col justify-center gap-3 px-2">
        <div className="rounded-xl bg-white border border-black/[0.06] p-4 shadow-sm">
          <div className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wider mb-2 flex items-center gap-1">
            <span>✕</span> AI 클리셰
          </div>
          <div className="space-y-1">
            {['혁신적인 소재로 만든 최고의 제품', '완벽한 품질, 특별한 경험을 드립니다'].map((t) => (
              <div key={t} className="text-[12px] text-[#8a8a8a] line-through">{t}</div>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="text-[#8b5cf6] font-black text-lg">↓</div>
        </div>
        <div className="rounded-xl bg-[#f5f3ff] border border-[#8b5cf6]/20 p-4">
          <div className="text-[10px] font-bold text-[#8b5cf6] uppercase tracking-wider mb-2 flex items-center gap-1">
            <span>✓</span> Shuffla 에디토리얼
          </div>
          <div className="space-y-1">
            {['사기 전에 꼭 보세요', '비슷해 보여도 소재가 다릅니다'].map((t) => (
              <div key={t} className="text-[13px] font-bold text-[#0a0a0a]">{t}</div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

export function WhyShufflaSection() {
  const [active, setActive] = useState(0)
  const current = reasons[active]

  return (
    <section className="pb-28 lg:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#ff6b35]">Why Shuffla</p>
          <h2 className="mt-5 text-[36px] md:text-[44px] font-black tracking-[-0.04em] leading-[1.08] text-[#0a0a0a]">
            Shuffla를 써야 하는 이유
          </h2>
          <p className="mt-4 text-[16px] text-[#525252] max-w-sm mx-auto">
            콘텐츠 제작의 반복 작업을 끝내는 방법
          </p>
        </div>

        {/* Tab Card */}
        <div className="rounded-[24px] bg-white border border-black/[0.06] overflow-hidden shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]">
          {/* Tab Nav */}
          <div className="flex border-b border-black/[0.06] overflow-x-auto scrollbar-hide">
            {reasons.map((r, i) => {
              const Icon = r.icon
              const isActive = i === active
              return (
                <button
                  key={r.id}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-2 px-6 py-4 text-[13px] font-bold whitespace-nowrap shrink-0 transition-all border-b-2 ${
                    isActive
                      ? 'border-[#0a0a0a] text-[#0a0a0a]'
                      : 'border-transparent text-[#8a8a8a] hover:text-[#525252]'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#ff6b35]' : ''}`} strokeWidth={2.5} />
                  {r.tab}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-[5fr_6fr] min-h-[340px]">
            {/* Visual */}
            <div className="bg-[#fafaf7] border-r border-black/[0.06] p-8 flex items-center">
              {current.visual}
            </div>

            {/* Text */}
            <div className="p-10 flex flex-col justify-center">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider w-fit mb-5"
                style={{ backgroundColor: current.accentColor + '18', color: current.accentColor }}
              >
                {current.tab}
              </div>
              <h3 className="text-[28px] md:text-[32px] font-black tracking-[-0.03em] text-[#0a0a0a] leading-[1.15]">
                {current.title}
              </h3>
              <p className="mt-2 text-[14px] font-semibold text-[#8a8a8a]">{current.subtitle}</p>
              <p className="mt-5 text-[15px] leading-[1.75] text-[#525252]">{current.desc}</p>
            </div>
          </div>

          {/* Pagination dots */}
          <div className="flex justify-center gap-2 py-5 border-t border-black/[0.06]">
            {reasons.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-full transition-all ${
                  i === active ? 'w-6 h-2 bg-[#0a0a0a]' : 'w-2 h-2 bg-black/20 hover:bg-black/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom stat pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {[
            { label: '브랜드 설정 1회', sub: '이후 자동 적용' },
            { label: '5가지 채널', sub: '인스타 · 블로그 · 썸네일 외' },
            { label: '무료로 시작', sub: '결제 없이 첫 카드뉴스' },
            { label: 'AI 에디토리얼', sub: '클리셰 없는 네이티브 카피' },
          ].map((pill) => (
            <div
              key={pill.label}
              className="flex items-center gap-3 rounded-full bg-white border border-black/[0.08] px-5 py-2.5 shadow-sm"
            >
              <span className="text-[13px] font-bold text-[#0a0a0a]">{pill.label}</span>
              <span className="text-[12px] text-[#8a8a8a]">{pill.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
