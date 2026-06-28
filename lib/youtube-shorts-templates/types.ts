import { z } from 'zod'

export const SHORTS_CONTENT_TYPES = [
  'drama_highlight', 'news', 'knowledge', 'sports', 'anime', 'entertainment', 'default',
] as const
export const SHORTS_TONES = ['emotional', 'serious', 'funny', 'informative', 'dramatic', 'neutral'] as const
export const HOOK_DESIGN_PRESETS = [
  'breaking_news', 'drama_archive', 'knowledge_bold', 'entertainment_feed', 'anime_editorial',
] as const

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)

export const layoutConfigSchema = z.object({
  aspectRatio: z.literal('9:16').default('9:16'),
  headerEnabled: z.boolean().default(true),
  headerHeight: z.number().min(0).max(40).default(18),
  videoAreaHeight: z.number().min(20).max(100).default(62),
  footerEnabled: z.boolean().default(true),
  footerHeight: z.number().min(0).max(40).default(20),
  backgroundColor: hex.default('#ffffff'),
}).refine(v => v.headerHeight + v.videoAreaHeight + v.footerHeight <= 100, {
  message: 'Header, video and footer heights cannot exceed 100%.',
})

export const headerStyleSchema = z.object({
  headerBackgroundColor: hex.default('#ffffff'),
  headerTextColor: hex.default('#111111'),
  headerFontSize: z.number().int().min(16).max(120).default(52),
  headerFontWeight: z.number().int().min(100).max(900).default(800),
  headerTextAlign: z.enum(['left', 'center', 'right']).default('center'),
  hookTextStyle: z.enum(['plain', 'highlight', 'breaking', 'editorial']).default('highlight'),
})

export const hookDesignSchema = z.object({
  preset: z.enum(HOOK_DESIGN_PRESETS).default('knowledge_bold'),
  fontFamily: z.enum(['Pretendard', 'Pretendard ExtraBold', 'Pretendard Black']).default('Pretendard Black'),
  fontSize: z.number().int().min(32).max(140).default(88),
  fontWeight: z.number().int().min(400).max(900).default(900),
  lineHeight: z.number().min(0.8).max(1.6).default(1.08),
  letterSpacing: z.number().min(-10).max(20).default(-3),
  maxLines: z.number().int().min(1).max(3).default(2),
  textColor: hex.default('#080808'),
  emphasisColor: hex.default('#16E0E8'),
  secondaryColor: hex.default('#FFFFFF'),
  strokeEnabled: z.boolean().default(false),
  strokeColor: hex.default('#000000'),
  strokeWidth: z.number().min(0).max(10).default(0),
  shadowEnabled: z.boolean().default(false),
  shadowColor: hex.default('#000000'),
  shadowBlur: z.number().min(0).max(30).default(0),
  shadowOffsetY: z.number().min(-10).max(30).default(0),
  backgroundType: z.enum(['solid', 'gradient', 'transparent']).default('solid'),
  backgroundColor: hex.default('#FFFFFF'),
  backgroundGradientStart: hex.default('#071127'),
  backgroundGradientEnd: hex.default('#101D3C'),
  paddingX: z.number().int().min(20).max(180).default(72),
  paddingY: z.number().int().min(10).max(160).default(42),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
  quoteEnabled: z.boolean().default(false),
  profileHeaderEnabled: z.boolean().default(false),
  categoryBadgeEnabled: z.boolean().default(false),
})

export const captionStyleSchema = z.object({
  captionPosition: z.enum(['top', 'center', 'bottom']).default('bottom'),
  captionFontFamily: z.string().trim().min(1).max(80).default('Pretendard'),
  captionFontSize: z.number().int().min(20).max(140).default(72),
  captionFontWeight: z.number().int().min(100).max(900).default(800),
  captionColor: hex.default('#ffffff'),
  captionStrokeColor: hex.default('#000000'),
  captionBackgroundEnabled: z.boolean().default(false),
  captionBackgroundColor: hex.default('#000000'),
  captionMaxLines: z.number().int().min(1).max(5).default(2),
  captionMaxCharacters: z.number().int().min(5).max(60).default(20),
})

export const videoRulesSchema = z.object({
  totalDuration: z.number().min(5).max(180).default(45),
  sceneDurationMin: z.number().min(0.5).max(30).default(1.5),
  sceneDurationMax: z.number().min(1).max(60).default(3),
  transitionType: z.enum(['cut', 'fade', 'slide', 'zoom']).default('cut'),
  zoomEffect: z.enum(['none', 'slow_zoom', 'zoom_in', 'zoom_out']).default('slow_zoom'),
  cutSpeed: z.enum(['slow', 'medium', 'fast']).default('fast'),
  bgmMood: z.string().trim().max(60).default('energetic'),
}).refine(v => v.sceneDurationMin < v.sceneDurationMax, {
  message: 'Minimum scene duration must be less than maximum scene duration.',
})

export const ctaConfigSchema = z.object({
  ctaEnabled: z.boolean().default(true),
  ctaText: z.string().trim().max(100).default('Subscribe for more'),
  ctaDuration: z.number().min(0).max(15).default(2),
  ctaPosition: z.enum(['top', 'center', 'bottom']).default('bottom'),
})

export const aiMatchingConfigSchema = z.object({
  matchingCategories: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  matchingKeywords: z.array(z.string().trim().min(1).max(40)).max(50).default([]),
  contentTypes: z.array(z.enum(SHORTS_CONTENT_TYPES)).max(SHORTS_CONTENT_TYPES.length).default([]),
  tones: z.array(z.enum(SHORTS_TONES)).max(SHORTS_TONES.length).default([]),
  fallbackPriority: z.number().int().min(0).max(100).default(0),
  minimumConfidenceScore: z.number().min(0).max(1).default(0.65),
})

export const overlayConfigSchema = z.object({
  channelIdentityEnabled: z.boolean().default(true),
  sourceLabelEnabled: z.boolean().default(false),
  commentCardEnabled: z.boolean().default(false),
  watermarkEnabled: z.boolean().default(false),
})

export const shortsTemplateConfigSchema = z.object({
  layout: layoutConfigSchema,
  headerStyle: headerStyleSchema,
  hookDesign: hookDesignSchema.optional().transform(value => hookDesignSchema.parse(value ?? {})),
  captionStyle: captionStyleSchema,
  videoRules: videoRulesSchema,
  cta: ctaConfigSchema,
  aiMatching: aiMatchingConfigSchema,
  overlays: overlayConfigSchema,
})

export const shortsTemplateInputSchema = z.object({
  templateName: z.string().trim().min(1).max(80),
  templateKey: z.string().trim().regex(/^[a-z0-9_]+$/).max(80),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  config: shortsTemplateConfigSchema,
}).refine(v => !v.isDefault || v.isActive, {
  message: 'The default template must be active.',
  path: ['isActive'],
})

export const classifierResultSchema = z.object({
  contentType: z.enum(SHORTS_CONTENT_TYPES),
  tone: z.enum(SHORTS_TONES),
  recommendedTemplateKey: z.string().trim().max(80).nullable(),
  confidenceScore: z.number().min(0).max(1),
  reason: z.string().trim().max(300),
})

export type ShortsTemplateConfig = z.infer<typeof shortsTemplateConfigSchema>
export type ShortsTemplateInput = z.infer<typeof shortsTemplateInputSchema>
export type ShortsClassifierResult = z.infer<typeof classifierResultSchema>

export interface YouTubeShortsTemplateRecord extends ShortsTemplateInput {
  id: string
  version: number
  createdAt: string
  updatedAt: string
}

export function makeDefaultShortsTemplate(): ShortsTemplateInput {
  return shortsTemplateInputSchema.parse({
    templateName: 'Basic Viral Shorts',
    templateKey: 'basic_viral_shorts',
    category: 'default',
    description: 'Fallback template used when content classification is uncertain.',
    isActive: true,
    isDefault: true,
    config: {
      layout: {},
      headerStyle: {},
      hookDesign: {},
      captionStyle: {},
      videoRules: {},
      cta: {},
      aiMatching: {
        matchingCategories: ['default'],
        contentTypes: ['default'],
        fallbackPriority: 100,
      },
      overlays: {},
    },
  })
}
