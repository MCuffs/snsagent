'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Move, Pencil } from 'lucide-react'
import { useEditorialStore } from './useEditorialStore'
import type { EditorialLayer, FontPreset } from '../../../../../src/lib/editor/types'

const SCALE = 0.5

export function EditorialCanvas({ slideId }: { slideId: string }) {
  const document = useEditorialStore(state => state.documents[slideId])
  const selectedLayerId = useEditorialStore(state => state.selectedLayerId)
  const selectLayer = useEditorialStore(state => state.selectLayer)
  const updateLayer = useEditorialStore(state => state.updateLayer)
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({})
  const stageRef = useRef<HTMLDivElement>(null)

  if (!document) return <div className="aspect-[4/5] bg-[#111318]" />
  const background = document.layers.find(layer => layer.type === 'background')
  const overlay = document.overlay
  const elements = document.layers
    .filter(layer => !['background', 'overlay'].includes(layer.type) && layer.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  const handleDragEnd = (layer: EditorialLayer, x: number, y: number) => {
    const snappedX = snap(x / SCALE, [72, 540, 1008 - layer.width], 12)
    const snappedY = snap(y / SCALE, [72, 675, 1278 - layer.height], 12)
    updateLayer(slideId, layer.id, { x: snappedX, y: snappedY })
    setGuides({})
  }

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold text-white/60">
        <span className="flex items-center gap-2"><Move className="h-3.5 w-3.5" /> DRAG / DOUBLE CLICK TO EDIT</span>
        <span>1080 x 1350 · SAFE ZONE 72PX</span>
      </div>
      <div
        ref={stageRef}
        className="relative mx-auto h-[675px] w-[540px] max-w-full overflow-hidden rounded-[8px] bg-[#090a0d] shadow-[0_32px_90px_rgba(0,0,0,0.48)]"
      >
        {background?.visible && background.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={background.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              opacity: background.opacity / 100,
              filter: `blur(${overlay.blur * SCALE}px) contrast(${overlay.contrast}%)`,
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            opacity: (document.layers.find(layer => layer.type === 'overlay')?.opacity ?? 100) / 100,
            background: `radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,${overlay.vignette / 100}) 100%), linear-gradient(180deg, ${hexToRgba(overlay.colorFilter, overlay.darkness / 260)} 0%, rgba(5,5,8,${overlay.darkness / 100}) 100%)`,
            mixBlendMode: overlay.preset === 'dreamy' ? 'soft-light' : 'normal',
          }}
        />
        <div className="pointer-events-none absolute inset-[36px] border border-dashed border-white/10" />
        {guides.x !== undefined && <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#29c5ff]" style={{ left: guides.x * SCALE }} />}
        {guides.y !== undefined && <div className="pointer-events-none absolute left-0 right-0 h-px bg-[#29c5ff]" style={{ top: guides.y * SCALE }} />}
        {elements.map(layer => (
          <motion.div
            key={layer.id}
            drag={!layer.locked}
            dragMomentum={false}
            onPointerDown={() => selectLayer(layer.id)}
            onDrag={(_, info) => {
              const nextX = (layer.x * SCALE + info.offset.x) / SCALE
              const nextY = (layer.y * SCALE + info.offset.y) / SCALE
              setGuides({
                x: nearGuide(nextX, [72, 540, 1008 - layer.width]),
                y: nearGuide(nextY, [72, 675, 1278 - layer.height]),
              })
            }}
            onDragEnd={(_, info) => handleDragEnd(layer, layer.x * SCALE + info.offset.x, layer.y * SCALE + info.offset.y)}
            className={`absolute cursor-move overflow-visible ${selectedLayerId === layer.id ? 'ring-1 ring-[#29c5ff]' : ''}`}
            style={{
              left: layer.x * SCALE,
              top: layer.y * SCALE,
              width: layer.width * SCALE,
              minHeight: layer.height * SCALE,
              zIndex: layer.zIndex,
              opacity: layer.opacity / 100,
              transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`,
              filter: layer.blur ? `blur(${layer.blur * SCALE}px)` : undefined,
            }}
          >
            <LayerContent
              layer={layer}
              selected={selectedLayerId === layer.id}
              onText={(text) => updateLayer(slideId, layer.id, { text })}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function LayerContent({ layer, selected, onText }: { layer: EditorialLayer; selected: boolean; onText: (text: string) => void }) {
  return (
    <>
      {selected && <Pencil className="absolute -right-5 -top-5 h-4 w-4 text-[#29c5ff]" />}
      <div
        contentEditable={!layer.locked}
        suppressContentEditableWarning
        onBlur={event => onText(event.currentTarget.innerText)}
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

function nearGuide(value: number, guides: number[]) {
  return guides.find(guide => Math.abs(guide - value) <= 12)
}

function hexToRgba(hex: string, alpha: number) {
  const number = Number.parseInt(hex.slice(1), 16)
  return `rgba(${number >> 16},${(number >> 8) & 255},${number & 255},${alpha})`
}
