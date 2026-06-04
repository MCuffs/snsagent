'use client'

import { useState } from 'react'
import { Eye, EyeOff, ImageIcon, Layers, Redo2, Save, Sparkles, Trash2, Type, Undo2, Upload } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialDocument, EditorialLayer, FontPreset, OverlayPreset } from '../../../../../src/lib/editor/types'

type EditorTab = 'text' | 'background' | 'overlay' | 'image'

interface Props {
  slideId: string
  busy: boolean
  onSave: (render: boolean) => void
  onUpload: () => void
  onImageUpload: () => void
}

export function EditorialInspector({ slideId, busy, onSave, onUpload, onImageUpload }: Props) {
  const document = useEditorialStore(state => state.documents[slideId])
  const dirty = useEditorialStore(state => state.dirtySlides[slideId])
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const updateDocument = useEditorialStore(state => state.updateDocument)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const undo = useEditorialStore(state => state.undo)
  const redo = useEditorialStore(state => state.redo)
  const [tab, setTab] = useState<EditorTab>('text')
  const [copyTarget, setCopyTarget] = useState<'title' | 'subtitle'>('title')

  if (!document) return null
  const copyLayer = document.layers.find(item => item.type === copyTarget)!

  return (
    <div className="rounded-[12px] border border-[#e8dfd4] bg-white shadow-[0_24px_70px_rgba(31,21,18,0.07)]">
      <header className="border-b border-[#f0e8de] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Editorial Editor</p>
            <h2 className="mt-1 text-lg font-black tracking-[-0.04em]">카드 디자인 편집</h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {dirty ? '저장 중' : '저장됨'}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <IconButton label="실행 취소" onClick={() => undo(slideId)}><Undo2 className="h-4 w-4" /></IconButton>
          <IconButton label="다시 실행" onClick={() => redo(slideId)}><Redo2 className="h-4 w-4" /></IconButton>
          <button type="button" disabled={busy} onClick={() => onSave(true)} className="btn-primary ml-auto min-h-10 rounded-md px-4 text-xs">
            <Save className="h-3.5 w-3.5" /> 결과에 적용
          </button>
        </div>
      </header>

      <nav className="grid grid-cols-4 border-b border-[#f0e8de] p-2">
        <TabButton active={tab === 'text'} onClick={() => setTab('text')} icon={<Type className="h-4 w-4" />} label="글자" />
        <TabButton active={tab === 'background'} onClick={() => setTab('background')} icon={<ImageIcon className="h-4 w-4" />} label="배경" />
        <TabButton active={tab === 'overlay'} onClick={() => setTab('overlay')} icon={<Sparkles className="h-4 w-4" />} label="오버레이" />
        <TabButton active={tab === 'image'} onClick={() => setTab('image')} icon={<Layers className="h-4 w-4" />} label="이미지" />
      </nav>

      <div className="p-4">
        {tab === 'text' && (
          <TextPanel
            layer={copyLayer}
            target={copyTarget}
            onTarget={value => { setCopyTarget(value); selectLayer(value) }}
            onChange={update => updateLayer(slideId, copyLayer.id, update)}
          />
        )}
        {tab === 'background' && (
          <BackgroundPanel
            busy={busy}
            onUpload={onUpload}
          />
        )}
        {tab === 'overlay' && (
          <OverlayPanel
            document={document}
            onOverlay={preset => updateDocument(slideId, value => applyOverlayPreset(value, preset))}
            onOverlayValue={(key, value) => updateDocument(slideId, current => ({ ...current, overlay: { ...current.overlay, [key]: value } }))}
          />
        )}
        {tab === 'image' && (
          <ImagePanel slideId={slideId} document={document} busy={busy} onUpload={onImageUpload} />
        )}
      </div>
    </div>
  )
}

function TextPanel({
  layer,
  target,
  onTarget,
  onChange,
}: {
  layer: EditorialLayer
  target: 'title' | 'subtitle'
  onTarget: (target: 'title' | 'subtitle') => void
  onChange: (update: Partial<EditorialLayer>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-[#f7f4ef] p-1">
        <Segment active={target === 'title'} onClick={() => onTarget('title')}>제목</Segment>
        <Segment active={target === 'subtitle'} onClick={() => onTarget('subtitle')}>본문</Segment>
      </div>
      <textarea
        value={layer.text || ''}
        onChange={event => onChange({ text: event.target.value })}
        rows={target === 'title' ? 2 : 3}
        className="field w-full resize-none p-3 text-sm leading-6"
        placeholder={target === 'title' ? '헤드라인을 입력하세요' : '본문을 입력하세요'}
      />
      <div className="grid grid-cols-[1fr_86px_44px] gap-2">
        <select value={layer.fontPreset} onChange={event => onChange({ fontPreset: event.target.value as FontPreset })} className="field h-11 px-3 text-xs font-bold">
          <option value="pretendard">Pretendard</option>
          <option value="suit">SUIT</option>
          <option value="noto-sans">Noto Sans KR</option>
          <option value="serif">Editorial Serif</option>
          <option value="magazine">Magazine</option>
        </select>
        <input type="number" aria-label="글자 크기" value={layer.fontSize || 24} min={10} max={180} onChange={event => onChange({ fontSize: Number(event.target.value) })} className="field h-11 px-3 text-xs font-bold" />
        <input type="color" aria-label="텍스트 색상" value={layer.color || '#ffffff'} onChange={event => onChange({ color: event.target.value })} className="field h-11 w-11 cursor-pointer p-1" />
      </div>
    </div>
  )
}

function OverlayPanel({
  document,
  onOverlay,
  onOverlayValue,
}: {
  document: EditorialDocument
  onOverlay: (preset: OverlayPreset) => void
  onOverlayValue: (key: 'darkness' | 'vignette' | 'contrast', value: number) => void
}) {
  return (
    <div className="space-y-5">
      <OptionGroup title="오버레이 무드">
        {([
          ['netflix-dark', '딥 다크'], ['luxury-editorial', '에디토리얼'], ['dreamy', '소프트'], ['modern-korean-media', '모던 미디어'],
        ] as const).map(([key, label]) => (
          <Choice key={key} active={document.overlay.preset === key} onClick={() => onOverlay(key)}>{label}</Choice>
        ))}
      </OptionGroup>
      <div className="space-y-4 border-t border-[#f0e8de] pt-4">
        <RangeControl label="어둡기" value={document.overlay.darkness} min={0} max={100} onChange={value => onOverlayValue('darkness', value)} />
        <RangeControl label="비네팅" value={document.overlay.vignette} min={0} max={100} onChange={value => onOverlayValue('vignette', value)} />
        <RangeControl label="대비" value={document.overlay.contrast} min={50} max={160} onChange={value => onOverlayValue('contrast', value)} />
      </div>
    </div>
  )
}

function BackgroundPanel({
  busy,
  onUpload,
}: {
  busy: boolean
  onUpload: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#f5f8ff] p-3 text-xs leading-5 text-[#4c6070] space-y-1.5">
        <p>글자와 레이아웃은 그대로 두고 배경 이미지만 직접 교체합니다.</p>
        <p className="text-[10px] text-[#717b8f] font-semibold">※ 배경 이미지는 텍스트 없이 생성되고, 문구는 편집 가능한 레이어로만 올라갑니다.</p>
      </div>
      <button type="button" disabled={busy} onClick={onUpload} className="btn-primary w-full rounded-md">
        <Upload className="h-4 w-4" /> 내 이미지로 교체
      </button>
    </div>
  )
}

function ImagePanel({ slideId, document, busy, onUpload }: { slideId: string; document: EditorialDocument; busy: boolean; onUpload: () => void }) {
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const removeLayer = useEditorialStore(state => state.removeLayer)
  const imageLayers = document.layers.filter(l => l.type === 'sticker' && l.id !== 'sticker' && l.imageUrl)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#f5f8ff] p-3 text-xs leading-5 text-[#4c6070]">
        <p>이미지를 레이어로 추가합니다. 캔버스에서 드래그해 위치를 조정할 수 있습니다.</p>
      </div>
      <button type="button" disabled={busy} onClick={onUpload} className="btn-primary w-full rounded-md">
        <Upload className="h-4 w-4" /> 이미지 추가
      </button>
      {imageLayers.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-[#746a62]">추가된 이미지 레이어</p>
          {imageLayers.map(layer => (
            <div key={layer.id} className="rounded-lg border border-[#e8dfd4] p-3 space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={layer.imageUrl!} alt="" className="h-12 w-12 flex-shrink-0 rounded object-cover border border-[#e8dfd4]" />
                <p className="flex-1 min-w-0 truncate text-xs font-bold text-[#1f1512]">{layer.name}</p>
                <button
                  type="button"
                  aria-label={layer.visible ? '레이어 숨기기' : '레이어 표시'}
                  onClick={() => updateLayer(slideId, layer.id, { visible: !layer.visible })}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff]"
                >
                  {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label="레이어 삭제"
                  onClick={() => removeLayer(slideId, layer.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <RangeControl label="불투명도" value={layer.opacity} min={0} max={100} onChange={value => updateLayer(slideId, layer.id, { opacity: value })} />
              <div className="grid grid-cols-2 gap-2">
                <NumberControl label="X" value={layer.x} min={0} max={1080} onChange={value => updateLayer(slideId, layer.id, { x: value })} />
                <NumberControl label="Y" value={layer.y} min={0} max={1350} onChange={value => updateLayer(slideId, layer.id, { y: value })} />
                <NumberControl label="가로" value={layer.width} min={16} max={1080} onChange={value => updateLayer(slideId, layer.id, { width: value })} />
                <NumberControl label="세로" value={layer.height} min={16} max={1350} onChange={value => updateLayer(slideId, layer.id, { height: value })} />
              </div>
              <RangeControl label="크기" value={Math.round(layer.scale * 100)} min={25} max={400} onChange={value => updateLayer(slideId, layer.id, { scale: value / 100 })} />
              <RangeControl label="회전" value={layer.rotation} min={-180} max={180} onChange={value => updateLayer(slideId, layer.id, { rotation: value })} />
              <RangeControl label="모서리 라운드" value={layer.borderRadius ?? 0} min={0} max={50} onChange={value => updateLayer(slideId, layer.id, { borderRadius: value })} />
              <RangeControl label="외곽 페이드" value={layer.edgeFade ?? 0} min={0} max={80} onChange={value => updateLayer(slideId, layer.id, { edgeFade: value })} />
            </div>
          ))}
        </div>
      )}
      {imageLayers.length === 0 && (
        <p className="py-4 text-center text-xs text-[#9a8d82]">추가된 이미지가 없습니다</p>
      )}
    </div>
  )
}

function applyOverlayPreset(document: EditorialDocument, preset: OverlayPreset) {
  const settings: Record<OverlayPreset, Partial<typeof document.overlay>> = {
    'netflix-dark': { darkness: 100, vignette: 55, contrast: 112, grain: 10, colorFilter: '#170e10' },
    'luxury-editorial': { darkness: 100, vignette: 30, contrast: 104, grain: 6, colorFilter: '#2b241e' },
    noir: { darkness: 100, vignette: 70, contrast: 126, grain: 22, colorFilter: '#090909' },
    dreamy: { darkness: 100, vignette: 18, contrast: 92, grain: 4, glow: 28, bloom: 25, colorFilter: '#493b58' },
    'instagram-magazine': { darkness: 100, vignette: 26, contrast: 106, grain: 12, colorFilter: '#342326' },
    'modern-korean-media': { darkness: 100, vignette: 34, contrast: 112, grain: 8, colorFilter: '#121b27' },
  }
  return { ...document, overlay: { ...document.overlay, ...settings[preset], preset } }
}

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold ${active ? 'bg-[#0066ff]/8 text-[#0066ff]' : 'text-[#746a62] hover:bg-[#faf8f4]'}`}>{icon}{label}</button>
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`flex-1 rounded-md py-2 text-xs font-bold ${active ? 'bg-white text-[#111318] shadow-sm' : 'text-[#746a62]'}`}>{children}</button>
}

function OptionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-2 text-xs font-bold text-[#746a62]">{title}</p><div className="grid grid-cols-2 gap-2">{children}</div></div>
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-3 text-left text-xs font-bold ${active ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff]' : 'border-[#e8dfd4] text-[#514a44]'}`}>{children}</button>
}

function RangeControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs font-bold text-[#514a44]"><span className="mb-2 flex justify-between"><span>{label}</span><span className="text-[#746a62]">{value}</span></span><input type="range" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} className="w-full accent-[#0066ff]" /></label>
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-bold text-[#514a44]">
      <span className="mb-1 block text-[#746a62]">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        min={min}
        max={max}
        onChange={event => onChange(Number(event.target.value))}
        className="field h-9 w-full px-2 text-xs font-bold"
      />
    </label>
  )
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff]">{children}</button>
}
