import type {
  EditorialDocument,
  EditorialLayer,
  FontPreset,
  OverlayPreset,
  SlideEditorSeed,
  TypographyPreset,
} from './types'
import { repairRenderableCopy } from '../copywriting/renderableCopy'

const FONT_PRESETS: FontPreset[] = ['pretendard', 'suit', 'noto-sans', 'serif', 'magazine']
const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  'cinematic-headline',
  'breaking-news',
  'magazine-editorial',
  'minimal-luxury',
  'dark-social',
  'emotional-storytelling',
  'high-ctr-hook',
]
const OVERLAY_PRESETS: OverlayPreset[] = [
  'netflix-dark',
  'luxury-editorial',
  'noir',
  'dreamy',
  'instagram-magazine',
  'modern-korean-media',
]

export function createEditorialDocument(seed: SlideEditorSeed): EditorialDocument {
  const role = seed.slideNumber === 1 ? 'hook' : 'editorial-detail'
  const fontPreset = toFontPreset(seed.fontPreset)
  const textColor = validColor(seed.textColor, '#ffffff')
  const backgroundImageUrl = resolveEditableBackgroundImageUrl(seed.backgroundImageUrl, seed.imageUrl)
  // Video cardnews: use mp4 URL as background video layer
  const backgroundVideoUrl = seed.videoUrl ?? undefined

  return {
    version: 1,
    viewport: { width: 1080, height: 1350, ratio: '4:5' },
    slideRole: role,
    intent: role === 'hook' ? '시선을 멈추고 다음 슬라이드로 유도' : '핵심 메시지를 명료하게 전달',
    emotionalPurpose: role === 'hook' ? 'curiosity' : 'confidence',
    contentType: role === 'hook' ? 'headline' : 'editorial',
    typographyPreset: 'cinematic-headline',
    overlay: {
      preset: 'netflix-dark',
      darkness: 100,
      vignette: 35,
      blur: 0,
      grain: 8,
      contrast: 106,
      glow: 0,
      bloom: 0,
      colorFilter: '#17121f',
    },
    layers: [
      layer('background', '배경 영상', 0, {
        imageUrl: backgroundVideoUrl ? null : backgroundImageUrl,
        videoUrl: backgroundVideoUrl,
        locked: true,
      }),
      layer('overlay', '시네마틱 오버레이', 10, { locked: true }),
      layer('watermark', 'Shuffla 워터마크', 20, {
        text: 'SHUFFLA / EDITORIAL',
        x: 72,
        y: 62,
        width: 450,
        height: 34,
        fontPreset: 'pretendard',
        fontSize: 18,
        fontWeight: 600,
        tracking: 4,
        color: '#ffffff',
        opacity: 48,
      }),
      layer('title', '타이틀', 40, {
        text: seed.headline,
        x: 72,
        y: 780,
        width: 910,
        height: 200,
        fontPreset,
        fontSize: seed.headlineFontSize || 66,
        fontWeight: 800,
        lineHeight: 1.08,
        tracking: -1,
        color: textColor,
        shadow: 18,
      }),
      layer('subtitle', '본문', 50, {
        text: safeSubtitleText(seed.headline, seed.body),
        x: 72,
        y: 990,
        width: 820,
        height: 200,
        fontPreset,
        fontSize: seed.bodyFontSize || 26,
        fontWeight: 450,
        lineHeight: 1.36,
        tracking: 0,
        color: textColor,
        opacity: 82,
      }),
      layer('cta', 'CTA', 60, {
        text: 'SWIPE  ->',
        x: 72,
        y: 1265,
        width: 320,
        height: 38,
        fontPreset: 'pretendard',
        fontSize: 17,
        fontWeight: 700,
        tracking: 3,
        color: '#ffffff',
        opacity: 70,
      }),
      layer('sticker', '스티커 / 아이콘', 70, {
        text: '',
        x: 915,
        y: 75,
        width: 90,
        height: 90,
        visible: false,
      }),
    ],
    updatedAt: new Date().toISOString(),
  }
}

export function parseEditorialDocument(raw: string | null | undefined, seed: SlideEditorSeed): EditorialDocument {
  if (!raw) return createEditorialDocument(seed)
  try {
    const input = JSON.parse(raw) as Partial<EditorialDocument>
    const fallback = createEditorialDocument(seed)
    if (!Array.isArray(input.layers)) return fallback
    const doc = normalizeDocument({ ...fallback, ...input, layers: input.layers })
    const documentBackground = layerByType(doc, 'background')?.imageUrl
    // Prefer the URL already in the document (user upload / latest edit) over the stale seed value.
    // Fall back to the seed only if the document has no URL or its URL is a composite asset.
    const backgroundImageUrl =
      resolveEditableBackgroundImageUrl(documentBackground, seed.imageUrl) ??
      resolveEditableBackgroundImageUrl(seed.backgroundImageUrl, seed.imageUrl)
    doc.layers = doc.layers.map(layer =>
      layer.type === 'background'
        ? { ...layer, imageUrl: backgroundImageUrl }
        : layer.type === 'subtitle'
          ? { ...layer, text: safeSubtitleText(seed.headline, layer.text || seed.body) }
          : layer
    )
    return doc
  } catch {
    return createEditorialDocument(seed)
  }
}

function safeSubtitleText(headline: string, body: string) {
  return repairRenderableCopy({
    headline,
    body,
    constraints: {
      maxHeadlineChars: 52,
      maxBodyChars: 220,
      maxBodyLines: 6,
      lineLength: 32,
    },
  }).body
}

// A rendered slide already contains copy. It cannot be used as a source layer in the editor.
export function resolveEditableBackgroundImageUrl(candidate?: string | null, finalImageUrl?: string | null) {
  if (!candidate) return undefined
  if (finalImageUrl && candidate === finalImageUrl) return undefined

  const normalized = candidate.toLowerCase()
  const compositeAssetPatterns = [
    /(?:^|[/\\])media-card-/,
    /(?:^|[/\\])(?:fast-rerender|bg-replace|export)-/,
    /(?:^|[/\\])editorial(?:-bg)?-/,
    /(?:^|[/\\])cg-[^/\\]+-slide-\d+/,
  ]

  return compositeAssetPatterns.some(pattern => pattern.test(normalized))
    ? undefined
    : candidate
}

export function normalizeDocument(input: EditorialDocument): EditorialDocument {
  const fallback = createEditorialDocument({
    slideNumber: input.slideRole === 'hook' ? 1 : 2,
    headline: '',
    body: '',
    imageUrl: null,
  })
  const fallbackLayers = new Map(fallback.layers.map(item => [item.type, item]))
  const sanitized = input.layers
    .filter(candidate => fallbackLayers.has(candidate.type) && !isUserImageLayer(candidate))
    .map((candidate, index) => normalizeLayer(candidate, fallbackLayers.get(candidate.type)!, index))
  for (const missing of fallback.layers) {
    if (!sanitized.some(layerItem => layerItem.type === missing.type)) sanitized.push(missing)
  }

  // Preserve user-added image layers: sticker type with a non-default id and imageUrl
  const userImageLayers = input.layers
    .filter(isUserImageLayer)
    .map(candidate => normalizeUserImageLayer(candidate))

  // Preserve user-added free text layers: type 'text'
  const userTextLayers = input.layers
    .filter(isUserTextLayer)
    .map(candidate => normalizeUserTextLayer(candidate))

  return {
    ...fallback,
    ...input,
    version: 1,
    viewport: fallback.viewport,
    typographyPreset: TYPOGRAPHY_PRESETS.includes(input.typographyPreset) ? input.typographyPreset : fallback.typographyPreset,
    overlay: {
      ...fallback.overlay,
      ...input.overlay,
      preset: OVERLAY_PRESETS.includes(input.overlay?.preset) ? input.overlay.preset : fallback.overlay.preset,
      darkness: number(input.overlay?.darkness, 0, 100, fallback.overlay.darkness),
      vignette: number(input.overlay?.vignette, 0, 100, fallback.overlay.vignette),
      blur: number(input.overlay?.blur, 0, 30, fallback.overlay.blur),
      grain: number(input.overlay?.grain, 0, 100, fallback.overlay.grain),
      contrast: number(input.overlay?.contrast, 50, 160, fallback.overlay.contrast),
      glow: number(input.overlay?.glow, 0, 100, fallback.overlay.glow),
      bloom: number(input.overlay?.bloom, 0, 100, fallback.overlay.bloom),
      colorFilter: validColor(input.overlay?.colorFilter, fallback.overlay.colorFilter),
    },
    layers: [...sanitized, ...userImageLayers, ...userTextLayers].sort((a, b) => a.zIndex - b.zIndex),
    updatedAt: new Date().toISOString(),
  }
}

function isUserImageLayer(candidate: EditorialLayer) {
  return candidate.type === 'sticker' && candidate.id !== 'sticker' && typeof candidate.imageUrl === 'string'
}

function isUserTextLayer(candidate: EditorialLayer) {
  return candidate.type === 'text' && typeof candidate.text === 'string'
}

function normalizeUserTextLayer(candidate: EditorialLayer): EditorialLayer {
  return {
    id: typeof candidate.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(candidate.id) ? candidate.id : `text-${Date.now()}`,
    type: 'text',
    name: typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : '텍스트',
    visible: candidate.visible !== false,
    locked: false,
    opacity: number(candidate.opacity, 0, 100, 100),
    zIndex: number(candidate.zIndex, 0, 1000, 65),
    x: number(candidate.x, 0, 1080, 200),
    y: number(candidate.y, 0, 1350, 600),
    width: number(candidate.width, 40, 1080, 680),
    height: number(candidate.height, 20, 1350, 100),
    scale: number(candidate.scale, 0.25, 4, 1),
    rotation: number(candidate.rotation, -180, 180, 0),
    blur: number(candidate.blur, 0, 40, 0),
    shadow: number(candidate.shadow, 0, 60, 0),
    text: typeof candidate.text === 'string' ? candidate.text.slice(0, 500) : '텍스트를 입력하세요',
    textHtml: typeof candidate.textHtml === 'string' ? candidate.textHtml.slice(0, 5000) : undefined,
    fontPreset: toFontPreset(candidate.fontPreset),
    fontSize: number(candidate.fontSize, 10, 180, 28),
    fontWeight: number(candidate.fontWeight, 100, 900, 400),
    lineHeight: number(candidate.lineHeight, 0.8, 2.4, 1.4),
    tracking: number(candidate.tracking, -8, 30, 0),
    color: validColor(candidate.color, '#ffffff'),
    textAlign: candidate.textAlign ?? 'left',
    italic: candidate.italic === true,
    underline: candidate.underline === true,
    stroke: number(candidate.stroke, 0, 12, 0),
    strokeColor: validColor(candidate.strokeColor, '#000000'),
  }
}

function normalizeUserImageLayer(candidate: EditorialLayer): EditorialLayer {
  return {
    id: typeof candidate.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(candidate.id) ? candidate.id : `img-${Date.now()}`,
    type: 'sticker',
    name: typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : '이미지',
    visible: candidate.visible !== false,
    locked: false,
    opacity: number(candidate.opacity, 0, 100, 100),
    zIndex: number(candidate.zIndex, 0, 1000, 75),
    x: number(candidate.x, 0, 1080, 100),
    y: number(candidate.y, 0, 1350, 200),
    width: number(candidate.width, 16, 1080, 400),
    height: number(candidate.height, 16, 1350, 400),
    scale: number(candidate.scale, 0.25, 4, 1),
    rotation: number(candidate.rotation, -180, 180, 0),
    blur: number(candidate.blur, 0, 40, 0),
    shadow: number(candidate.shadow, 0, 60, 0),
    borderRadius: number(candidate.borderRadius, 0, 50, 0),
    edgeFade: number(candidate.edgeFade, 0, 80, 0),
    imageUrl: typeof candidate.imageUrl === 'string' ? candidate.imageUrl.slice(0, 4096) : null,
  }
}

export function layerByType(document: EditorialDocument, type: EditorialLayer['type']) {
  return document.layers.find(item => item.type === type)
}

export function applyBrandStyleMemory(document: EditorialDocument, rawPreferences?: string | null) {
  if (!rawPreferences) return document
  try {
    const preferences = JSON.parse(rawPreferences) as Partial<{
      typographyPreset: TypographyPreset
      overlay: EditorialDocument['overlay']
      titleStyle: Partial<EditorialLayer>
      subtitleStyle: Partial<EditorialLayer>
    }>
    return normalizeDocument({
      ...document,
      typographyPreset: preferences.typographyPreset || document.typographyPreset,
      // New slides always start fully darkened; stored style memory must not lower the default.
      overlay: { ...document.overlay, ...preferences.overlay, darkness: 100 },
      layers: document.layers.map(layerItem => {
        if (layerItem.type === 'title') return { ...layerItem, ...preferences.titleStyle, text: layerItem.text }
        if (layerItem.type === 'subtitle') return { ...layerItem, ...preferences.subtitleStyle, text: layerItem.text }
        return layerItem
      }),
    })
  } catch {
    return document
  }
}

export function serializeBrandStyleMemory(document: EditorialDocument) {
  const pickStyle = (type: EditorialLayer['type']) => {
    const value = layerByType(document, type)
    if (!value) return {}
    const { fontPreset, fontSize, fontWeight, lineHeight, tracking, color, shadow, stroke, strokeColor } = value
    return { fontPreset, fontSize, fontWeight, lineHeight, tracking, color, shadow, stroke, strokeColor }
  }
  return JSON.stringify({
    typographyPreset: document.typographyPreset,
    overlay: document.overlay,
    titleStyle: pickStyle('title'),
    subtitleStyle: pickStyle('subtitle'),
  })
}
function layer(type: EditorialLayer['type'], name: string, zIndex: number, overrides: Partial<EditorialLayer>): EditorialLayer {
  return {
    id: type,
    type,
    name,
    visible: true,
    locked: false,
    opacity: 100,
    zIndex,
    x: 0,
    y: 0,
    width: 1080,
    height: 1350,
    scale: 1,
    rotation: 0,
    blur: 0,
    shadow: 0,
    animation: { type: 'none', duration: 400, delay: 0 },
    ...overrides,
  }
}

function normalizeLayer(candidate: EditorialLayer, fallback: EditorialLayer, index: number): EditorialLayer {
  return {
    ...fallback,
    ...candidate,
    id: fallback.id,
    type: fallback.type,
    name: typeof candidate.name === 'string' ? candidate.name.slice(0, 40) : fallback.name,
    text: typeof candidate.text === 'string' ? candidate.text.slice(0, 500) : fallback.text,
    textHtml: typeof candidate.textHtml === 'string' ? candidate.textHtml.slice(0, 5000) : fallback.textHtml,
    imageUrl: typeof candidate.imageUrl === 'string' ? candidate.imageUrl.slice(0, 4096) : fallback.imageUrl,
    visible: candidate.visible !== false,
    locked: candidate.locked === true,
    opacity: number(candidate.opacity, 0, 100, fallback.opacity),
    zIndex: number(candidate.zIndex, 0, 1000, fallback.zIndex + index),
    x: number(candidate.x, 0, 1080, fallback.x),
    y: number(candidate.y, 0, 1350, fallback.y),
    width: number(candidate.width, 16, 1080, fallback.width),
    height: number(candidate.height, 16, 1350, fallback.height),
    scale: number(candidate.scale, 0.25, 4, fallback.scale),
    rotation: number(candidate.rotation, -180, 180, fallback.rotation),
    blur: number(candidate.blur, 0, 40, fallback.blur),
    shadow: number(candidate.shadow, 0, 60, fallback.shadow),
    fontPreset: toFontPreset(candidate.fontPreset || fallback.fontPreset),
    fontSize: number(candidate.fontSize, 10, 180, fallback.fontSize || 24),
    fontWeight: number(candidate.fontWeight, 100, 900, fallback.fontWeight || 400),
    lineHeight: number(candidate.lineHeight, 0.8, 2.4, fallback.lineHeight || 1.2),
    tracking: number(candidate.tracking, -8, 30, fallback.tracking || 0),
    color: validColor(candidate.color, fallback.color || '#ffffff'),
    textAlign: candidate.textAlign === 'center' || candidate.textAlign === 'right' || candidate.textAlign === 'left'
      ? candidate.textAlign
      : fallback.textAlign,
    italic: candidate.italic === true,
    underline: candidate.underline === true,
    stroke: number(candidate.stroke, 0, 12, fallback.stroke || 0),
    strokeColor: validColor(candidate.strokeColor, fallback.strokeColor || '#000000'),
    textBackground: typeof candidate.textBackground === 'string'
      ? validColor(candidate.textBackground, fallback.textBackground || '#000000')
      : fallback.textBackground,
  }
}

function toFontPreset(input?: string | null): FontPreset {
  if (input === 'sans') return 'pretendard'
  return FONT_PRESETS.includes(input as FontPreset) ? input as FontPreset : 'pretendard'
}

function number(value: number | undefined, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function validColor(value: string | null | undefined, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}
