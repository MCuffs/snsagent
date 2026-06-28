'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ShortsTemplateConfig, YouTubeShortsTemplateRecord } from '../../../../lib/youtube-shorts-templates/types'
import { applyHookPreset } from '../../../../lib/youtube-shorts-templates/hook-presets'
import { saveShortsTemplateAction } from '../actions'
import { ShortsTemplatePreview } from '../ShortsTemplatePreview'

type Section = keyof ShortsTemplateConfig

export function ShortsTemplateEditor({ initial }: { initial: YouTubeShortsTemplateRecord }) {
  const [draft, setDraft] = useState(initial)
  const [advanced, setAdvanced] = useState(JSON.stringify(initial.config, null, 2))
  const [jsonError, setJsonError] = useState('')

  function updateConfig(section: Section, field: string, value: unknown) {
    setDraft(current => {
      const sectionValue = current.config[section] as unknown as Record<string, unknown>
      const config = { ...current.config, [section]: { ...sectionValue, [field]: value } }
      setAdvanced(JSON.stringify(config, null, 2))
      return { ...current, config }
    })
  }

  function selectHookPreset(preset: ShortsTemplateConfig['hookDesign']['preset']) {
    setDraft(current => {
      const hookDesign = applyHookPreset(current.config.hookDesign, preset)
      const config = { ...current.config, hookDesign }
      setAdvanced(JSON.stringify(config, null, 2))
      return { ...current, config }
    })
  }

  const payload = useMemo(() => JSON.stringify({
    templateName: draft.templateName,
    templateKey: draft.templateKey,
    category: draft.category,
    description: draft.description,
    isActive: draft.isActive,
    isDefault: draft.isDefault,
    config: draft.config,
  }), [draft])

  function applyAdvanced() {
    try {
      const config = JSON.parse(advanced) as ShortsTemplateConfig
      setDraft(current => ({ ...current, config }))
      setJsonError('')
    } catch {
      setJsonError('JSON 형식을 확인해 주세요.')
    }
  }

  return (
    <form action={saveShortsTemplateAction} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <input type="hidden" name="id" value={draft.id} />
      <input type="hidden" name="payload" value={payload} />
      <div className="space-y-5">
        <Panel title="기본 정보">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="이름" value={draft.templateName} onChange={value => setDraft(v => ({ ...v, templateName: value }))} />
            <Text label="키" value={draft.templateKey} disabled={Boolean(draft.id)} onChange={value => setDraft(v => ({ ...v, templateKey: value }))} />
            <Text label="카테고리" value={draft.category} onChange={value => setDraft(v => ({ ...v, category: value }))} />
            <Text label="설명" value={draft.description ?? ''} onChange={value => setDraft(v => ({ ...v, description: value }))} />
          </div>
          <div className="mt-4 flex gap-5">
            <Check label="활성" checked={draft.isActive} onChange={value => setDraft(v => ({ ...v, isActive: value }))} />
            <Check label="기본 템플릿" checked={draft.isDefault} onChange={value => setDraft(v => ({ ...v, isDefault: value, isActive: value ? true : v.isActive }))} />
          </div>
        </Panel>

        <Panel title="레이아웃">
          <div className="grid gap-4 sm:grid-cols-3">
            <Check label="헤더 사용" checked={draft.config.layout.headerEnabled} onChange={v => updateConfig('layout', 'headerEnabled', v)} />
            <NumberField label="헤더 높이 %" value={draft.config.layout.headerHeight} onChange={v => updateConfig('layout', 'headerHeight', v)} />
            <NumberField label="영상 높이 %" value={draft.config.layout.videoAreaHeight} onChange={v => updateConfig('layout', 'videoAreaHeight', v)} />
            <Check label="푸터 사용" checked={draft.config.layout.footerEnabled} onChange={v => updateConfig('layout', 'footerEnabled', v)} />
            <NumberField label="푸터 높이 %" value={draft.config.layout.footerHeight} onChange={v => updateConfig('layout', 'footerHeight', v)} />
            <ColorField label="배경색" value={draft.config.layout.backgroundColor} onChange={v => updateConfig('layout', 'backgroundColor', v)} />
          </div>
        </Panel>

        <Panel title="헤더 및 자막">
          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField label="헤더 배경" value={draft.config.headerStyle.headerBackgroundColor} onChange={v => updateConfig('headerStyle', 'headerBackgroundColor', v)} />
            <ColorField label="헤더 글자" value={draft.config.headerStyle.headerTextColor} onChange={v => updateConfig('headerStyle', 'headerTextColor', v)} />
            <NumberField label="헤더 글자 크기" value={draft.config.headerStyle.headerFontSize} onChange={v => updateConfig('headerStyle', 'headerFontSize', v)} />
            <Select label="자막 위치" value={draft.config.captionStyle.captionPosition} options={['top', 'center', 'bottom']} onChange={v => updateConfig('captionStyle', 'captionPosition', v)} />
            <NumberField label="자막 크기" value={draft.config.captionStyle.captionFontSize} onChange={v => updateConfig('captionStyle', 'captionFontSize', v)} />
            <NumberField label="자막 굵기" value={draft.config.captionStyle.captionFontWeight} onChange={v => updateConfig('captionStyle', 'captionFontWeight', v)} />
            <ColorField label="자막색" value={draft.config.captionStyle.captionColor} onChange={v => updateConfig('captionStyle', 'captionColor', v)} />
            <ColorField label="외곽선색" value={draft.config.captionStyle.captionStrokeColor} onChange={v => updateConfig('captionStyle', 'captionStrokeColor', v)} />
            <NumberField label="최대 글자 수" value={draft.config.captionStyle.captionMaxCharacters} onChange={v => updateConfig('captionStyle', 'captionMaxCharacters', v)} />
          </div>
        </Panel>

        <Panel title="후킹 디자인">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([
              ['breaking_news', '뉴스'],
              ['drama_archive', '드라마'],
              ['knowledge_bold', '지식'],
              ['entertainment_feed', '예능'],
              ['anime_editorial', '애니'],
            ] as const).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectHookPreset(preset)}
                className={`rounded-lg border px-3 py-2 text-xs font-black ${draft.config.hookDesign.preset === preset ? 'border-[#111] bg-[#111] text-white' : 'bg-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="글꼴" value={draft.config.hookDesign.fontFamily} options={['Pretendard', 'Pretendard ExtraBold', 'Pretendard Black']} onChange={v => updateConfig('hookDesign', 'fontFamily', v)} />
            <NumberField label="글자 크기" value={draft.config.hookDesign.fontSize} onChange={v => updateConfig('hookDesign', 'fontSize', v)} />
            <NumberField label="글자 굵기" value={draft.config.hookDesign.fontWeight} step={100} onChange={v => updateConfig('hookDesign', 'fontWeight', v)} />
            <NumberField label="자간" value={draft.config.hookDesign.letterSpacing} onChange={v => updateConfig('hookDesign', 'letterSpacing', v)} />
            <NumberField label="행간" value={draft.config.hookDesign.lineHeight} step={0.02} onChange={v => updateConfig('hookDesign', 'lineHeight', v)} />
            <NumberField label="최대 줄 수" value={draft.config.hookDesign.maxLines} onChange={v => updateConfig('hookDesign', 'maxLines', v)} />
            <ColorField label="기본 글자색" value={draft.config.hookDesign.textColor} onChange={v => updateConfig('hookDesign', 'textColor', v)} />
            <ColorField label="강조색" value={draft.config.hookDesign.emphasisColor} onChange={v => updateConfig('hookDesign', 'emphasisColor', v)} />
            <ColorField label="배경색" value={draft.config.hookDesign.backgroundColor} onChange={v => updateConfig('hookDesign', 'backgroundColor', v)} />
            <Select label="배경 방식" value={draft.config.hookDesign.backgroundType} options={['solid', 'gradient', 'transparent']} onChange={v => updateConfig('hookDesign', 'backgroundType', v)} />
            <Select label="정렬" value={draft.config.hookDesign.textAlign} options={['left', 'center', 'right']} onChange={v => updateConfig('hookDesign', 'textAlign', v)} />
            <Check label="카테고리 배지" checked={draft.config.hookDesign.categoryBadgeEnabled} onChange={v => updateConfig('hookDesign', 'categoryBadgeEnabled', v)} />
            <Check label="프로필 헤더" checked={draft.config.hookDesign.profileHeaderEnabled} onChange={v => updateConfig('hookDesign', 'profileHeaderEnabled', v)} />
            <Check label="외곽선" checked={draft.config.hookDesign.strokeEnabled} onChange={v => updateConfig('hookDesign', 'strokeEnabled', v)} />
            <Check label="그림자" checked={draft.config.hookDesign.shadowEnabled} onChange={v => updateConfig('hookDesign', 'shadowEnabled', v)} />
          </div>
        </Panel>

        <Panel title="영상 및 CTA">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="전체 길이" value={draft.config.videoRules.totalDuration} onChange={v => updateConfig('videoRules', 'totalDuration', v)} />
            <NumberField label="최소 장면 길이" value={draft.config.videoRules.sceneDurationMin} step={0.5} onChange={v => updateConfig('videoRules', 'sceneDurationMin', v)} />
            <NumberField label="최대 장면 길이" value={draft.config.videoRules.sceneDurationMax} step={0.5} onChange={v => updateConfig('videoRules', 'sceneDurationMax', v)} />
            <Select label="전환" value={draft.config.videoRules.transitionType} options={['cut', 'fade', 'slide', 'zoom']} onChange={v => updateConfig('videoRules', 'transitionType', v)} />
            <Select label="줌" value={draft.config.videoRules.zoomEffect} options={['none', 'slow_zoom', 'zoom_in', 'zoom_out']} onChange={v => updateConfig('videoRules', 'zoomEffect', v)} />
            <Check label="CTA 사용" checked={draft.config.cta.ctaEnabled} onChange={v => updateConfig('cta', 'ctaEnabled', v)} />
            <Text label="CTA 문구" value={draft.config.cta.ctaText} onChange={v => updateConfig('cta', 'ctaText', v)} />
            <NumberField label="CTA 길이" value={draft.config.cta.ctaDuration} step={0.5} onChange={v => updateConfig('cta', 'ctaDuration', v)} />
            <NumberField label="최소 신뢰도" value={draft.config.aiMatching.minimumConfidenceScore} step={0.05} onChange={v => updateConfig('aiMatching', 'minimumConfidenceScore', v)} />
          </div>
        </Panel>

        <Panel title="고급 설정 JSON">
          <textarea value={advanced} onChange={e => setAdvanced(e.target.value)} className="h-80 w-full rounded-lg border p-3 font-mono text-xs" spellCheck={false} />
          <div className="mt-2 flex items-center gap-3"><button type="button" onClick={applyAdvanced} className="rounded-lg border px-3 py-2 text-xs font-bold">JSON 적용</button>{jsonError && <span className="text-xs text-red-600">{jsonError}</span>}</div>
        </Panel>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Panel title="9:16 미리보기"><div className="flex justify-center"><ShortsTemplatePreview template={draft} /></div></Panel>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-[#111] px-4 py-3 text-sm font-black text-white">저장</button>
          <Link href="/admin/youtube-shorts-templates" className="rounded-lg border px-4 py-3 text-sm font-bold">취소</Link>
        </div>
      </aside>
    </form>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-[#e8e8e8] bg-white p-5"><h2 className="mb-4 text-sm font-black">{title}</h2>{children}</section>
}
function Text({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return <label className="text-xs font-bold text-[#666]">{label}<input value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-[#f4f4f4]" /></label>
}
function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return <label className="text-xs font-bold text-[#666]">{label}<input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm" /></label>
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="text-xs font-bold text-[#666]">{label}<div className="mt-1.5 flex rounded-lg border p-1"><input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-8 w-10" /><input value={value} onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 px-2 text-xs" /></div></label>
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-xs font-bold text-[#555]"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <label className="text-xs font-bold text-[#666]">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2 text-sm">{options.map(option => <option key={option}>{option}</option>)}</select></label>
}
