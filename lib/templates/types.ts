import { z } from 'zod'

// ── Card template configuration ───────────────────────────────────────────────
// Admin-authored, AI-selected carousel templates. The config below is intentionally
// renderer-agnostic; `lib/templates/applyToRender.ts` maps it onto the generation
// pipeline's LayoutDefinition / TypographyPlan / OverlayPlan.

export const TEXT_POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const
export type TextPosition = (typeof TEXT_POSITIONS)[number]

export const OVERLAY_TYPES = ['none', 'dark', 'light', 'gradient', 'custom'] as const
export type OverlayType = (typeof OVERLAY_TYPES)[number]

export const CONTENT_ALIGNMENTS = ['left', 'center', 'right'] as const
export type ContentAlignment = (typeof CONTENT_ALIGNMENTS)[number]

export const CROP_STYLES = ['cover', 'contain', 'top', 'center', 'bottom'] as const
export type CropStyle = (typeof CROP_STYLES)[number]

export const SUPPORTED_SLIDE_COUNTS = [5, 7] as const
export type SupportedSlideCount = (typeof SUPPORTED_SLIDE_COUNTS)[number]

export const CARD_TEMPLATE_DOMAINS = [
  'fashion', 'food', 'beauty', 'living', 'tech', 'health',
  'news', 'finance', 'commerce', 'education', 'travel', 'general',
] as const
export type CardTemplateDomain = (typeof CARD_TEMPLATE_DOMAINS)[number]

export interface TemplateTypography {
  fontSize: number        // headline font size (px @ 1080x1350)
  fontWeight: number      // 100–900
  lineHeight: number      // multiplier (e.g. 1.1)
  letterSpacing: number   // px
  textColor: string       // hex
  bodyFontSize?: number
  bodyColor?: string
  emphasisColor?: string
}

export interface TemplateOverlay {
  type: OverlayType
  opacity: number         // 0–100
  customColor?: string    // hex, used when type === 'custom'
}

export interface TemplateLayout {
  contentWidth: number    // % of canvas width (10–100)
  contentAlignment: ContentAlignment
  paddingX: number        // px
  paddingY: number        // px
}

export interface TemplateBackground {
  imageStyle: string      // free-text hint for the image prompt (e.g. "muted editorial photo")
  cropStyle: CropStyle
  blur: number            // 0–30
}

export interface TemplateSlideConfig {
  slideNumber: number
  label: string           // e.g. "Hero Title", "Quote", "CTA"
  textPosition: TextPosition
  typography: TemplateTypography
  overlay: TemplateOverlay
  layout: TemplateLayout
  background: TemplateBackground
}

export interface CardTemplateTags {
  domain: CardTemplateDomain[]
  emotion: string[]
  industry: string[]
  style: string[]
  visualTone: string[]
}

export interface CardTemplateConfig {
  slideCount: SupportedSlideCount
  slides: TemplateSlideConfig[]
  tags: CardTemplateTags
}

// Shape returned to the admin UI / consumers (DB row decoded).
export interface CardTemplateRecord {
  id: string
  name: string
  description: string | null
  slideCount: number
  status: 'active' | 'draft'
  isDefault: boolean
  slides: TemplateSlideConfig[]
  tags: CardTemplateTags
  createdAt: string
  updatedAt: string
}

// ── Zod validation ────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const typographySchema = z.object({
  fontSize: z.number().min(12).max(220),
  fontWeight: z.number().int().min(100).max(900),
  lineHeight: z.number().min(0.8).max(2.4),
  letterSpacing: z.number().min(-10).max(40),
  textColor: z.string().regex(HEX),
  bodyFontSize: z.number().min(12).max(120).optional(),
  bodyColor: z.string().regex(HEX).optional(),
  emphasisColor: z.string().regex(HEX).optional(),
})

export const overlaySchema = z.object({
  type: z.enum(OVERLAY_TYPES),
  opacity: z.number().min(0).max(100),
  customColor: z.string().regex(HEX).optional(),
})

export const layoutSchema = z.object({
  contentWidth: z.number().min(10).max(100),
  contentAlignment: z.enum(CONTENT_ALIGNMENTS),
  paddingX: z.number().min(0).max(400),
  paddingY: z.number().min(0).max(600),
})

export const backgroundSchema = z.object({
  imageStyle: z.string().max(200),
  cropStyle: z.enum(CROP_STYLES),
  blur: z.number().min(0).max(30),
})

export const slideConfigSchema = z.object({
  slideNumber: z.number().int().min(1).max(20),
  label: z.string().trim().min(1).max(60),
  textPosition: z.enum(TEXT_POSITIONS),
  typography: typographySchema,
  overlay: overlaySchema,
  layout: layoutSchema,
  background: backgroundSchema,
})

export const tagsSchema = z.object({
  domain: z.array(z.enum(CARD_TEMPLATE_DOMAINS)).max(CARD_TEMPLATE_DOMAINS.length),
  emotion: z.array(z.string().trim().min(1).max(40)).max(20),
  industry: z.array(z.string().trim().min(1).max(40)).max(20),
  style: z.array(z.string().trim().min(1).max(40)).max(20),
  visualTone: z.array(z.string().trim().min(1).max(40)).max(20),
})

export const templateConfigSchema = z.object({
  slideCount: z.union([z.literal(5), z.literal(7)]),
  slides: z.array(slideConfigSchema).min(1).max(20),
  tags: tagsSchema,
}).refine((cfg) => cfg.slides.length === cfg.slideCount, {
  message: 'slides length must equal slideCount',
  path: ['slides'],
})

// ── Defaults ──────────────────────────────────────────────────────────────────

export function emptyTags(): CardTemplateTags {
  return { domain: [], emotion: [], industry: [], style: [], visualTone: [] }
}

const ROLE_PRESETS: Array<Partial<TemplateSlideConfig> & { label: string }> = [
  { label: 'Hero Title', textPosition: 'bottom-left' },
  { label: 'Editorial Detail', textPosition: 'middle-left' },
  { label: 'Quote', textPosition: 'middle-center' },
  { label: 'Statistic', textPosition: 'top-center' },
  { label: 'CTA', textPosition: 'bottom-center' },
  { label: 'Editorial Detail', textPosition: 'middle-left' },
  { label: 'CTA', textPosition: 'bottom-center' },
]

export function makeDefaultSlide(slideNumber: number): TemplateSlideConfig {
  const preset = ROLE_PRESETS[(slideNumber - 1) % ROLE_PRESETS.length]
  const isHero = slideNumber === 1
  return {
    slideNumber,
    label: preset.label,
    textPosition: preset.textPosition ?? 'bottom-left',
    typography: {
      fontSize: isHero ? 66 : 48,
      fontWeight: isHero ? 800 : 700,
      lineHeight: 1.12,
      letterSpacing: -1,
      textColor: '#ffffff',
      bodyFontSize: 28,
      bodyColor: '#ffffff',
      emphasisColor: '#ff6b35',
    },
    overlay: { type: 'dark', opacity: 55 },
    layout: {
      contentWidth: 84,
      contentAlignment: preset.textPosition?.endsWith('center') ? 'center' : 'left',
      paddingX: 72,
      paddingY: 96,
    },
    background: { imageStyle: 'muted editorial photo', cropStyle: 'cover', blur: 0 },
  }
}

export function makeDefaultTemplateConfig(slideCount: SupportedSlideCount): CardTemplateConfig {
  return {
    slideCount,
    slides: Array.from({ length: slideCount }, (_, i) => makeDefaultSlide(i + 1)),
    tags: emptyTags(),
  }
}
