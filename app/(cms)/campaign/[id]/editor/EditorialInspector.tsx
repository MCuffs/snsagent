'use client'

import { useState } from 'react'
import { Eye, EyeOff, ImageIcon, Layers3, MoveDown, MoveUp, Redo2, Save, Sparkles, Type, Undo2, Upload } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialDocument, EditorialLayer, FontPreset, OverlayPreset, TypographyPreset } from '../../../../../src/lib/editor/types'

type EditorTab = 'copy' | 'style' | 'background' | 'advanced'

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
  const [tab, setTab] = useState<EditorTab>('copy')
  const [copyTarget, setCopyTarget] = useState<'title' | 'subtitle'>('title')
  const [prompt, setPrompt] = useState('')

  if (!document) return null
  const selectedLayer = document.layers.find(item => item.id === selectedId) || document.layers[0]
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
        <TabButton active={tab === 'copy'} onClick={() => setTab('copy')} icon={<Type className="h-4 w-4" />} label="문구" />
        <TabButton active={tab === 'style'} onClick={() => setTab('style')} icon={<Sparkles className="h-4 w-4" />} label="스타일" />
        <TabButton active={tab === 'background'} onClick={() => setTab('background')} icon={<ImageIcon className="h-4 w-4" />} label="배경" />
        <TabButton active={tab === 'advanced'} onClick={() => setTab('advanced')} icon={<Layers3 className="h-4 w-4" />} label="고급" />
      </nav>

      <div className="p-4">
        {tab === 'copy' && (
          <CopyPanel
            layer={copyLayer}
            target={copyTarget}
            busy={busy}
            prompt={prompt}
            onTarget={value => { setCopyTarget(value); selectLayer(value) }}
            onChange={update => updateLayer(slideId, copyLayer.id, update)}
            onRewrite={onRewrite}
            onPrompt={setPrompt}
          />
        )}
        {tab === 'style' && (
          <StylePanel
            document={document}
            onTypography={preset => updateDocument(slideId, value => applyTypographyPreset(value, preset))}
            onOverlay={preset => updateDocument(slideId, value => applyOverlayPreset(value, preset))}
            onOverlayValue={(key, value) => updateDocument(slideId, current => ({ ...current, overlay: { ...current.overlay, [key]: value } }))}
          />
        )}
        {tab === 'background' && (
          <BackgroundPanel busy={busy} credits={credits} onUpload={onUpload} onVariation={onBackgroundVariation} />
        )}
        {tab === 'advanced' && (
          <AdvancedPanel
            document={document}
            layer={selectedLayer}
            slideId={slideId}
            onSelect={selectLayer}
            onLayer={updateLayer}
            onReorder={reorder}
          />
        )}
      </div>
    </div>
  )
}

function CopyPanel({
  layer,
  target,
  busy,
  prompt,
  onTarget,
  onChange,
  onRewrite,
  onPrompt,
}: {
  layer: EditorialLayer
  target: 'title' | 'subtitle'
  busy: boolean
  prompt: string
  onTarget: (target: 'title' | 'subtitle') => void
  onChange: (update: Partial<EditorialLayer>) => void
  onRewrite: (intent: string) => void
  onPrompt: (value: string) => void
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
      <p className="text-xs font-bold text-[#746a62]">AI 문구 다듬기</p>
      <div className="flex flex-wrap gap-2">
        {[
          ['stronger-hook', '강한 훅'], ['emotional', '감성적'], ['premium', '프리미엄'], ['shorter', '짧게'], ['trendy', '트렌디'],
        ].map(([intent, label]) => (
          <button type="button" key={intent} disabled={busy} onClick={() => onRewrite(intent)} className="rounded-full border border-[#e8dfd4] px-3 py-2 text-xs font-bold text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff] disabled:opacity-40">
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-[#e8dfd4] bg-[#fffdf9] p-3">
        <input
          value={prompt}
          onChange={event => onPrompt(event.target.value)}
          placeholder="예: 더 고급스럽고 짧게 바꿔줘"
          className="w-full bg-transparent text-xs outline-none"
        />
        <button type="button" disabled={busy || !prompt.trim()} onClick={() => { onRewrite(prompt.trim()); onPrompt('') }} className="mt-3 w-full rounded-md bg-[#111318] py-2 text-xs font-bold text-white disabled:opacity-40">
          AI에게 요청
        </button>
      </div>
    </div>
  )
}

function StylePanel({
  document,
  onTypography,
  onOverlay,
  onOverlayValue,
}: {
  document: EditorialDocument
  onTypography: (preset: TypographyPreset) => void
  onOverlay: (preset: OverlayPreset) => void
  onOverlayValue: (key: 'darkness' | 'vignette' | 'contrast', value: number) => void
}) {
  return (
    <div className="space-y-5">
      <OptionGroup title="타이포그래피 분위기">
        {([
          ['cinematic-headline', '시네마틱'], ['magazine-editorial', '매거진'], ['minimal-luxury', '럭셔리'], ['high-ctr-hook', '강한 훅'],
        ] as const).map(([key, label]) => (
          <Choice key={key} active={document.typographyPreset === key} onClick={() => onTypography(key)}>{label}</Choice>
        ))}
      </OptionGroup>
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

function BackgroundPanel({ busy, credits, onUpload, onVariation }: { busy: boolean; credits: number; onUpload: () => void; onVariation: Props['onBackgroundVariation'] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#f5f8ff] p-3 text-xs leading-5 text-[#4c6070]">
        글자와 레이아웃은 그대로 두고 배경만 바꿉니다. AI 배경 생성 가능 횟수: <strong>{credits}장</strong>
      </div>
      <button type="button" disabled={busy} onClick={onUpload} className="btn-primary w-full rounded-md">
        <Upload className="h-4 w-4" /> 내 이미지로 교체
      </button>
      <p className="pt-2 text-xs font-bold text-[#746a62]">AI 배경 변형</p>
      <button type="button" disabled={busy || credits < 1} onClick={() => onVariation('same-style')} className="btn-secondary w-full rounded-md text-sm">같은 분위기, 다른 이미지</button>
      <button type="button" disabled={busy || credits < 1} onClick={() => onVariation('stronger-mood')} className="btn-secondary w-full rounded-md text-sm">더 깊은 시네마틱 무드</button>
      <button type="button" disabled={busy || credits < 1} onClick={() => onVariation('brighter-background')} className="btn-secondary w-full rounded-md text-sm">더 밝고 깨끗한 배경</button>
    </div>
  )
}

function AdvancedPanel({
  document,
  layer,
  slideId,
  onSelect,
  onLayer,
  onReorder,
}: {
  document: EditorialDocument
  layer: EditorialLayer
  slideId: string
  onSelect: (id: string) => void
  onLayer: (slideId: string, id: string, update: Partial<EditorialLayer>) => void
  onReorder: (slideId: string, id: string, direction: -1 | 1) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs leading-5 text-[#746a62]">레이어 배치와 세부 효과가 필요할 때만 사용하세요.</p>
      <div className="space-y-1.5">
        {[...document.layers].sort((a, b) => b.zIndex - a.zIndex).map(item => (
          <button type="button" key={item.id} onClick={() => onSelect(item.id)} className={`flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-xs font-bold ${item.id === layer.id ? 'border-[#0066ff] bg-[#0066ff]/5 text-[#0066ff]' : 'border-[#eee] text-[#514a44]'}`}>
            <Layers3 className="h-3.5 w-3.5" /><span className="flex-1 text-left">{item.name}</span>
            <span role="button" tabIndex={0} onClick={event => { event.stopPropagation(); onLayer(slideId, item.id, { visible: !item.visible }) }}>
              {item.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-40" />}
            </span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-[#f0e8de] pt-4">
        <NumberControl label="X" value={layer.x} min={0} max={1080} onChange={value => onLayer(slideId, layer.id, { x: value })} />
        <NumberControl label="Y" value={layer.y} min={0} max={1350} onChange={value => onLayer(slideId, layer.id, { y: value })} />
        <NumberControl label="불투명도" value={layer.opacity} min={0} max={100} onChange={value => onLayer(slideId, layer.id, { opacity: value })} />
        <NumberControl label="블러" value={layer.blur} min={0} max={40} onChange={value => onLayer(slideId, layer.id, { blur: value })} />
        <NumberControl label="스케일 %" value={Math.round(layer.scale * 100)} min={25} max={300} onChange={value => onLayer(slideId, layer.id, { scale: value / 100 })} />
        <NumberControl label="회전" value={layer.rotation} min={-180} max={180} onChange={value => onLayer(slideId, layer.id, { rotation: value })} />
      </div>
      <div className="flex gap-2">
        <SmallButton onClick={() => onReorder(slideId, layer.id, 1)}><MoveUp className="h-3.5 w-3.5" /> 앞으로</SmallButton>
        <SmallButton onClick={() => onReorder(slideId, layer.id, -1)}><MoveDown className="h-3.5 w-3.5" /> 뒤로</SmallButton>
      </div>
    </div>
  )
}

function applyTypographyPreset(document: EditorialDocument, preset: TypographyPreset) {
  const styles: Record<TypographyPreset, { title: Partial<EditorialLayer>; subtitle: Partial<EditorialLayer> }> = {
    'cinematic-headline': { title: { fontPreset: 'pretendard', fontSize: 72, fontWeight: 800, tracking: -2, lineHeight: 1.06 }, subtitle: { fontSize: 27, tracking: 0 } },
    'breaking-news': { title: { fontPreset: 'suit', fontSize: 78, fontWeight: 900, tracking: -3, lineHeight: 1 }, subtitle: { fontSize: 25, tracking: 1 } },
    'magazine-editorial': { title: { fontPreset: 'magazine', fontSize: 76, fontWeight: 700, tracking: -1, lineHeight: 1.12 }, subtitle: { fontSize: 26, tracking: 0 } },
    'minimal-luxury': { title: { fontPreset: 'serif', fontSize: 62, fontWeight: 600, tracking: 1, lineHeight: 1.18 }, subtitle: { fontSize: 23, tracking: 2 } },
    'dark-social': { title: { fontPreset: 'pretendard', fontSize: 70, fontWeight: 850, tracking: -2, lineHeight: 1.05 }, subtitle: { fontSize: 28, tracking: 0 } },
    'emotional-storytelling': { title: { fontPreset: 'serif', fontSize: 67, fontWeight: 650, tracking: 0, lineHeight: 1.15 }, subtitle: { fontSize: 27, tracking: 0 } },
    'high-ctr-hook': { title: { fontPreset: 'suit', fontSize: 84, fontWeight: 900, tracking: -3, lineHeight: 0.98 }, subtitle: { fontSize: 26, tracking: 0 } },
  }
  return { ...document, typographyPreset: preset, layers: document.layers.map(layer => layer.type === 'title' ? { ...layer, ...styles[preset].title } : layer.type === 'subtitle' ? { ...layer, ...styles[preset].subtitle } : layer) }
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
  return <label className="text-[10px] font-bold uppercase tracking-wide text-[#746a62]">{label}<input type="number" value={Math.round(value)} min={min} max={max} onChange={event => onChange(Number(event.target.value))} className="field mt-1 h-9 w-full px-2 text-xs text-[#1f1512]" /></label>
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-[#e8dfd4] py-2 text-xs font-bold text-[#514a44]">{children}</button>
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff]">{children}</button>
}
