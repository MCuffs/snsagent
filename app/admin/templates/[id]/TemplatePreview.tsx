'use client'

import type { TemplateSlideConfig, TextPosition, OverlayType } from '../../../../lib/templates/types'

// Preview canvas is a scaled 1080x1350 (4:5) card. px values from the config are scaled to fit.
const CANVAS_WIDTH = 1080

const MOCK_BG = [
  'linear-gradient(135deg,#3a4a5a,#1c2530)',
  'linear-gradient(135deg,#5a4a3a,#2a2018)',
  'linear-gradient(135deg,#43525a,#20282c)',
  'linear-gradient(135deg,#4a3a52,#241c2a)',
  'linear-gradient(135deg,#2c3a30,#161c18)',
  'linear-gradient(135deg,#52433a,#2a201c)',
  'linear-gradient(135deg,#3a3f52,#1c1f2a)',
]

function mockContent(slide: TemplateSlideConfig): { headline: string; body: string } {
  const label = slide.label.toLowerCase()
  if (label.includes('quote')) return { headline: '"좋은 디자인은 보이지 않는다"', body: '— 브랜드 인용구 예시' }
  if (label.includes('stat')) return { headline: '87%', body: '고객이 재구매를 선택했습니다' }
  if (label.includes('cta')) return { headline: '지금 시작하세요', body: '프로필 링크에서 더 알아보기 →' }
  if (slide.slideNumber === 1) return { headline: '브랜드의 핵심 메시지를 한 줄로', body: '스와이프하여 더 알아보기' }
  return { headline: '핵심 포인트 제목', body: '여기에 본문 설명이 들어갑니다. 실제 생성 시 카피로 대체됩니다.' }
}

function alignItems(pos: TextPosition): string {
  if (pos.startsWith('top')) return 'flex-start'
  if (pos.startsWith('bottom')) return 'flex-end'
  return 'center'
}
function justifyContent(pos: TextPosition): string {
  if (pos.endsWith('left')) return 'flex-start'
  if (pos.endsWith('right')) return 'flex-end'
  return 'center'
}
// Mirrors the renderer: text-anchor is driven by the text position's horizontal component.
function textAlignFromPosition(pos: TextPosition): 'left' | 'center' | 'right' {
  if (pos.endsWith('right')) return 'right'
  if (pos.endsWith('center')) return 'center'
  return 'left'
}

function overlayBackground(overlay: { type: OverlayType; opacity: number; customColor?: string }): string {
  const a = Math.min(1, Math.max(0, overlay.opacity / 100))
  switch (overlay.type) {
    case 'none': return 'transparent'
    case 'dark': return `rgba(8,8,10,${a})`
    case 'light': return `rgba(248,248,246,${a})`
    case 'gradient': return `linear-gradient(to bottom, rgba(10,10,12,0) 30%, rgba(10,10,12,${a}) 100%)`
    case 'custom': {
      const hex = overlay.customColor || '#000000'
      return hexToRgba(hex, a)
    }
    default: return 'transparent'
  }
}

function hexToRgba(hex: string, a: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}

export default function TemplatePreview({ slide, showLabel = true, width = 264 }: { slide: TemplateSlideConfig; showLabel?: boolean; width?: number }) {
  const { headline, body } = mockContent(slide)
  const bg = MOCK_BG[(slide.slideNumber - 1) % MOCK_BG.length]
  const textAlign = textAlignFromPosition(slide.textPosition)
  const SCALE = width / CANVAS_WIDTH

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative overflow-hidden rounded-lg shadow-md ring-1 ring-black/10"
        style={{ width, height: width * 1.25, background: bg }}
      >
        {/* overlay */}
        <div className="absolute inset-0" style={{ background: overlayBackground(slide.overlay) }} />

        {/* text block */}
        <div
          className="absolute inset-0 flex"
          style={{
            alignItems: alignItems(slide.textPosition),
            justifyContent: justifyContent(slide.textPosition),
            paddingLeft: slide.layout.paddingX * SCALE,
            paddingRight: slide.layout.paddingX * SCALE,
            paddingTop: slide.layout.paddingY * SCALE,
            paddingBottom: slide.layout.paddingY * SCALE,
          }}
        >
          <div style={{ width: '100%', textAlign }}>
            <div
              style={{
                fontSize: slide.typography.fontSize * SCALE,
                fontWeight: slide.typography.fontWeight,
                lineHeight: slide.typography.lineHeight,
                letterSpacing: slide.typography.letterSpacing * SCALE,
                color: slide.typography.textColor,
                fontFamily: 'Pretendard, Apple SD Gothic Neo, sans-serif',
              }}
            >
              {headline}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: Math.max(7, slide.typography.fontSize * 0.42 * SCALE),
                fontWeight: 400,
                lineHeight: 1.4,
                color: slide.typography.textColor,
                opacity: 0.82,
              }}
            >
              {body}
            </div>
          </div>
        </div>
      </div>
      {showLabel && (
        <span className="text-[11px] font-medium text-[#888]">
          {slide.slideNumber}. {slide.label}
        </span>
      )}
    </div>
  )
}
