'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Bold, Italic, Move, Pencil, Underline } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialLayer, FontPreset } from '../../../../../src/lib/editor/types'

const SCALE = 0.5

// Floating toolbar that appears over selected text in contentEditable layers
function SelectionToolbar() {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); return }
      const range = sel.getRangeAt(0)
      const container = range.commonAncestorContainer
      const editable = (container instanceof Element ? container : container.parentElement)?.closest('[contenteditable="true"]')
      if (!editable) { setPos(null); return }
      const r = range.getBoundingClientRect()
      if (r.width === 0) { setPos(null); return }
      setPos({ top: r.top - 40, left: r.left + r.width / 2 })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  if (!pos) return null

  const apply = (command: string) => {
    document.execCommand(command)
    const sel = window.getSelection()
    const el = (sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('[contenteditable="true"]') as HTMLElement | null
    if (el) { el.blur(); el.focus() }
  }

  return (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
      className="flex items-center gap-0.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-1.5 py-1 shadow-2xl"
      onMouseDown={e => e.preventDefault()}
    >
      <button type="button" onClick={() => apply('bold')} title="굵게" className="flex h-7 w-7 items-center justify-center rounded text-white/80 hover:bg-white/15 hover:text-white">
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => apply('italic')} title="기울임" className="flex h-7 w-7 items-center justify-center rounded text-white/80 hover:bg-white/15 hover:text-white">
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => apply('underline')} title="밑줄" className="flex h-7 w-7 items-center justify-center rounded text-white/80 hover:bg-white/15 hover:text-white">
        <Underline className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function EditorialCanvas({ slideId, fallbackImageUrl }: { slideId: string; fallbackImageUrl?: string | null }) {
  const t = useTranslations('campaign')
  const document = useEditorialStore(state => state.documents[slideId])
  const selectedLayerId = useEditorialStore(state => state.selectedLayerId)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  if (!document) return <div className="aspect-[4/5] bg-[#111318]" />
  const background = document.layers.find(layer => layer.type === 'background')
  const backgroundFailed = Boolean(background?.imageUrl && failedBackgroundUrl === background.imageUrl)
  const showingRenderedPreview = Boolean(fallbackImageUrl && (!background?.imageUrl || backgroundFailed))
  const backgroundSource = showingRenderedPreview ? fallbackImageUrl : background?.imageUrl
  const overlay = document.overlay
  const elements = showingRenderedPreview
    ? [] // The final preview already includes copy; never stack editable copy over it.
    : document.layers
        .filter(layer => !['background', 'overlay'].includes(layer.type) && layer.visible)
        .sort((a, b) => a.zIndex - b.zIndex)

  const handleDragEnd = (layer: EditorialLayer, x: number, y: number) => {
    const otherLayers = document.layers.filter(l => l.id !== layer.id && l.visible && !['background', 'overlay'].includes(l.type))
    const xGuides = [72, 540, 1080 - 72 - layer.width]
    const yGuides = [72, 675, 1350 - 72 - layer.height]
    for (const other of otherLayers) {
      xGuides.push(
        other.x,
        other.x + other.width,
        other.x - layer.width,
        other.x + other.width - layer.width,
        other.x + other.width / 2 - layer.width / 2
      )
      yGuides.push(
        other.y,
        other.y + other.height,
        other.y - layer.height,
        other.y + other.height - layer.height,
        other.y + other.height / 2 - layer.height / 2
      )
    }

    const snappedX = snap(x / SCALE, xGuides, 12)
    const snappedY = snap(y / SCALE, yGuides, 12)
    updateLayer(slideId, layer.id, { x: snappedX, y: snappedY })
    setGuides({})
  }

  return (
    <div className="relative">
      <SelectionToolbar />
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-white/60">
        <span className="flex items-center gap-2"><Move className="h-3.5 w-3.5" /> {t('canvas_instruction')}</span>
        <span>{t('canvas_safe_zone')}</span>
      </div>
      <div
        ref={stageRef}
        className="relative mx-auto h-[675px] w-[540px] max-w-full overflow-hidden rounded-[8px] bg-[#090a0d] shadow-[0_32px_90px_rgba(0,0,0,0.48)]"
      >
        {background?.visible && backgroundSource && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundSource}
            alt=""
            draggable={false}
            onError={() => background.imageUrl && setFailedBackgroundUrl(background.imageUrl)}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
            style={{
              opacity: background.opacity / 100,
              filter: `blur(${overlay.blur * SCALE}px) contrast(${overlay.contrast}%)`,
            }}
          />
        )}
        {!showingRenderedPreview && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: (document.layers.find(layer => layer.type === 'overlay')?.opacity ?? 100) / 100,
              background: `radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,${overlay.vignette / 100}) 100%), linear-gradient(180deg, ${hexToRgba(overlay.colorFilter, overlay.darkness / 260)} 0%, rgba(5,5,8,${overlay.darkness / 100}) 100%)`,
              mixBlendMode: overlay.preset === 'dreamy' ? 'soft-light' : 'normal',
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-[36px] border border-dashed border-white/10" />
        {showingRenderedPreview && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/80">
            {t('rendered_preview')}
          </div>
        )}
        {guides.x !== undefined && <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#29c5ff]" style={{ left: guides.x * SCALE }} />}
        {guides.y !== undefined && <div className="pointer-events-none absolute left-0 right-0 h-px bg-[#29c5ff]" style={{ top: guides.y * SCALE }} />}
        {elements.map(layer => (
          <motion.div
            key={layer.id}
            drag={!layer.locked}
            dragElastic={0}
            dragMomentum={false}
            dragConstraints={stageRef}
            whileDrag={{ cursor: 'grabbing' }}
            onPointerDown={() => selectLayer(layer.id)}
            onDrag={(_, info) => {
              const otherLayers = document.layers.filter(l => l.id !== layer.id && l.visible && !['background', 'overlay'].includes(l.type))
              const nextX = (layer.x * SCALE + info.offset.x) / SCALE
              const nextY = (layer.y * SCALE + info.offset.y) / SCALE
              
              let gx: number | undefined
              let gy: number | undefined
              
              // Safe zone boundaries
              if (Math.abs(nextX - 72) <= 12) gx = 72
              else if (Math.abs(nextX + layer.width - (1080 - 72)) <= 12) gx = 1080 - 72
              else if (Math.abs(nextX + layer.width / 2 - 540) <= 12) gx = 540
              
              if (Math.abs(nextY - 72) <= 12) gy = 72
              else if (Math.abs(nextY + layer.height - (1350 - 72)) <= 12) gy = 1350 - 72
              else if (Math.abs(nextY + layer.height / 2 - 675) <= 12) gy = 675

              // Element boundaries
              for (const other of otherLayers) {
                if (Math.abs(nextX - other.x) <= 12) gx = other.x
                else if (Math.abs(nextX + layer.width - other.x) <= 12) gx = other.x
                else if (Math.abs(nextX - (other.x + other.width)) <= 12) gx = other.x + other.width
                else if (Math.abs(nextX + layer.width - (other.x + other.width)) <= 12) gx = other.x + other.width
                else if (Math.abs(nextX + layer.width / 2 - (other.x + other.width / 2)) <= 12) gx = other.x + other.width / 2

                if (Math.abs(nextY - other.y) <= 12) gy = other.y
                else if (Math.abs(nextY + layer.height - other.y) <= 12) gy = other.y
                else if (Math.abs(nextY - (other.y + other.height)) <= 12) gy = other.y + other.height
                else if (Math.abs(nextY + layer.height - (other.y + other.height)) <= 12) gy = other.y + other.height
                else if (Math.abs(nextY + layer.height / 2 - (other.y + other.height / 2)) <= 12) gy = other.y + other.height / 2
              }

              setGuides({ x: gx, y: gy })
            }}
            onDragEnd={(_, info) => handleDragEnd(layer, layer.x * SCALE + info.offset.x, layer.y * SCALE + info.offset.y)}
            className={`absolute cursor-move overflow-visible ${selectedLayerId === layer.id ? 'ring-1 ring-[#29c5ff]' : ''}`}
            style={{
              x: layer.x * SCALE,
              y: layer.y * SCALE,
              left: 0,
              top: 0,
              width: layer.width * SCALE,
              minHeight: layer.height * SCALE,
              zIndex: layer.zIndex,
              opacity: layer.opacity / 100,
              scale: layer.scale,
              rotate: layer.rotation,
              filter: layer.blur ? `blur(${layer.blur * SCALE}px)` : undefined,
            }}
          >
            <LayerContent
              layer={layer}
              selected={selectedLayerId === layer.id}
              onText={(text, style) => updateLayer(slideId, layer.id, { text, ...style })}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function LayerContent({ layer, selected, onText }: { layer: EditorialLayer; selected: boolean; onText: (text: string, style?: Partial<EditorialLayer>) => void }) {
  if (layer.imageUrl) {
    const radius = layer.borderRadius ?? 0
    const fade = layer.edgeFade ?? 0
    // Build a CSS mask that combines border-radius (via inset clip) and edge fade (via radial gradient)
    const maskGradient = fade > 0
      ? `radial-gradient(ellipse at center, black ${100 - fade}%, transparent 100%)`
      : undefined
    return (
      <>
        {selected && <Pencil className="absolute -right-5 -top-5 h-4 w-4 text-[#29c5ff]" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={layer.imageUrl}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full select-none object-contain"
          style={{
            borderRadius: radius > 0 ? `${radius}%` : undefined,
            WebkitMaskImage: maskGradient,
            maskImage: maskGradient,
          }}
        />
      </>
    )
  }
  return (
    <>
      {selected && <Pencil className="absolute -right-5 -top-5 h-4 w-4 text-[#29c5ff]" />}
      <div
        contentEditable={!layer.locked}
        suppressContentEditableWarning
        onBlur={event => {
          const el = event.currentTarget
          const computed = window.getComputedStyle(el)
          const fontWeightNum = parseInt(computed.fontWeight, 10)
          const isItalic = computed.fontStyle === 'italic' || computed.fontStyle === 'oblique'
          const isUnderline = computed.textDecorationLine?.includes('underline') ?? false
          const styleUpdate: Partial<EditorialLayer> = {}
          if (!isNaN(fontWeightNum) && fontWeightNum !== (layer.fontWeight ?? 400)) {
            styleUpdate.fontWeight = fontWeightNum
          }
          if (isItalic !== (layer.italic ?? false)) styleUpdate.italic = isItalic
          if (isUnderline !== (layer.underline ?? false)) styleUpdate.underline = isUnderline
          onText(el.innerText, Object.keys(styleUpdate).length > 0 ? styleUpdate : undefined)
        }}
        className="h-full whitespace-pre-wrap outline-none"
        style={{
          color: layer.color,
          fontFamily: fontFamily(layer.fontPreset),
          fontSize: (layer.fontSize || 24) * SCALE,
          fontWeight: layer.fontWeight,
          lineHeight: layer.lineHeight,
          letterSpacing: (layer.tracking || 0) * SCALE,
          textAlign: layer.textAlign,
          textShadow: layer.shadow ? `0 ${4 * SCALE}px ${layer.shadow * SCALE}px rgba(0,0,0,.58)` : undefined,
          WebkitTextStroke: layer.stroke ? `${layer.stroke * SCALE}px ${layer.strokeColor}` : undefined,
          background: layer.textBackground,
          fontStyle: layer.italic ? 'italic' : undefined,
          textDecoration: layer.underline ? 'underline' : undefined,
        }}
      >
        {layer.text}
      </div>
    </>
  )
}

function fontFamily(preset?: FontPreset) {
  if (preset === 'serif' || preset === 'magazine') return 'Georgia, "Noto Serif KR", serif'
  if (preset === 'suit') return 'SUIT, Pretendard, sans-serif'
  if (preset === 'noto-sans') return '"Noto Sans KR", Pretendard, sans-serif'
  return 'Pretendard, "Apple SD Gothic Neo", sans-serif'
}

function snap(value: number, guides: number[], threshold: number) {
  return guides.find(guide => Math.abs(guide - value) <= threshold) ?? Math.max(0, value)
}


function hexToRgba(hex: string, alpha: number) {
  const number = Number.parseInt(hex.slice(1), 16)
  return `rgba(${number >> 16},${(number >> 8) & 255},${number & 255},${alpha})`
}
