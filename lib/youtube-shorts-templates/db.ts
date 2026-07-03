import prisma from '../db'
import {
  makeDefaultShortsTemplate,
  shortsTemplateConfigSchema,
  type ShortsTemplateConfig,
  type ShortsTemplateInput,
  type YouTubeShortsTemplateRecord,
} from './types'
import { applyHookPreset, type HookDesign } from './hook-presets'

type Row = Awaited<ReturnType<typeof prisma.youTubeShortsTemplate.findFirstOrThrow>>

function decodeConfig(row: Row): ShortsTemplateConfig {
  const rawHeader = JSON.parse(row.headerStyle) as Record<string, unknown>
  return shortsTemplateConfigSchema.parse({
    layout: JSON.parse(row.layoutConfig),
    headerStyle: rawHeader,
    hookDesign: rawHeader.hookDesign ?? {},
    captionStyle: JSON.parse(row.captionStyle),
    videoRules: JSON.parse(row.videoRules),
    cta: JSON.parse(row.ctaConfig),
    aiMatching: JSON.parse(row.aiMatchingConfig),
    overlays: JSON.parse(row.overlayConfig),
  })
}

export function toShortsTemplateRecord(row: Row): YouTubeShortsTemplateRecord {
  return {
    id: row.id,
    templateName: row.templateName,
    templateKey: row.templateKey,
    category: row.category,
    description: row.description,
    isActive: row.isActive,
    isDefault: row.isDefault,
    config: decodeConfig(row),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function configData(config: ShortsTemplateConfig) {
  return {
    layoutConfig: JSON.stringify(config.layout),
    headerStyle: JSON.stringify({ ...config.headerStyle, hookDesign: config.hookDesign }),
    captionStyle: JSON.stringify(config.captionStyle),
    videoRules: JSON.stringify(config.videoRules),
    ctaConfig: JSON.stringify(config.cta),
    aiMatchingConfig: JSON.stringify(config.aiMatching),
    overlayConfig: JSON.stringify(config.overlays),
  }
}

export async function ensureDefaultShortsTemplate() {
  const current = await prisma.youTubeShortsTemplate.findFirst({
    where: { isDefault: true, isActive: true },
  })
  if (current) return toShortsTemplateRecord(current)
  const defaults = makeDefaultShortsTemplate()
  const row = await prisma.$transaction(async tx => {
    await tx.youTubeShortsTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    return tx.youTubeShortsTemplate.upsert({
      where: { templateKey: defaults.templateKey },
      update: { isActive: true, isDefault: true },
      create: {
        templateName: defaults.templateName,
        templateKey: defaults.templateKey,
        category: defaults.category,
        description: defaults.description,
        isActive: true,
        isDefault: true,
        ...configData(defaults.config),
      },
    })
  })
  return toShortsTemplateRecord(row)
}

const BUILT_IN_HOOK_TEMPLATES: Array<{
  key: string
  name: string
  category: string
  preset: HookDesign['preset']
  contentTypes: ShortsTemplateConfig['aiMatching']['contentTypes']
  tones: Array<'emotional' | 'serious' | 'funny' | 'informative' | 'dramatic' | 'neutral'>
  hookOverrides?: Partial<HookDesign>
  layoutOverrides?: Partial<ShortsTemplateConfig['layout']>
  captionOverrides?: Partial<ShortsTemplateConfig['captionStyle']>
  overlayOverrides?: Partial<ShortsTemplateConfig['overlays']>
}> = [
  { key: 'breaking_news', name: 'Breaking News', category: 'news', preset: 'breaking_news', contentTypes: ['news', 'sports'], tones: ['serious', 'informative'] },
  { key: 'drama_archive', name: 'Drama Archive', category: 'drama_highlight', preset: 'drama_archive', contentTypes: ['drama_highlight'], tones: ['emotional', 'dramatic'] },
  { key: 'knowledge_bold', name: 'Knowledge Bold', category: 'knowledge', preset: 'knowledge_bold', contentTypes: ['knowledge'], tones: ['informative', 'serious'] },
  { key: 'entertainment_feed', name: 'Entertainment Feed', category: 'entertainment', preset: 'entertainment_feed', contentTypes: ['entertainment'], tones: ['funny', 'neutral'] },
  { key: 'anime_editorial', name: 'Anime Editorial', category: 'anime', preset: 'anime_editorial', contentTypes: ['anime'], tones: ['dramatic', 'emotional'] },
  {
    key: 'sports_scoreboard',
    name: 'Sports Scoreboard',
    category: 'sports',
    preset: 'breaking_news',
    contentTypes: ['sports'],
    tones: ['serious', 'dramatic'],
    hookOverrides: { emphasisColor: '#F7E733', backgroundGradientStart: '#071B18', backgroundGradientEnd: '#123B32', categoryBadgeEnabled: true },
    captionOverrides: { captionColor: '#FFFFFF', captionStrokeColor: '#071B18', captionFontSize: 78 },
  },
  {
    key: 'knowledge_comment',
    name: 'Knowledge Comment',
    category: 'knowledge',
    preset: 'knowledge_bold',
    contentTypes: ['knowledge'],
    tones: ['informative', 'neutral'],
    hookOverrides: { emphasisColor: '#1AFF36', fontSize: 86 },
    layoutOverrides: { headerHeight: 23, videoAreaHeight: 57, footerHeight: 20 },
    overlayOverrides: { commentCardEnabled: true },
  },
  {
    key: 'drama_quote',
    name: 'Drama Quote',
    category: 'drama_highlight',
    preset: 'drama_archive',
    contentTypes: ['drama_highlight'],
    tones: ['emotional', 'dramatic'],
    hookOverrides: { emphasisColor: '#E32620', quoteEnabled: true, fontSize: 82 },
    captionOverrides: { captionBackgroundEnabled: true, captionBackgroundColor: '#000000', captionFontSize: 68 },
  },
  {
    key: 'entertainment_neon',
    name: 'Entertainment Neon',
    category: 'entertainment',
    preset: 'entertainment_feed',
    contentTypes: ['entertainment'],
    tones: ['funny', 'dramatic'],
    hookOverrides: { emphasisColor: '#FF3BCD', backgroundType: 'gradient', backgroundGradientStart: '#170C24', backgroundGradientEnd: '#321A46', textColor: '#FFFFFF' },
    captionOverrides: { captionColor: '#1AFF36', captionStrokeColor: '#000000', captionFontSize: 80 },
  },
  {
    key: 'anime_impact',
    name: 'Anime Impact',
    category: 'anime',
    preset: 'anime_editorial',
    contentTypes: ['anime'],
    tones: ['dramatic', 'emotional'],
    hookOverrides: { backgroundColor: '#FFF8EA', emphasisColor: '#D34A2C', fontSize: 76 },
    layoutOverrides: { headerHeight: 22, videoAreaHeight: 60, footerHeight: 18 },
  },
]

export async function ensureBuiltInShortsTemplates() {
  const fallback = await ensureDefaultShortsTemplate()
  for (const seed of BUILT_IN_HOOK_TEMPLATES) {
    const exists = await prisma.youTubeShortsTemplate.findUnique({ where: { templateKey: seed.key } })
    if (exists) continue
    const presetHook = applyHookPreset(fallback.config.hookDesign, seed.preset)
    const config: ShortsTemplateConfig = {
      ...fallback.config,
      hookDesign: { ...presetHook, ...seed.hookOverrides },
      layout: { ...fallback.config.layout, ...seed.layoutOverrides },
      captionStyle: { ...fallback.config.captionStyle, ...seed.captionOverrides },
      overlays: { ...fallback.config.overlays, ...seed.overlayOverrides },
      aiMatching: {
        ...fallback.config.aiMatching,
        matchingCategories: [seed.category],
        contentTypes: seed.contentTypes,
        tones: seed.tones,
        fallbackPriority: 50,
        minimumConfidenceScore: 0.62,
      },
    }
    await prisma.youTubeShortsTemplate.create({
      data: {
        templateName: seed.name,
        templateKey: seed.key,
        category: seed.category,
        description: `Built-in ${seed.name} hook design preset.`,
        isActive: true,
        isDefault: false,
        ...configData(config),
      },
    }).catch(() => undefined)
  }
  return fallback
}

export async function listShortsTemplates(activeOnly = false) {
  const rows = await prisma.youTubeShortsTemplate.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
  return rows.map(toShortsTemplateRecord)
}

export async function getShortsTemplate(id: string) {
  const row = await prisma.youTubeShortsTemplate.findUnique({ where: { id } })
  return row ? toShortsTemplateRecord(row) : null
}

export async function saveShortsTemplate(input: ShortsTemplateInput, id?: string) {
  const row = await prisma.$transaction(async tx => {
    if (input.isDefault) {
      await tx.youTubeShortsTemplate.updateMany({
        where: { isDefault: true, ...(id ? { NOT: { id } } : {}) },
        data: { isDefault: false },
      })
    }
    const data = {
      templateName: input.templateName,
      templateKey: input.templateKey,
      category: input.category,
      description: input.description ?? null,
      isActive: input.isActive,
      isDefault: input.isDefault,
      ...configData(input.config),
    }
    return id
      ? tx.youTubeShortsTemplate.update({ where: { id }, data: { ...data, version: { increment: 1 } } })
      : tx.youTubeShortsTemplate.create({ data })
  })
  await ensureDefaultShortsTemplate()
  return toShortsTemplateRecord(row)
}

export async function setDefaultShortsTemplate(id: string) {
  return prisma.$transaction(async tx => {
    const target = await tx.youTubeShortsTemplate.findUnique({ where: { id } })
    if (!target) throw new Error('Template not found.')
    await tx.youTubeShortsTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } })
    const row = await tx.youTubeShortsTemplate.update({
      where: { id },
      data: { isDefault: true, isActive: true, version: { increment: 1 } },
    })
    return toShortsTemplateRecord(row)
  })
}

export async function deleteShortsTemplate(id: string) {
  const row = await prisma.youTubeShortsTemplate.findUnique({ where: { id } })
  if (!row) return
  if (row.isDefault) throw new Error('The active default template cannot be deleted.')
  await prisma.youTubeShortsTemplate.delete({ where: { id } })
  await ensureDefaultShortsTemplate()
}
