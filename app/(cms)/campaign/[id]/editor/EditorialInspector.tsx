'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bold, Eye, EyeOff, ImageIcon, Italic, Layers, Redo2, Sparkles, Trash2, Type, Underline, Undo2, Upload } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialDocument, EditorialLayer, FontPreset, OverlayPreset } from '../../../../../src/lib/editor/types'

type EditorTab = 'text' | 'background' | 'overlay' | 'image'

interface Props {
  slideId: string
  busy: boolean
  onUpload: () => void
  onImageUpload: () => void
}

export function EditorialInspector({ slideId, busy, onUpload, onImageUpload }: Props) {
  const t = useTranslations('campaign')
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
            <h2 className="mt-1 text-lg font-black tracking-[-0.04em]">{t('editor_title')}</h2>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dirty ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {dirty ? t('status_saving') : t('status_saved')}
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <IconButton label={t('undo')} onClick={() => undo(slideId)}><Undo2 className="h-4 w-4" /></IconButton>
          <IconButton label={t('redo')} onClick={() => redo(slideId)}><Redo2 className="h-4 w-4" /></IconButton>
        </div>
      </header>

      <nav className="grid grid-cols-4 border-b border-[#f0e8de] p-2">
        <TabButton active={tab === 'text'} onClick={() => setTab('text')} icon={<Type className="h-4 w-4" />} label={t('tab_text')} />
        <TabButton active={tab === 'background'} onClick={() => setTab('background')} icon={<ImageIcon className="h-4 w-4" />} label={t('tab_background')} />
        <TabButton active={tab === 'overlay'} onClick={() => setTab('overlay')} icon={<Sparkles className="h-4 w-4" />} label={t('tab_overlay')} />
        <TabButton active={tab === 'image'} onClick={() => setTab('image')} icon={<Layers className="h-4 w-4" />} label={t('tab_image')} />
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
  const t = useTranslations('campaign')
  return (
    <div className="space-y-4">
      <div className="flex rounded-lg bg-[#f7f4ef] p-1">
        <Segment active={target === 'title'} onClick={() => onTarget('title')}>{t('target_title')}</Segment>
        <Segment active={target === 'subtitle'} onClick={() => onTarget('subtitle')}>{t('target_body')}</Segment>
      </div>
      <textarea
        value={layer.text || ''}
        onChange={event => onChange({ text: event.target.value })}
        rows={target === 'title' ? 2 : 3}
        className="field w-full resize-none p-3 text-sm leading-6"
        placeholder={target === 'title' ? t('placeholder_headline') : t('placeholder_body')}
      />
      {/* Font / size / color row */}
      <div className="grid grid-cols-[1fr_70px_36px] gap-2">
        <select value={layer.fontPreset} onChange={event => onChange({ fontPreset: event.target.value as FontPreset })} className="field h-10 px-3 text-xs font-bold">
          <option value="pretendard">Pretendard</option>
          <option value="suit">SUIT</option>
          <option value="noto-sans">Noto Sans KR</option>
          <option value="serif">Editorial Serif</option>
          <option value="magazine">Magazine</option>
        </select>
        <input type="number" aria-label={t('font_size')} value={layer.fontSize || 24} min={10} max={180} onChange={event => onChange({ fontSize: Number(event.target.value) })} className="field h-10 px-2 text-xs font-bold text-center" />
        <input type="color" aria-label={t('text_color')} value={layer.color || '#ffffff'} onChange={event => onChange({ color: event.target.value })} className="field h-10 w-9 cursor-pointer p-1" />
      </div>
      {/* Style toggles: bold / italic / underline */}
      <div className="flex gap-2">
        <ToggleButton
          active={(layer.fontWeight ?? 400) >= 700}
          onClick={() => onChange({ fontWeight: (layer.fontWeight ?? 400) >= 700 ? 400 : 700 })}
          label={t('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={!!layer.italic}
          onClick={() => onChange({ italic: !layer.italic })}
          label={t('italic')}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToggleButton>
        <ToggleButton
          active={!!layer.underline}
          onClick={() => onChange({ underline: !layer.underline })}
          label={t('underline')}
        >
          <Underline className="h-3.5 w-3.5" />
        </ToggleButton>
      </div>
      {/* Weight slider (fine control) */}
      <RangeControl label={t('font_weight')} value={layer.fontWeight || 400} min={100} max={900} onChange={value => onChange({ fontWeight: value })} />
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
  const t = useTranslations('campaign')
  return (
    <div className="space-y-5">
      <OptionGroup title={t('overlay_mood')}>
        {([
          ['netflix-dark', t('overlay_deep_dark')], ['luxury-editorial', t('overlay_editorial')], ['dreamy', t('overlay_soft')], ['modern-korean-media', t('overlay_modern')],
        ] as const).map(([key, label]) => (
          <Choice key={key} active={document.overlay.preset === key} onClick={() => onOverlay(key)}>{label}</Choice>
        ))}
      </OptionGroup>
      <div className="space-y-4 border-t border-[#f0e8de] pt-4">
        <RangeControl label={t('darkness')} value={document.overlay.darkness} min={0} max={100} onChange={value => onOverlayValue('darkness', value)} />
        <RangeControl label={t('vignette')} value={document.overlay.vignette} min={0} max={100} onChange={value => onOverlayValue('vignette', value)} />
        <RangeControl label={t('contrast')} value={document.overlay.contrast} min={50} max={160} onChange={value => onOverlayValue('contrast', value)} />
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
  const t = useTranslations('campaign')
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#f5f8ff] p-3 text-xs leading-5 text-[#4c6070] space-y-1.5">
        <p>{t('background_help')}</p>
        <p className="text-[10px] text-[#717b8f] font-semibold">{t('background_note')}</p>
      </div>
      <button type="button" disabled={busy} onClick={onUpload} className="btn-primary w-full rounded-md">
        <Upload className="h-4 w-4" /> {t('replace_background')}
      </button>
    </div>
  )
}

function ImagePanel({ slideId, document, busy, onUpload }: { slideId: string; document: EditorialDocument; busy: boolean; onUpload: () => void }) {
  const t = useTranslations('campaign')
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const removeLayer = useEditorialStore(state => state.removeLayer)
  const imageLayers = document.layers.filter(l => l.type === 'sticker' && l.id !== 'sticker' && l.imageUrl)

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#f5f8ff] p-3 text-xs leading-5 text-[#4c6070]">
        <p>{t('image_help')}</p>
      </div>
      <button type="button" disabled={busy} onClick={onUpload} className="btn-primary w-full rounded-md">
        <Upload className="h-4 w-4" /> {t('add_image')}
      </button>
      {imageLayers.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-[#746a62]">{t('image_layers')}</p>
          {imageLayers.map(layer => (
            <div key={layer.id} className="rounded-lg border border-[#e8dfd4] p-3 space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={layer.imageUrl!} alt="" className="h-12 w-12 flex-shrink-0 rounded object-cover border border-[#e8dfd4]" />
                <p className="flex-1 min-w-0 truncate text-xs font-bold text-[#1f1512]">{layer.name}</p>
                <button
                  type="button"
                  aria-label={layer.visible ? t('hide_layer') : t('show_layer')}
                  onClick={() => updateLayer(slideId, layer.id, { visible: !layer.visible })}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff]"
                >
                  {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  aria-label={t('delete_layer')}
                  onClick={() => removeLayer(slideId, layer.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#e8dfd4] text-[#514a44] hover:border-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <RangeControl label={t('opacity')} value={layer.opacity} min={0} max={100} onChange={value => updateLayer(slideId, layer.id, { opacity: value })} />
              <div className="grid grid-cols-2 gap-2">
                <NumberControl label="X" value={layer.x} min={0} max={1080} onChange={value => updateLayer(slideId, layer.id, { x: value })} />
                <NumberControl label="Y" value={layer.y} min={0} max={1350} onChange={value => updateLayer(slideId, layer.id, { y: value })} />
                <NumberControl label={t('width')} value={layer.width} min={16} max={1080} onChange={value => updateLayer(slideId, layer.id, { width: value })} />
                <NumberControl label={t('height')} value={layer.height} min={16} max={1350} onChange={value => updateLayer(slideId, layer.id, { height: value })} />
              </div>
              <RangeControl label={t('scale')} value={Math.round(layer.scale * 100)} min={25} max={400} onChange={value => updateLayer(slideId, layer.id, { scale: value / 100 })} />
              <RangeControl label={t('rotation')} value={layer.rotation} min={-180} max={180} onChange={value => updateLayer(slideId, layer.id, { rotation: value })} />
              <RangeControl label={t('corner_radius')} value={layer.borderRadius ?? 0} min={0} max={50} onChange={value => updateLayer(slideId, layer.id, { borderRadius: value })} />
              <RangeControl label={t('edge_fade')} value={layer.edgeFade ?? 0} min={0} max={80} onChange={value => updateLayer(slideId, layer.id, { edgeFade: value })} />
            </div>
          ))}
        </div>
      )}
      {imageLayers.length === 0 && (
        <p className="py-4 text-center text-xs text-[#9a8d82]">{t('no_images')}</p>
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

function ToggleButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
        active
          ? 'border-[#0066ff] bg-[#0066ff]/8 text-[#0066ff]'
          : 'border-[#e8dfd4] text-[#514a44] hover:border-[#0066ff] hover:text-[#0066ff]'
      }`}
    >
      {children}
    </button>
  )
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
