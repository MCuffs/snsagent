'use client'

import { useMemo, useState } from 'react'
import { Copy, Save, Trash2 } from 'lucide-react'
import {
  type CardTemplateRecord,
  type TemplateSlideConfig,
  type SupportedSlideCount,
  TEXT_POSITIONS,
  OVERLAY_TYPES,
  CROP_STYLES,
  CARD_TEMPLATE_DOMAINS,
  type CardTemplateDomain,
  makeDefaultSlide,
} from '../../../../lib/templates/types'
import { inputCls } from '../../_components/adminUtils'
import TemplatePreview from './TemplatePreview'
import { updateTemplateAction, duplicateTemplateAction, deleteTemplateAction } from '../actions'

const POSITION_GRID: ReadonlyArray<typeof TEXT_POSITIONS[number]> = TEXT_POSITIONS

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#999]">{children}</label>
}

function resizeSlides(slides: TemplateSlideConfig[], count: number): TemplateSlideConfig[] {
  const next: TemplateSlideConfig[] = []
  for (let i = 0; i < count; i++) {
    next.push(slides[i] ? { ...slides[i], slideNumber: i + 1 } : makeDefaultSlide(i + 1))
  }
  return next
}

export default function TemplateEditor({ template }: { template: CardTemplateRecord }) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState(template.description ?? '')
  const [status, setStatus] = useState<'active' | 'draft'>(template.status)
  const [isDefault, setIsDefault] = useState(template.isDefault)
  const [slideCount, setSlideCount] = useState<SupportedSlideCount>(template.slideCount === 7 ? 7 : 5)
  const [slides, setSlides] = useState<TemplateSlideConfig[]>(
    resizeSlides(template.slides.length ? template.slides : [], template.slideCount === 7 ? 7 : 5),
  )
  const [tags, setTags] = useState(template.tags)
  const [active, setActive] = useState(0)

  const slide = slides[active] ?? slides[0]

  const payload = useMemo(
    () =>
      JSON.stringify({
        name,
        description: description.trim() || null,
        status,
        isDefault,
        config: { slideCount, slides: resizeSlides(slides, slideCount), tags },
      }),
    [name, description, status, isDefault, slideCount, slides, tags],
  )

  function patchSlide(idx: number, mutate: (s: TemplateSlideConfig) => TemplateSlideConfig) {
    setSlides((prev) => prev.map((s, i) => (i === idx ? mutate(s) : s)))
  }
  const setField = <K extends keyof TemplateSlideConfig>(k: K, v: TemplateSlideConfig[K]) =>
    patchSlide(active, (s) => ({ ...s, [k]: v }))
  const setTypo = (k: keyof TemplateSlideConfig['typography'], v: number | string) =>
    patchSlide(active, (s) => ({ ...s, typography: { ...s.typography, [k]: v } }))
  const setOverlay = (k: keyof TemplateSlideConfig['overlay'], v: number | string) =>
    patchSlide(active, (s) => ({ ...s, overlay: { ...s.overlay, [k]: v } }))
  const setLayout = (k: keyof TemplateSlideConfig['layout'], v: number | string) =>
    patchSlide(active, (s) => ({ ...s, layout: { ...s.layout, [k]: v } }))
  const setBg = (k: keyof TemplateSlideConfig['background'], v: number | string) =>
    patchSlide(active, (s) => ({ ...s, background: { ...s.background, [k]: v } }))

  function changeSlideCount(count: SupportedSlideCount) {
    setSlideCount(count)
    setIsDefault(false)
    setSlides((prev) => resizeSlides(prev, count))
    if (active >= count) setActive(count - 1)
  }

  function tagsToString(arr: string[]) { return arr.join(', ') }
  function stringToTags(value: string) {
    return value.split(',').map((t) => t.trim()).filter(Boolean)
  }

  function toggleDomain(domain: CardTemplateDomain) {
    setTags((prev) => ({
      ...prev,
      domain: prev.domain.includes(domain)
        ? prev.domain.filter((item) => item !== domain)
        : [...prev.domain, domain],
    }))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-[#eee] bg-white p-4">
        <div className="flex-1 min-w-[260px] space-y-2">
          <div>
            <Label>템플릿 이름</Label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>설명 (선택)</Label>
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="예: 비즈니스/권위 있는 톤의 어두운 에디토리얼" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label>슬라이드 수</Label>
            <div className="flex gap-1">
              {([5, 7] as const).map((c) => (
                <button key={c} type="button" onClick={() => changeSlideCount(c)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${slideCount === c ? 'bg-[#111] text-white' : 'border border-[#ddd] bg-white text-[#555]'}`}>
                  {c}장
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>상태</Label>
            <button type="button" onClick={() => setStatus((s) => {
              if (s === 'active') {
                setIsDefault(false)
                return 'draft'
              }
              return 'active'
            })}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${status === 'active' ? 'bg-emerald-600 text-white' : 'border border-amber-300 bg-amber-50 text-amber-700'}`}>
              {status === 'active' ? '활성 (생성에 사용)' : '비활성 (draft)'}
            </button>
          </div>
          <div>
            <Label>기본 템플릿</Label>
            <button
              type="button"
              disabled={status !== 'active'}
              onClick={() => setIsDefault((value) => !value)}
              className={`rounded-lg px-3 py-2 text-sm font-bold ${isDefault ? 'bg-blue-600 text-white' : 'border border-[#ddd] bg-white text-[#555]'} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {isDefault ? `${slideCount}장 기본` : '기본으로 지정'}
            </button>
          </div>
          <form action={updateTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <input type="hidden" name="payload" value={payload} />
            <button className="flex items-center gap-1.5 rounded-lg bg-[#111] px-4 py-2 text-sm font-bold text-white hover:bg-[#333]">
              <Save className="h-4 w-4" /> 저장
            </button>
          </form>
          <form action={duplicateTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <button className="flex items-center gap-1.5 rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm font-bold text-[#333] hover:bg-[#f5f5f5]">
              <Copy className="h-4 w-4" /> 복제
            </button>
          </form>
          <form action={deleteTemplateAction}>
            <input type="hidden" name="id" value={template.id} />
            <button className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> 삭제
            </button>
          </form>
        </div>
      </div>

      {/* Tags */}
      <div className="rounded-xl border border-[#eee] bg-white p-4">
        <div className="mb-4">
          <Label>적용 도메인</Label>
          <div className="flex flex-wrap gap-1.5">
            {CARD_TEMPLATE_DOMAINS.map((domain) => (
              <button
                key={domain}
                type="button"
                onClick={() => toggleDomain(domain)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${tags.domain.includes(domain) ? 'bg-blue-600 text-white' : 'bg-[#f4f4f5] text-[#666]'}`}
              >
                {domain}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[#999]">여러 도메인을 선택할 수 있으며, 생성 시 판별된 도메인이 우선 반영됩니다.</p>
        </div>
        <h3 className="mb-3 text-sm font-bold text-[#111]">AI 선택 태그 <span className="font-normal text-[#999]">— 콘텐츠와 매칭되어 템플릿이 자동 선택됩니다 (쉼표로 구분)</span></h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['emotion', '감정 (emotion)', '예: authority, premium, serious'],
            ['industry', '산업 (industry)', '예: business, startup, beauty'],
            ['style', '스타일 (style)', '예: editorial, minimal, bold'],
            ['visualTone', '비주얼 톤 (visualTone)', '예: dark, bright, warm'],
          ] as const).map(([key, label, ph]) => (
            <div key={key}>
              <Label>{label}</Label>
              <input className={inputCls} placeholder={ph}
                value={tagsToString(tags[key])}
                onChange={(e) => setTags((prev) => ({ ...prev, [key]: stringToTags(e.target.value) }))} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Slide editor */}
        <div className="rounded-xl border border-[#eee] bg-white p-4">
          {/* Slide tabs */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setActive(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${i === active ? 'bg-[#111] text-white' : 'bg-[#f4f4f5] text-[#555] hover:bg-[#e8e8ea]'}`}>
                {s.slideNumber}. {s.label}
              </button>
            ))}
          </div>

          {slide && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>슬라이드 역할/라벨</Label>
                  <input className={inputCls} value={slide.label} maxLength={60} onChange={(e) => setField('label', e.target.value)} />
                </div>
              </div>

              {/* Text position 3x3 */}
              <div>
                <Label>텍스트 위치</Label>
                <div className="grid w-[150px] grid-cols-3 gap-1">
                  {POSITION_GRID.map((pos) => (
                    <button key={pos} type="button" title={pos} onClick={() => setField('textPosition', pos)}
                      className={`h-10 rounded-md border text-[9px] ${slide.textPosition === pos ? 'border-[#111] bg-[#111] text-white' : 'border-[#ddd] bg-white text-[#bbb] hover:border-[#999]'}`}>
                      ●
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-[#999]">{slide.textPosition}</p>
              </div>

              {/* Typography */}
              <div>
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  <NumberField label="Body size" value={slide.typography.bodyFontSize ?? Math.round(slide.typography.fontSize * 0.42)} min={12} max={120} onChange={(v) => setTypo('bodyFontSize', v)} />
                  <div>
                    <Label>Body color</Label>
                    <input type="color" value={slide.typography.bodyColor ?? slide.typography.textColor} onChange={(e) => setTypo('bodyColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#ddd]" />
                  </div>
                  <div>
                    <Label>Emphasis color</Label>
                    <input type="color" value={slide.typography.emphasisColor ?? slide.typography.textColor} onChange={(e) => setTypo('emphasisColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#ddd]" />
                  </div>
                </div>
                <h4 className="mb-2 text-xs font-bold text-[#111]">타이포그래피</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField label="폰트 크기" value={slide.typography.fontSize} min={12} max={220} onChange={(v) => setTypo('fontSize', v)} />
                  <NumberField label="굵기" value={slide.typography.fontWeight} min={100} max={900} step={100} onChange={(v) => setTypo('fontWeight', v)} />
                  <NumberField label="줄간격" value={slide.typography.lineHeight} min={0.8} max={2.4} step={0.02} onChange={(v) => setTypo('lineHeight', v)} />
                  <NumberField label="자간" value={slide.typography.letterSpacing} min={-10} max={40} step={0.5} onChange={(v) => setTypo('letterSpacing', v)} />
                  <div>
                    <Label>텍스트 색상</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={slide.typography.textColor} onChange={(e) => setTypo('textColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#ddd]" />
                      <input className={inputCls} value={slide.typography.textColor} onChange={(e) => setTypo('textColor', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Overlay */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-[#111]">오버레이</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SelectField label="타입" value={slide.overlay.type} options={OVERLAY_TYPES} onChange={(v) => setOverlay('type', v)} />
                  <NumberField label="불투명도 %" value={slide.overlay.opacity} min={0} max={100} onChange={(v) => setOverlay('opacity', v)} />
                  {slide.overlay.type === 'custom' && (
                    <div>
                      <Label>커스텀 색상</Label>
                      <input type="color" value={slide.overlay.customColor || '#000000'} onChange={(e) => setOverlay('customColor', e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-[#ddd]" />
                    </div>
                  )}
                </div>
              </div>

              {/* Layout */}
              <div>
                <div className="mb-3 max-w-xs">
                  <NumberField label="Content width (%)" value={slide.layout.contentWidth} min={30} max={100} onChange={(v) => setLayout('contentWidth', v)} />
                </div>
                <h4 className="mb-2 text-xs font-bold text-[#111]">레이아웃 여백</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <NumberField label="가로 여백(px)" value={slide.layout.paddingX} min={0} max={400} onChange={(v) => setLayout('paddingX', v)} />
                  <NumberField label="세로 여백(px)" value={slide.layout.paddingY} min={0} max={600} onChange={(v) => setLayout('paddingY', v)} />
                </div>
                <p className="mt-1.5 text-[11px] text-[#aaa]">텍스트 정렬은 위 &lsquo;텍스트 위치&rsquo;를 따릅니다.</p>
              </div>

              {/* Background */}
              <div>
                <h4 className="mb-2 text-xs font-bold text-[#111]">배경 규칙</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <Label>이미지 스타일</Label>
                    <input className={inputCls} value={slide.background.imageStyle} maxLength={200} onChange={(e) => setBg('imageStyle', e.target.value)} />
                  </div>
                  <SelectField label="크롭" value={slide.background.cropStyle} options={CROP_STYLES} onChange={(v) => setBg('cropStyle', v)} />
                  <NumberField label="블러" value={slide.background.blur} min={0} max={30} onChange={(v) => setBg('blur', v)} />
                </div>
                <p className="mt-1.5 text-[11px] text-[#aaa]">배경 규칙은 AI 배경 이미지 생성 프롬프트에 반영됩니다 (목업 미리보기에는 표시되지 않음).</p>
              </div>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-[#eee] bg-[#fafafa] p-4">
          <h3 className="mb-3 text-sm font-bold text-[#111]">미리보기 <span className="font-normal text-[#999]">(목업 콘텐츠)</span></h3>
          {slide && <TemplatePreview slide={slide} showLabel={false} />}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {slides.map((s, i) => (
              <button key={i} type="button" onClick={() => setActive(i)} className={`rounded-md p-0.5 ${i === active ? 'ring-2 ring-[#111]' : ''}`}>
                <TemplatePreview slide={s} showLabel={false} width={78} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NumberField({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input type="number" className={inputCls} value={value} min={min} max={max} step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }} />
    </div>
  )
}

function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: ReadonlyArray<T>; onChange: (v: T) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
