'use client'

import { useState } from 'react'
import { Eye, EyeOff, Layers3, MoveDown, MoveUp, Redo2, Save, Sparkles, Undo2, Upload } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialDocument, FontPreset, OverlayPreset, TypographyPreset } from '../../../../../src/lib/editor/types'

interface Props {
  slideId: string
  busy: boolean
  credits: number
  onSave: (render: boolean) => void
  onBackgroundVariation: (type: 'same-style' | 'stronger-mood' | 'brighter-background') => void
  onRewrite: (intent: string) => void
  onUpload: () => void
}

export function EditorialInspector({ slideId, busy, credits, onSave, onBackgroundVariation, onRewrite, onUpload }: Props) {
  const document = useEditorialStore(state => state.documents[slideId])
  const selectedId = useEditorialStore(state => state.selectedLayerId)
  const dirty = useEditorialStore(state => state.dirtySlides[slideId])
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const updateDocument = useEditorialStore(state => state.updateDocument)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const reorder = useEditorialStore(state => state.reorderLayer)
  const undo = useEditorialStore(state => state.undo)
  const redo = useEditorialStore(state => state.redo)
  const [prompt, setPrompt] = useState('')

  if (!document) return null
  const layer = document.layers.find(item => item.id === selectedId) || document.layers[0]
  const textLayer = ['title', 'subtitle', 'cta', 'watermark', 'sticker'].includes(layer.type)

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow">Canvas Editor</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">레이어</h2>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {dirty ? '자동 저장 대기' : '저장됨'}
          </span>
        </div>
        <div className="mb-4 flex gap-2">
          <TinyButton onClick={() => undo(slideId)}><Undo2 className="h-3.5 w-3.5" />Undo</TinyButton>
          <TinyButton onClick={() => redo(slideId)}><Redo2 className="h-3.5 w-3.5" />Redo</TinyButton>
          <TinyButton onClick={() => onSave(true)} disabled={busy}><Save className="h-3.5 w-3.5" />확정 렌더</TinyButton>
        </div>
        <div className="space-y-1.5">
          {[...document.layers].sort((a, b) => b.zIndex - a.zIndex).map(item => (
            <button
              type="button"
              key={item.id}
              onClick={() => selectLayer(item.id)}
              className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-bold ${item.id === layer.id ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff]' : 'border-[#eee] text-[#514a44]'}`}
            >
              <Layers3 className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">{item.name}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={event => { event.stopPropagation(); updateLayer(slideId, item.id, { visible: !item.visible }) }}
              >
                {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-40" />}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <p className="eyebrow">Inspector / {layer.name}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberControl label="X" value={layer.x} onChange={x => updateLayer(slideId, layer.id, { x })} min={0} max={1080} />
          <NumberControl label="Y" value={layer.y} onChange={y => updateLayer(slideId, layer.id, { y })} min={0} max={1350} />
          <NumberControl label="너비" value={layer.width} onChange={width => updateLayer(slideId, layer.id, { width })} min={16} max={1080} />
          <NumberControl label="불투명도" value={layer.opacity} onChange={opacity => updateLayer(slideId, layer.id, { opacity })} min={0} max={100} />
          <NumberControl label="스케일 %" value={Math.round(layer.scale * 100)} onChange={scale => updateLayer(slideId, layer.id, { scale: scale / 100 })} min={25} max={300} />
          <NumberControl label="블러" value={layer.blur} onChange={blur => updateLayer(slideId, layer.id, { blur })} min={0} max={40} />
        </div>
        <div className="mt-3 flex gap-2">
          <TinyButton onClick={() => reorder(slideId, layer.id, 1)}><MoveUp className="h-3 w-3" />앞으로</TinyButton>
          <TinyButton onClick={() => reorder(slideId, layer.id, -1)}><MoveDown className="h-3 w-3" />뒤로</TinyButton>
        </div>
        {textLayer && (
          <div className="mt-4 space-y-3 border-t border-[#eee] pt-4">
            <textarea value={layer.text || ''} onChange={event => updateLayer(slideId, layer.id, { text: event.target.value })} rows={2} className="field w-full resize-none p-2 text-sm" />
            <select value={layer.fontPreset} onChange={event => updateLayer(slideId, layer.id, { fontPreset: event.target.value as FontPreset })} className="field h-10 w-full px-2 text-xs font-bold">
              <option value="pretendard">Pretendard</option><option value="suit">SUIT</option><option value="noto-sans">Noto Sans KR</option><option value="serif">Editorial Serif</option><option value="magazine">Magazine Headline</option>
            </select>
            <div className="grid grid-cols-3 gap-2">
              <NumberControl label="크기" value={layer.fontSize || 24} onChange={fontSize => updateLayer(slideId, layer.id, { fontSize })} min={10} max={180} />
              <NumberControl label="굵기" value={layer.fontWeight || 400} onChange={fontWeight => updateLayer(slideId, layer.id, { fontWeight })} min={100} max={900} />
              <NumberControl label="자간" value={layer.tracking || 0} onChange={tracking => updateLayer(slideId, layer.id, { tracking })} min={-8} max={30} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberControl label="행간 %" value={Math.round((layer.lineHeight || 1.2) * 100)} onChange={lineHeight => updateLayer(slideId, layer.id, { lineHeight: lineHeight / 100 })} min={80} max={240} />
              <NumberControl label="외곽선" value={layer.stroke || 0} onChange={stroke => updateLayer(slideId, layer.id, { stroke })} min={0} max={12} />
              <NumberControl label="회전" value={layer.rotation} onChange={rotation => updateLayer(slideId, layer.id, { rotation })} min={-180} max={180} />
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-[#514a44]">
              색상 <input type="color" value={layer.color || '#ffffff'} onChange={event => updateLayer(slideId, layer.id, { color: event.target.value })} className="h-8 w-10" />
              <NumberControl label="그림자" value={layer.shadow} onChange={shadow => updateLayer(slideId, layer.id, { shadow })} min={0} max={60} />
            </div>
            <select
              value={layer.animation?.type || 'none'}
              onChange={event => updateLayer(slideId, layer.id, { animation: { ...layer.animation!, type: event.target.value as 'none' | 'fade' | 'rise' | 'scale' } })}
              className="field h-10 w-full px-2 text-xs font-bold"
            >
              <option value="none">Motion metadata: None</option><option value="fade">Fade</option><option value="rise">Rise</option><option value="scale">Scale</option>
            </select>
          </div>
        )}
      </Panel>

      <Panel>
        <p className="eyebrow">Editorial Presets</p>
        <select
          value={document.typographyPreset}
          onChange={event => updateDocument(slideId, current => applyTypographyPreset(current, event.target.value as TypographyPreset))}
          className="field mt-3 h-11 w-full px-3 text-xs font-bold"
        >
          {['cinematic-headline', 'breaking-news', 'magazine-editorial', 'minimal-luxury', 'dark-social', 'emotional-storytelling', 'high-ctr-hook'].map(preset => <option key={preset}>{preset}</option>)}
        </select>
        <select
          value={document.overlay.preset}
          onChange={event => updateDocument(slideId, current => applyOverlayPreset(current, event.target.value as OverlayPreset))}
          className="field mt-2 h-11 w-full px-3 text-xs font-bold"
        >
          {['netflix-dark', 'luxury-editorial', 'noir', 'dreamy', 'instagram-magazine', 'modern-korean-media'].map(preset => <option key={preset}>{preset}</option>)}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberControl label="Darkness" value={document.overlay.darkness} onChange={darkness => updateDocument(slideId, d => ({ ...d, overlay: { ...d.overlay, darkness } }))} min={0} max={100} />
          <NumberControl label="Vignette" value={document.overlay.vignette} onChange={vignette => updateDocument(slideId, d => ({ ...d, overlay: { ...d.overlay, vignette } }))} min={0} max={100} />
          <NumberControl label="Contrast" value={document.overlay.contrast} onChange={contrast => updateDocument(slideId, d => ({ ...d, overlay: { ...d.overlay, contrast } }))} min={50} max={160} />
          <NumberControl label="Grain" value={document.overlay.grain} onChange={grain => updateDocument(slideId, d => ({ ...d, overlay: { ...d.overlay, grain } }))} min={0} max={100} />
        </div>
      </Panel>

      <Panel>
        <p className="eyebrow">AI Assist / Layers Only</p>
        <p className="my-3 text-xs leading-5 text-[#746a62]">구조와 타이포그래피는 유지하고 필요한 레이어만 변경합니다. 배경 생성 잔여 {credits}장.</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['stronger-hook', '더 강한 훅'], ['emotional', '더 감성적'], ['premium', '더 프리미엄'], ['shorter', '더 짧게'],
            ['trendy', '트렌디'], ['gen-z', 'Gen Z'],
          ].map(([intent, label]) => (
            <TinyButton key={intent} onClick={() => onRewrite(intent)} disabled={busy}><Sparkles className="h-3 w-3" />{label}</TinyButton>
          ))}
        </div>
        <div className="mt-4 rounded-md border border-[#e8dfd4] p-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#746a62]">대화형 편집 요청</label>
          <textarea
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            placeholder="예: 슬라이드 2를 더 밝고 매거진처럼 만들어줘"
            rows={2}
            className="mt-2 w-full resize-none bg-transparent text-xs outline-none"
          />
          <button type="button" disabled={busy || !prompt.trim()} onClick={() => { onRewrite(prompt.trim()); setPrompt('') }} className="btn-primary mt-2 min-h-9 w-full rounded-md text-xs">
            요청 적용
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <button type="button" disabled={busy || credits < 1} onClick={() => onBackgroundVariation('same-style')} className="btn-secondary w-full rounded-md text-xs">같은 스타일, 다른 이미지</button>
          <button type="button" disabled={busy || credits < 1} onClick={() => onBackgroundVariation('stronger-mood')} className="btn-secondary w-full rounded-md text-xs">같은 레이아웃, 강한 무드</button>
          <button type="button" disabled={busy || credits < 1} onClick={() => onBackgroundVariation('brighter-background')} className="btn-secondary w-full rounded-md text-xs">같은 구조, 밝은 배경</button>
          <button type="button" disabled={busy} onClick={onUpload} className="btn-secondary w-full rounded-md text-xs"><Upload className="h-3.5 w-3.5" />내 배경 업로드</button>
        </div>
      </Panel>
    </div>
  )
}

function applyTypographyPreset(document: EditorialDocument, preset: TypographyPreset) {
  const styles: Record<TypographyPreset, { title: Partial<{ fontPreset: FontPreset; fontSize: number; fontWeight: number; tracking: number; lineHeight: number }>; subtitle: Partial<{ fontSize: number; tracking: number }> }> = {
    'cinematic-headline': { title: { fontPreset: 'pretendard', fontSize: 72, fontWeight: 800, tracking: -2, lineHeight: 1.06 }, subtitle: { fontSize: 27, tracking: 0 } },
    'breaking-news': { title: { fontPreset: 'suit', fontSize: 78, fontWeight: 900, tracking: -3, lineHeight: 1 }, subtitle: { fontSize: 25, tracking: 1 } },
    'magazine-editorial': { title: { fontPreset: 'magazine', fontSize: 76, fontWeight: 700, tracking: -1, lineHeight: 1.12 }, subtitle: { fontSize: 26, tracking: 0 } },
    'minimal-luxury': { title: { fontPreset: 'serif', fontSize: 62, fontWeight: 600, tracking: 1, lineHeight: 1.18 }, subtitle: { fontSize: 23, tracking: 2 } },
    'dark-social': { title: { fontPreset: 'pretendard', fontSize: 70, fontWeight: 850, tracking: -2, lineHeight: 1.05 }, subtitle: { fontSize: 28, tracking: 0 } },
    'emotional-storytelling': { title: { fontPreset: 'serif', fontSize: 67, fontWeight: 650, tracking: 0, lineHeight: 1.15 }, subtitle: { fontSize: 27, tracking: 0 } },
    'high-ctr-hook': { title: { fontPreset: 'suit', fontSize: 84, fontWeight: 900, tracking: -3, lineHeight: 0.98 }, subtitle: { fontSize: 26, tracking: 0 } },
  }
  const style = styles[preset]
  return {
    ...document,
    typographyPreset: preset,
    layers: document.layers.map(layer => layer.type === 'title' ? { ...layer, ...style.title } : layer.type === 'subtitle' ? { ...layer, ...style.subtitle } : layer),
  }
}

function applyOverlayPreset(document: EditorialDocument, preset: OverlayPreset) {
  const settings: Record<OverlayPreset, Partial<typeof document.overlay>> = {
    'netflix-dark': { darkness: 60, vignette: 55, contrast: 112, grain: 10, colorFilter: '#170e10' },
    'luxury-editorial': { darkness: 38, vignette: 30, contrast: 104, grain: 6, colorFilter: '#2b241e' },
    noir: { darkness: 72, vignette: 70, contrast: 126, grain: 22, colorFilter: '#090909' },
    dreamy: { darkness: 22, vignette: 18, contrast: 92, grain: 4, glow: 28, bloom: 25, colorFilter: '#493b58' },
    'instagram-magazine': { darkness: 34, vignette: 26, contrast: 106, grain: 12, colorFilter: '#342326' },
    'modern-korean-media': { darkness: 48, vignette: 34, contrast: 112, grain: 8, colorFilter: '#121b27' },
  }
  return { ...document, overlay: { ...document.overlay, ...settings[preset], preset } }
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[10px] border border-[#e8dfd4] bg-white p-5 shadow-[0_24px_70px_rgba(31,21,18,0.07)]">{children}</div>
}

function TinyButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#e8dfd4] px-2 py-2 text-[11px] font-bold text-[#514a44] hover:border-[#0066ff] disabled:opacity-40">{children}</button>
}

function NumberControl({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-wide text-[#746a62]">
      {label}
      <input type="number" value={Math.round(value)} min={min} max={max} onChange={event => onChange(Number(event.target.value))} className="field mt-1 h-9 w-full px-2 text-xs text-[#1f1512]" />
    </label>
  )
}
