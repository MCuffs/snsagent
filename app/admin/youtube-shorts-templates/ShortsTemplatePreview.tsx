import type { YouTubeShortsTemplateRecord } from '../../../lib/youtube-shorts-templates/types'

export function ShortsTemplatePreview({ template, compact = false }: {
  template: YouTubeShortsTemplateRecord
  compact?: boolean
}) {
  const { layout, hookDesign, captionStyle, cta } = template.config
  const position = captionStyle.captionPosition === 'top' ? 'top-3' : captionStyle.captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3'
  return (
    <div className={`relative overflow-hidden rounded-lg border shadow-sm ${compact ? 'h-40 w-[90px]' : 'aspect-[9/16] w-full max-w-[320px]'}`} style={{ backgroundColor: layout.backgroundColor }}>
      {layout.headerEnabled && (
        <div className="relative flex flex-col justify-center overflow-hidden px-[7%]" style={{
          height: `${layout.headerHeight}%`,
          background: hookDesign.backgroundType === 'gradient'
            ? `linear-gradient(135deg, ${hookDesign.backgroundGradientStart}, ${hookDesign.backgroundGradientEnd})`
            : hookDesign.backgroundType === 'transparent' ? 'transparent' : hookDesign.backgroundColor,
          color: hookDesign.textColor,
          textAlign: hookDesign.textAlign,
        }}>
          {hookDesign.categoryBadgeEnabled && <span className={`${compact ? 'mb-1 text-[3px]' : 'mb-2 text-[8px]'} w-fit rounded bg-cyan-300 px-1.5 py-0.5 font-black text-slate-950`}>SHUFFLA NOW</span>}
          {hookDesign.profileHeaderEnabled && <span className={`${compact ? 'text-[3px]' : 'text-[8px]'} mb-1 font-bold opacity-60`}>● Shuffla Archive</span>}
          <span className={`${compact ? 'text-[5px]' : 'text-lg'} font-black leading-none`} style={{ letterSpacing: compact ? -0.3 : hookDesign.letterSpacing / 4 }}>
            시선을 잡는 첫 문장
          </span>
          <span className={`${compact ? 'text-[5px]' : 'text-lg'} font-black leading-none`} style={{ color: hookDesign.emphasisColor, letterSpacing: compact ? -0.3 : hookDesign.letterSpacing / 4 }}>
            핵심 단어를 강조
          </span>
        </div>
      )}
      <div className="relative bg-gradient-to-br from-slate-600 via-slate-800 to-black" style={{ height: `${layout.videoAreaHeight}%` }}>
        <div className={`absolute inset-x-2 ${position} text-center font-black leading-tight`} style={{
          color: captionStyle.captionColor,
          WebkitTextStroke: `${compact ? 0.3 : 1}px ${captionStyle.captionStrokeColor}`,
          backgroundColor: captionStyle.captionBackgroundEnabled ? captionStyle.captionBackgroundColor : 'transparent',
          fontSize: compact ? 6 : Math.max(13, captionStyle.captionFontSize / 4),
        }}>핵심 자막이 표시됩니다</div>
      </div>
      {layout.footerEnabled && (
        <div className="flex flex-col justify-center px-[6%]" style={{ height: `${layout.footerHeight}%` }}>
          <span className={`${compact ? 'text-[5px]' : 'text-xs'} font-bold`}>@shuffla · 구독</span>
          {cta.ctaEnabled && <span className={`${compact ? 'text-[4px]' : 'text-[10px]'} opacity-60`}>{cta.ctaText}</span>}
        </div>
      )}
    </div>
  )
}
