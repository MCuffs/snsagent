import prisma from '../db'
import {
  type CardTemplateConfig,
  type CardTemplateRecord,
  type CardTemplateTags,
  type TemplateSlideConfig,
  emptyTags,
  makeDefaultTemplateConfig,
  slideConfigSchema,
  tagsSchema,
} from './types'

type CardTemplateRow = {
  id: string
  name: string
  description: string | null
  slideCount: number
  status: string
  isDefault: boolean
  slides: string
  tags: string
  createdAt: Date
  updatedAt: Date
}

function decodeSlides(raw: string): TemplateSlideConfig[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s) => slideConfigSchema.safeParse(s))
      .filter((r): r is { success: true; data: TemplateSlideConfig } => r.success)
      .map((r) => r.data)
  } catch {
    return []
  }
}

function decodeTags(raw: string): CardTemplateTags {
  try {
    const parsed = tagsSchema.partial().safeParse(JSON.parse(raw))
    if (!parsed.success) return emptyTags()
    return { ...emptyTags(), ...parsed.data }
  } catch {
    return emptyTags()
  }
}

export function toRecord(row: CardTemplateRow): CardTemplateRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    slideCount: row.slideCount,
    status: row.status === 'draft' ? 'draft' : 'active',
    isDefault: row.isDefault,
    slides: decodeSlides(row.slides),
    tags: decodeTags(row.tags),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listCardTemplates(): Promise<CardTemplateRecord[]> {
  const rows = await prisma.cardTemplate.findMany({ orderBy: { updatedAt: 'desc' } })
  return rows.map(toRecord)
}

export async function getCardTemplate(id: string): Promise<CardTemplateRecord | null> {
  const row = await prisma.cardTemplate.findUnique({ where: { id } })
  return row ? toRecord(row) : null
}

/** Active templates matching a given slide count — the candidate pool for AI selection. */
export async function listActiveCardTemplates(slideCount?: number): Promise<CardTemplateRecord[]> {
  const rows = await prisma.cardTemplate.findMany({
    where: { status: 'active', ...(slideCount ? { slideCount } : {}) },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(toRecord)
}

export async function createCardTemplate(input: {
  name: string
  description?: string | null
  config: CardTemplateConfig
  status?: 'active' | 'draft'
}): Promise<CardTemplateRecord> {
  const row = await prisma.cardTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      slideCount: input.config.slideCount,
      status: input.status ?? 'draft',
      slides: JSON.stringify(input.config.slides),
      tags: JSON.stringify(input.config.tags),
    },
  })
  return toRecord(row)
}

export async function updateCardTemplate(id: string, input: {
  name: string
  description?: string | null
  config: CardTemplateConfig
  status: 'active' | 'draft'
}): Promise<CardTemplateRecord> {
  const row = await prisma.cardTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      slideCount: input.config.slideCount,
      status: input.status,
      slides: JSON.stringify(input.config.slides),
      tags: JSON.stringify(input.config.tags),
    },
  })
  return toRecord(row)
}

export async function duplicateCardTemplate(id: string): Promise<CardTemplateRecord | null> {
  const source = await prisma.cardTemplate.findUnique({ where: { id } })
  if (!source) return null
  const row = await prisma.cardTemplate.create({
    data: {
      name: `${source.name} (복사본)`,
      description: source.description,
      slideCount: source.slideCount,
      status: 'draft', // duplicates start as draft to avoid accidental activation
      isDefault: false,
      slides: source.slides,
      tags: source.tags,
    },
  })
  return toRecord(row)
}

export async function deleteCardTemplate(id: string): Promise<void> {
  await prisma.cardTemplate.delete({ where: { id } })
}

export { makeDefaultTemplateConfig }
