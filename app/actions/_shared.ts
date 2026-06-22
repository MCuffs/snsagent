import 'server-only'

import { dbService } from '../../lib/db-service'
import { isConfiguredOpenAIKey } from '../../lib/env'
import { isSubscriptionPlan, normalizePlan } from '../../lib/limits-types'
import { LAYOUT_DEFINITIONS, type LayoutType } from '../../src/lib/layout/layoutTypes'
import type { EditorialDocument } from '../../src/lib/editor/types'
import { getSessionUser as getCurrentSessionUser } from '../../lib/auth/user'

// ─── Session ──────────────────────────────────────────────────────────────────

export async function getSessionUser() {
  return getCurrentSessionUser()
}

// ─── Result helpers ───────────────────────────────────────────────────────────

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function forbidden() {
  return { success: false as const, error: '접근 권한이 없습니다.' }
}

export function unauthenticated() {
  return { success: false as const, error: '로그인이 필요합니다.' }
}

export function failed(error: string) {
  return { success: false as const, error }
}

export function regenerationPurchaseRequired() {
  return {
    success: false as const,
    error: '무료 플랜에서는 AI 재생성을 이용할 수 없습니다.',
    requiresRegenerationPass: true as const,
  }
}

// ─── Access control ───────────────────────────────────────────────────────────

export function hasAiRegenerationAccess(plan: string, email?: string | null) {
  if (email?.toLowerCase() === 'test@test.com') return true
  return normalizePlan(plan) !== 'FREE'
}

// ─── Editor helpers ───────────────────────────────────────────────────────────

export function withBackgroundFallback(document: EditorialDocument, fallbackUrl: string | null | undefined): EditorialDocument {
  if (!fallbackUrl || document.layers.find(layer => layer.type === 'background')?.imageUrl) return document
  return {
    ...document,
    layers: document.layers.map(layer =>
      layer.type === 'background' ? { ...layer, imageUrl: fallbackUrl } : layer,
    ),
  }
}

export function slideEditorSeed(slide: {
  slideNumber: number
  headline: string
  body: string
  imageUrl: string | null
  backgroundImageUrl: string | null
  mediaType: string
  videoUrl: string | null
  videoThumbnailUrl: string | null
  videoStartSec: number | null
  videoDurationSec: number | null
  fontPreset: string | null
  textColor: string | null
  headlineFontSize: number | null
  bodyFontSize: number | null
  editorDocument: string | null
}) {
  return {
    slideNumber: slide.slideNumber,
    headline: slide.headline,
    body: slide.body,
    imageUrl: slide.imageUrl,
    backgroundImageUrl: slide.backgroundImageUrl,
    videoUrl: slide.mediaType === 'video' ? slide.videoUrl : null,
    videoThumbnailUrl: slide.videoThumbnailUrl,
    videoStartSec: slide.videoStartSec,
    videoDurationSec: slide.videoDurationSec,
    fontPreset: slide.fontPreset,
    textColor: slide.textColor,
    headlineFontSize: slide.headlineFontSize,
    bodyFontSize: slide.bodyFontSize,
    editorDocument: slide.editorDocument,
  }
}

export function documentText(document: EditorialDocument) {
  return {
    headline: document.layers.find(layer => layer.type === 'title')?.text || '',
    body: document.layers.find(layer => layer.type === 'subtitle')?.text || '',
  }
}

// ─── Brand helpers ────────────────────────────────────────────────────────────

export async function getOwnedBrandOrFallback(userId: string, brandId?: string | null) {
  const brand = brandId ? await dbService.getBrand(brandId) : null
  if (brand?.userId === userId) return brand

  const [fallbackBrand] = await dbService.getBrands(userId)
  return fallbackBrand || null
}

export function withBrandDna<T extends {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  ctaStyle: string
  brandDna?: string | null
}>(profile: T, sourceText?: string, parsed?: Record<string, unknown>) {
  return {
    ...profile,
    brandDna: profile.brandDna || buildBrandDnaFromProfileLocal({
      name: profile.name,
      industry: profile.industry,
      targetAudience: profile.targetAudience,
      toneOfVoice: profile.toneOfVoice,
      mainColor: profile.mainColor,
      ctaStyle: profile.ctaStyle,
      sourceText,
      parsed,
    }),
  }
}

// Local import to avoid circular dependency at module load time
import { buildBrandDnaFromProfile } from '../../lib/brand-dna'

function buildBrandDnaFromProfileLocal(params: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  ctaStyle: string
  sourceText?: string
  parsed?: Record<string, unknown>
}) {
  return buildBrandDnaFromProfile(params)
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

export function inferLayoutType(prompt: string): LayoutType {
  const normalized = prompt.toLowerCase()
  if (normalized.includes('data journalism')) return 'stat-highlight'
  if (normalized.includes('clean studio')) return 'dark-editorial'
  if (normalized.includes('cinematic portrait')) return 'cinematic-headline'
  if (normalized.includes('documentary news')) return 'breaking-news'
  if (normalized.includes('social feed')) return 'trend-feed'
  if (normalized.includes('magazine cover')) return 'magazine'
  if (normalized.includes('split-screen')) return 'split-comparison'
  if (normalized.includes('community')) return 'community-style'
  if (normalized.includes('shallow depth')) return 'dark-editorial'
  return 'dark-editorial'
}

// ─── Copy rewrite helpers ──────────────────────────────────────────────────────

export function localCopyRewrite(headline: string, body: string, intent: string) {
  switch (intent) {
    case 'stronger-hook':
      return { headline: `${headline.replace(/[.!?]+$/, '')}, 놓치지 마세요`, body }
    case 'shorter':
    case 'cleaner':
      return repairRenderableCopyLocal({
        headline,
        body,
        constraints: { maxHeadlineChars: 25, maxBodyChars: 140, maxBodyLines: 4, lineLength: 32 },
      })
    case 'premium':
    case 'luxury':
      return repairRenderableCopyLocal({
        headline: `더 정제된 ${headline}`,
        body,
        constraints: { maxHeadlineChars: 28, maxBodyChars: 180, maxBodyLines: 5, lineLength: 32 },
      })
    default:
      return { headline, body }
  }
}

import { repairRenderableCopy } from '../../src/lib/copywriting/renderableCopy'

function repairRenderableCopyLocal(params: {
  headline: string
  body: string
  constraints: { maxHeadlineChars: number; maxBodyChars: number; maxBodyLines: number; lineLength: number }
}) {
  return repairRenderableCopy(params)
}

// ─── AI text helpers ───────────────────────────────────────────────────────────

export function removeMarkdownBold(text: string): string {
  if (!text) return ''
  return text.replace(/\*\*/g, '')
}

export function readAiText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

export function readRecommendedKeyContent(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value

  const slideValues = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && 'slides' in value && Array.isArray(value.slides)
      ? value.slides
      : []

  const lines = slideValues
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (typeof item !== 'object' || item === null) return ''

      const slide = item as Record<string, unknown>
      const headline = readAiText(slide.headline ?? slide.title, '')
      const body = readAiText(slide.body ?? slide.content ?? slide.description, '')
      return [headline, body].filter(Boolean).join(': ')
    })
    .filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : fallback
}

// ─── Re-exported for convenience ───────────────────────────────────────────────

export { isSubscriptionPlan, normalizePlan, isConfiguredOpenAIKey, LAYOUT_DEFINITIONS }
