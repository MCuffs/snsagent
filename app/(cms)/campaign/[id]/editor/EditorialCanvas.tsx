'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Bold, Italic, Move, Underline } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialLayer, FontPreset } from '../../../../../src/lib/editor/types'

const SCALE = 0.5

// ─── Floating bold/italic/underline toolbar (editing mode only) ───────────────
function SelectionToolbar({ slideId, editingLayerId }: { slideId: string; editingLayerId: string | null }) {
  const t = useTranslations('campaign')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const selectedLayerId = useEditorialStore(state => state.selectedLayerId)
  const documents = useEditorialStore(state => state.documents)
  const updateLayer = useEditorialStore(state => state.updateLayer)

  useEffect(() => {
    if (!editingLayerId) { setPos(null); return }
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPos(null); return }
      const range = sel.getRangeAt(0)
      const container = range.commonAncestorContainer
      const editable = (container instanceof Element ? container : container.parentElement)?.closest('[contenteditable="true"]')
      if (!editable) { setPos(null); return }
      const r = range.getBoundingClientRect()
      if (r.width === 0) { setPos(null); return }
      setPos({ top: r.top - 44, left: r.left + r.width / 2 })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [editingLayerId])

  if (!pos || !editingLayerId) return null

  const layer = selectedLayerId ? documents[slideId]?.layers.find(l => l.id === selectedLayerId) : null

  const applyStyle = (command: 'bold' | 'italic' | 'underline') => {
    document.execCommand(command)
    if (!layer || !selectedLayerId) return
    if (command === 'bold') {
      updateLayer(slideId, selectedLayerId, { fontWeight: (layer.fontWeight ?? 400) >= 700 ? 400 : 700 })
    } else if (command === 'italic') {
      updateLayer(slideId, selectedLayerId, { italic: !layer.italic })
    } else if (command === 'underline') {
      updateLayer(slideId, selectedLayerId, { underline: !layer.underline })
    }
  }

  const isBold = (layer?.fontWeight ?? 400) >= 700
  const isItalic = !!layer?.italic
  const isUnderline = !!layer?.underline

  return (
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
      className="flex items-center gap-0.5 rounded-lg border border-[#333] bg-[#1a1a1a] px-1.5 py-1 shadow-2xl"
      onMouseDown={e => e.preventDefault()}
    >
      <button type="button" onClick={() => applyStyle('bold')} title={t('bold')}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${isBold ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => applyStyle('italic')} title={t('italic')}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${isItalic ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => applyStyle('underline')} title={t('underline')}
        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${isUnderline ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}>
        <Underline className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── 8-direction resize handles ───────────────────────────────────────────────
const HANDLE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type HandleDir = typeof HANDLE_DIRS[number]

function handlePosition(dir: HandleDir, w: number, h: number): React.CSSProperties {
  const half = 4 // half of 8px handle
  const mid = '50%'
  const positions: Record<HandleDir, React.CSSProperties> = {
    nw: { top: -half, left: -half },
    n:  { top: -half, left: `calc(${mid} - ${half}px)` },
    ne: { top: -half, right: -half },
    e:  { top: `calc(${mid} - ${half}px)`, right: -half },
    se: { bottom: -half, right: -half },
    s:  { bottom: -half, left: `calc(${mid} - ${half}px)` },
    sw: { bottom: -half, left: -half },
    w:  { top: `calc(${mid} - ${half}px)`, left: -half },
  }
  void w; void h
  return positions[dir]
}

function handleCursor(dir: HandleDir): string {
  const cursors: Record<HandleDir, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    e: 'e-resize', se: 'se-resize', s: 's-resize',
    sw: 'sw-resize', w: 'w-resize',
  }
  return cursors[dir]
}

function ResizeHandles({
  layer,
  onResize,
  onResizeStart,
  onResizeEnd,
}: {
  layer: EditorialLayer
  onResize: (w: number, h: number, x: number, y: number) => void
  onResizeStart: () => void
  onResizeEnd: () => void
}) {
  const dragStart = useRef<{
    dir: HandleDir; mx: number; my: number
    x: number; y: number; w: number; h: number
  } | null>(null)

  const handlePointerDown = (e: React.PointerEvent, dir: HandleDir) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStart.current = {
      dir, mx: e.clientX, my: e.clientY,
      x: layer.x, y: layer.y, w: layer.width, h: layer.height,
    }
    onResizeStart()
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    e.stopPropagation()
    const dx = (e.clientX - dragStart.current.mx) / SCALE
    const dy = (e.clientY - dragStart.current.my) / SCALE
    const { dir, x, y, w, h } = dragStart.current
    let nx = x, ny = y, nw = w, nh = h
    if (dir.includes('e')) nw = Math.max(40, w + dx)
    if (dir.includes('s')) nh = Math.max(20, h + dy)
    if (dir.includes('w')) { nw = Math.max(40, w - dx); nx = x + (w - nw) }
    if (dir.includes('n')) { nh = Math.max(20, h - dy); ny = y + (h - nh) }
    onResize(Math.round(nw), Math.round(nh), Math.round(nx), Math.round(ny))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    e.stopPropagation()
    dragStart.current = null
    onResizeEnd()
  }

  return (
    <>
      {HANDLE_DIRS.map(dir => (
        <div
          key={dir}
          className="absolute z-[200] h-2 w-2 rounded-full border border-[#29c5ff] bg-white shadow-sm"
          style={{ ...handlePosition(dir, layer.width * SCALE, layer.height * SCALE), cursor: handleCursor(dir) }}
          onPointerDown={e => handlePointerDown(e, dir)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      ))}
    </>
  )
}

// ─── Right-click context menu ─────────────────────────────────────────────────
function ContextMenu({
  x, y, layer, allLayers, onClose, onUpdate, onDelete,
}: {
  x: number; y: number
  layer: EditorialLayer
  allLayers: EditorialLayer[]
  onClose: () => void
  onUpdate: (update: Partial<EditorialLayer>) => void
  onDelete: () => void
}) {
  const editableLayers = allLayers.filter(l => !['background', 'overlay', 'watermark'].includes(l.type))
  const maxZ = Math.max(...editableLayers.map(l => l.zIndex))
  const minZ = Math.min(...editableLayers.map(l => l.zIndex))

  const menuItems = [
    { label: '맨 앞으로', action: () => onUpdate({ zIndex: maxZ + 1 }), disabled: layer.zIndex >= maxZ },
    { label: '앞으로', action: () => onUpdate({ zIndex: layer.zIndex + 1 }), disabled: layer.zIndex >= maxZ },
    { label: '뒤로', action: () => onUpdate({ zIndex: Math.max(0, layer.zIndex - 1) }), disabled: layer.zIndex <= minZ },
    { label: '맨 뒤로', action: () => onUpdate({ zIndex: Math.max(0, minZ - 1) }), disabled: layer.zIndex <= minZ },
    null, // separator
    { label: '삭제', action: onDelete, disabled: layer.locked, danger: true },
  ]

  return (
    <div
      style={{ position: 'fixed', top: y, left: x, zIndex: 10000 }}
      className="min-w-[140px] rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] py-1 shadow-2xl"
      onPointerDown={e => e.stopPropagation()}
    >
      {menuItems.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 border-t border-[#2a2a2a]" />
        ) : (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => { item.action(); onClose() }}
            className={`w-full px-3 py-1.5 text-left text-xs font-semibold transition-colors disabled:opacity-30 ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

// ─── Main canvas component ────────────────────────────────────────────────────
export function EditorialCanvas({ slideId, fallbackImageUrl }: { slideId: string; fallbackImageUrl?: string | null }) {
  const t = useTranslations('campaign')
  const document = useEditorialStore(state => state.documents[slideId])
  const selectedLayerId = useEditorialStore(state => state.selectedLayerId)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const removeLayer = useEditorialStore(state => state.removeLayer)

  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const [failedBackgroundUrl, setFailedBackgroundUrl] = useState<string | null>(null)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null)
  const isResizing = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)

  // Escape → exit editing mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingLayerId(null)
    }
    globalThis.document?.addEventListener('keydown', handleKeyDown)
    return () => globalThis.document?.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside stage → exit editing mode
  useEffect(() => {
    if (!editingLayerId) return
    const handlePointerDown = (e: PointerEvent) => {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) {
        setEditingLayerId(null)
      }
    }
    globalThis.document?.addEventListener('pointerdown', handlePointerDown)
    return () => globalThis.document?.removeEventListener('pointerdown', handlePointerDown)
  }, [editingLayerId])

  // Click outside → close context menu
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    globalThis.document?.addEventListener('pointerdown', close)
    return () => globalThis.document?.removeEventListener('pointerdown', close)
  }, [contextMenu])

  // Auto-enter editing mode when a new user text layer is selected
  useEffect(() => {
    if (!selectedLayerId || !document) return
    const layer = document.layers.find(l => l.id === selectedLayerId)
    if (layer?.type === 'text' && layer.text === '텍스트를 입력하세요') {
      setEditingLayerId(selectedLayerId)
    }
  }, [selectedLayerId, document])

  const handleDragEnd = useCallback((layer: EditorialLayer, x: number, y: number) => {
    if (!document) return
    const otherLayers = document.layers.filter(l => l.id !== layer.id && l.visible && !['background', 'overlay'].includes(l.type))
    const xGuides = [72, 540, 1080 - 72 - layer.width]
    const yGuides = [72, 675, 1350 - 72 - layer.height]
    for (const other of otherLayers) {
      xGuides.push(other.x, other.x + other.width, other.x - layer.width, other.x + other.width - layer.width, other.x + other.width / 2 - layer.width / 2)
      yGuides.push(other.y, other.y + other.height, other.y - layer.height, other.y + other.height - layer.height, other.y + other.height / 2 - layer.height / 2)
    }
    updateLayer(slideId, layer.id, {
      x: snap(x / SCALE, xGuides, 12),
      y: snap(y / SCALE, yGuides, 12),
    })
    setGuides({})
  }, [document, slideId, updateLayer])

  if (!document) return <div className="aspect-[4/5] bg-[#111318]" />

  const background = document.layers.find(layer => layer.type === 'background')
  const backgroundFailed = Boolean(background?.imageUrl && failedBackgroundUrl === background.imageUrl)
  const showingRenderedPreview = Boolean(fallbackImageUrl && (!background?.imageUrl || backgroundFailed))
  const backgroundSource = showingRenderedPreview ? fallbackImageUrl : background?.imageUrl
  const overlay = document.overlay
  const elements = showingRenderedPreview
    ? []
    : document.layers
        .filter(layer => !['background', 'overlay'].includes(layer.type) && layer.visible)
        .sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="relative">
      <SelectionToolbar slideId={slideId} editingLayerId={editingLayerId} />
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-white/60">
        <span className="flex items-center gap-2"><Move className="h-3.5 w-3.5" /> {t('canvas_instruction')}</span>
        <span>{t('canvas_safe_zone')}</span>
      </div>
      <div
        ref={stageRef}
        className="relative mx-auto h-[675px] w-[540px] max-w-full overflow-hidden rounded-[8px] bg-[#090a0d] shadow-[0_32px_90px_rgba(0,0,0,0.48)]"
        onPointerDown={() => {
          if (contextMenu) setContextMenu(null)
        }}
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
              transform: `translate(${(background.x ?? 0) * SCALE}px, ${(background.y ?? 0) * SCALE}px) scale(${background.scale ?? 1})`,
              transformOrigin: '0 0',
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

        {elements.map(layer => {
          const isEditing = editingLayerId === layer.id
          const isSelected = selectedLayerId === layer.id
          const canDrag = !layer.locked && !isEditing && !isResizing.current
          const showHandles = isSelected && !isEditing && !['background', 'overlay'].includes(layer.type)

          return (
            <motion.div
              key={layer.id}
              drag={canDrag}
              dragElastic={0}
              dragMomentum={false}
              dragConstraints={stageRef}
              whileDrag={{ cursor: 'grabbing' }}
              onPointerDown={() => {
                if (editingLayerId && editingLayerId !== layer.id) setEditingLayerId(null)
                selectLayer(layer.id)
              }}
              onDoubleClick={e => {
                if (layer.locked || layer.imageUrl) return
                e.stopPropagation()
                setEditingLayerId(layer.id)
              }}
              onContextMenu={e => {
                if (['background', 'overlay', 'watermark'].includes(layer.type)) return
                e.preventDefault()
                e.stopPropagation()
                selectLayer(layer.id)
                setContextMenu({ x: e.clientX, y: e.clientY, layerId: layer.id })
              }}
              onDrag={(_, info) => {
                if (!document) return
                const otherLayers = document.layers.filter(l => l.id !== layer.id && l.visible && !['background', 'overlay'].includes(l.type))
                const nextX = (layer.x * SCALE + info.offset.x) / SCALE
                const nextY = (layer.y * SCALE + info.offset.y) / SCALE
                let gx: number | undefined, gy: number | undefined
                if (Math.abs(nextX - 72) <= 12) gx = 72
                else if (Math.abs(nextX + layer.width - (1080 - 72)) <= 12) gx = 1080 - 72
                else if (Math.abs(nextX + layer.width / 2 - 540) <= 12) gx = 540
                if (Math.abs(nextY - 72) <= 12) gy = 72
                else if (Math.abs(nextY + layer.height - (1350 - 72)) <= 12) gy = 1350 - 72
                else if (Math.abs(nextY + layer.height / 2 - 675) <= 12) gy = 675
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
              className={`absolute overflow-visible ${isEditing ? 'cursor-text' : layer.locked ? 'cursor-default' : 'cursor-move'} ${isSelected ? 'ring-1 ring-[#29c5ff]' : ''}`}
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
                key={isEditing ? layer.id + '-edit' : layer.id}
                layer={layer}
                editing={isEditing}
                onText={text => updateLayer(slideId, layer.id, { text })}
                onEditingEnd={() => setEditingLayerId(null)}
              />
              {showHandles && (
                <ResizeHandles
                  layer={layer}
                  onResize={(w, h, x, y) => updateLayer(slideId, layer.id, { width: w, height: h, x, y })}
                  onResizeStart={() => { isResizing.current = true }}
                  onResizeEnd={() => { isResizing.current = false }}
                />
              )}
            </motion.div>
          )
        })}

        {/* Context menu — fixed positioning to escape overflow:hidden */}
        {contextMenu && (() => {
          const ctxLayer = document.layers.find(l => l.id === contextMenu.layerId)
          if (!ctxLayer) return null
          return (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              layer={ctxLayer}
              allLayers={document.layers}
              onClose={() => setContextMenu(null)}
              onUpdate={update => updateLayer(slideId, contextMenu.layerId, update)}
              onDelete={() => {
                removeLayer(slideId, contextMenu.layerId)
                setContextMenu(null)
              }}
            />
          )
        })()}
      </div>
    </div>
  )
}

// ─── Layer content renderer ───────────────────────────────────────────────────
function LayerContent({
  layer, editing, onText, onEditingEnd,
}: {
  layer: EditorialLayer
  editing: boolean
  onText: (text: string) => void
  onEditingEnd: () => void
}) {
  const textRef = useRef<HTMLDivElement>(null)

  // Focus + move cursor to end when entering edit mode
  useEffect(() => {
    if (!editing || !textRef.current) return
    const el = textRef.current
    el.focus()
    const range = globalThis.document?.createRange()
    const sel = window.getSelection()
    if (range && sel) {
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [editing])

  if (layer.imageUrl) {
    const radius = layer.borderRadius ?? 0
    const fade = layer.edgeFade ?? 0
    let maskImage: string | undefined
    if (fade > 0) {
      const stop = `${fade}%`
      maskImage = [
        `linear-gradient(to bottom, transparent 0%, black ${stop})`,
        `linear-gradient(to top,    transparent 0%, black ${stop})`,
        `linear-gradient(to right,  transparent 0%, black ${stop})`,
        `linear-gradient(to left,   transparent 0%, black ${stop})`,
      ].join(', ')
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={layer.imageUrl}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
        style={{
          borderRadius: radius > 0 ? `${radius}%` : undefined,
          WebkitMaskImage: maskImage,
          maskImage,
          WebkitMaskComposite: maskImage ? 'source-in' : undefined,
          maskComposite: maskImage ? 'intersect' : undefined,
        }}
      />
    )
  }

  return (
    <div
      ref={textRef}
      contentEditable={editing && !layer.locked}
      suppressContentEditableWarning
      onBlur={e => {
        if (!editing) return
        // Strip trailing newline that contentEditable appends
        const text = e.currentTarget.innerText.replace(/\n$/, '')
        onText(text)
        onEditingEnd()
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.preventDefault()
          const text = (e.target as HTMLDivElement).innerText.replace(/\n$/, '')
          onText(text)
          onEditingEnd()
        }
      }}
      className="h-full whitespace-pre-wrap break-words outline-none"
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
        userSelect: editing ? 'text' : 'none',
        pointerEvents: editing ? 'auto' : 'none',
      }}
    >
      {layer.text}
    </div>
  )
}

// ─── Utilities ────────────────────────────────────────────────────────────────
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
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`
}
