'use client'

type StoryboardSlide = {
  slideNumber: number
  role: string
  headline: string
  body: string
}

type StoryboardStage3DProps = {
  slides: StoryboardSlide[]
  swatches: string[]
  selectedSlideNumber: number
  onSelect: (slideNumber: number) => void
  locale: string
}

function colorAt(swatches: string[], index: number, fallback: string) {
  return swatches[index % Math.max(swatches.length, 1)] || fallback
}

export default function StoryboardStage3D({
  slides,
  swatches,
  selectedSlideNumber,
  onSelect,
  locale,
}: StoryboardStage3DProps) {
  const isEn = locale === 'en'
  const selectedIndex = Math.max(0, slides.findIndex(slide => slide.slideNumber === selectedSlideNumber))

  return (
    <div className="relative overflow-hidden bg-[#10151f] px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(135deg,#10151f_0%,#253245_52%,#111827_100%)]" />
      <div className="relative mx-auto flex min-h-[300px] max-w-5xl items-center justify-center [perspective:1200px]">
        <div className="relative h-[260px] w-full max-w-[720px] [transform-style:preserve-3d]">
          {slides.map((slide, index) => {
            const distance = index - selectedIndex
            const isSelected = slide.slideNumber === selectedSlideNumber
            const primary = colorAt(swatches, index, '#2563eb')
            const secondary = colorAt(swatches, index + 1, '#111827')
            const transform = `translateX(${distance * 118}px) translateZ(${isSelected ? 92 : -Math.abs(distance) * 54}px) rotateY(${-distance * 12}deg) scale(${isSelected ? 1 : 0.86})`

            return (
              <button
                key={`${slide.slideNumber}-${slide.headline}`}
                type="button"
                onClick={() => onSelect(slide.slideNumber)}
                className={`absolute left-1/2 top-1/2 flex aspect-[4/5] w-[168px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[22px] border text-left shadow-2xl transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-[200px] ${
                  isSelected ? 'z-20 border-white/70 opacity-100' : 'z-10 border-white/20 opacity-65 hover:opacity-90'
                }`}
                style={{ transform }}
                aria-pressed={isSelected}
                aria-label={isEn ? `Select card ${slide.slideNumber}` : `${slide.slideNumber}번 카드 선택`}
              >
                <span
                  className="flex flex-1 flex-col justify-between p-4 text-white"
                  style={{ background: `linear-gradient(145deg, ${primary}, ${secondary})` }}
                >
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                    <span>{slide.role}</span>
                    <span>{String(slide.slideNumber).padStart(2, '0')}</span>
                  </span>
                  <span>
                    <span className="block text-lg font-black leading-6 sm:text-xl">{slide.headline}</span>
                    <span className="mt-3 block line-clamp-4 text-xs font-semibold leading-5 text-white/78">{slide.body}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="relative mt-1 flex items-center justify-center gap-2">
        {slides.map(slide => (
          <button
            key={slide.slideNumber}
            type="button"
            onClick={() => onSelect(slide.slideNumber)}
            className={`h-1.5 rounded-full transition-all ${
              slide.slideNumber === selectedSlideNumber ? 'w-8 bg-white' : 'w-2 bg-white/35 hover:bg-white/60'
            }`}
            aria-label={isEn ? `Go to card ${slide.slideNumber}` : `${slide.slideNumber}번 카드로 이동`}
          />
        ))}
      </div>
    </div>
  )
}
