/**
 * Seeds 5 example card-news templates (active) into the database.
 * Idempotent: skips a template if one with the same name already exists.
 *
 * Run: node --experimental-loader ./tests/ts-extension-loader.mjs scripts/seed-card-templates.ts
 */
import { createCardTemplate, listCardTemplates } from '../lib/templates/db'
import type {
  CardTemplateConfig, CardTemplateTags, TemplateSlideConfig, TextPosition, OverlayType,
} from '../lib/templates/types'

type SlideSpec = {
  label: string
  pos: TextPosition
  size: number
  weight: number
  color: string
  overlay: OverlayType
  opacity: number
  imageStyle: string
  customColor?: string
  tracking?: number
  lineHeight?: number
}

function mk(n: number, s: SlideSpec): TemplateSlideConfig {
  const align = s.pos.endsWith('center') ? 'center' : s.pos.endsWith('right') ? 'right' : 'left'
  return {
    slideNumber: n,
    label: s.label,
    textPosition: s.pos,
    typography: {
      fontSize: s.size,
      fontWeight: s.weight,
      lineHeight: s.lineHeight ?? 1.12,
      letterSpacing: s.tracking ?? -1,
      textColor: s.color,
    },
    overlay: { type: s.overlay, opacity: s.opacity, ...(s.customColor ? { customColor: s.customColor } : {}) },
    layout: { contentWidth: 86, contentAlignment: align, paddingX: 72, paddingY: 96 },
    background: { imageStyle: s.imageStyle, cropStyle: 'cover', blur: 0 },
  }
}

function tmpl(slides: SlideSpec[], tags: CardTemplateTags): CardTemplateConfig {
  return { slideCount: 5, slides: slides.map((s, i) => mk(i + 1, s)), tags }
}

const TEMPLATES: Array<{ name: string; description: string; config: CardTemplateConfig }> = [
  {
    name: 'Editorial Dark',
    description: '권위 있고 프리미엄한 비즈니스 톤. 어두운 시네마틱 배경에 흰색 헤드라인.',
    config: tmpl([
      { label: 'Hero Title', pos: 'bottom-left', size: 74, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 72, imageStyle: 'moody cinematic editorial photograph, deep shadows, premium business atmosphere' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 52, imageStyle: 'restrained dark editorial photograph, low detail, premium' },
      { label: 'Quote', pos: 'middle-center', size: 54, weight: 500, color: '#f5f0e8', overlay: 'dark', opacity: 60, imageStyle: 'minimal dark backdrop, single subtle object, quiet luxury' },
      { label: 'Statistic', pos: 'top-center', size: 92, weight: 800, color: '#ffd9a8', overlay: 'dark', opacity: 56, imageStyle: 'dark muted gradient backdrop, premium financial mood' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 78, imageStyle: 'deep neutral closing still life, maximum breathing room' },
    ], {
      emotion: ['authority', 'premium', 'serious', 'confidence'],
      industry: ['business', 'finance', 'b2b', 'consulting'],
      style: ['editorial', 'luxury'],
      visualTone: ['dark', 'moody'],
    }),
  },
  {
    name: 'Modern Clean',
    description: '스타트업/테크용 밝고 깔끔한 톤. 여백이 넉넉하고 또렷한 산세리프.',
    config: tmpl([
      { label: 'Hero Title', pos: 'top-left', size: 66, weight: 700, color: '#16181d', overlay: 'light', opacity: 42, imageStyle: 'clean minimal bright studio photograph, soft natural light, generous negative space' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 44, weight: 500, color: '#1c1f26', overlay: 'light', opacity: 36, imageStyle: 'bright airy product photo, clean white surface' },
      { label: 'Quote', pos: 'middle-center', size: 50, weight: 600, color: '#16181d', overlay: 'light', opacity: 40, imageStyle: 'soft gradient pastel background, minimal' },
      { label: 'Statistic', pos: 'top-center', size: 86, weight: 800, color: '#2563eb', overlay: 'light', opacity: 30, imageStyle: 'crisp bright tech backdrop, soft shadow' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#16181d', overlay: 'light', opacity: 46, imageStyle: 'clean minimal closing frame, bright and open' },
    ], {
      emotion: ['innovative', 'confident', 'optimistic'],
      industry: ['startup', 'tech', 'saas', 'app'],
      style: ['modern', 'minimal', 'clean'],
      visualTone: ['bright', 'airy'],
    }),
  },
  {
    name: 'Bright Minimal',
    description: '동기부여·교육 콘텐츠용. 밝고 따뜻하며 가운데 정렬의 차분한 구성.',
    config: tmpl([
      { label: 'Hero Title', pos: 'middle-center', size: 70, weight: 700, color: '#2a2320', overlay: 'light', opacity: 38, imageStyle: 'bright airy pastel minimal scene, soft warm morning light' },
      { label: 'Editorial Detail', pos: 'middle-center', size: 44, weight: 500, color: '#2a2320', overlay: 'light', opacity: 34, imageStyle: 'warm minimal lifestyle photo, gentle light' },
      { label: 'Quote', pos: 'middle-center', size: 52, weight: 500, color: '#7a4b2e', overlay: 'light', opacity: 30, imageStyle: 'soft warm gradient, cozy minimal' },
      { label: 'Statistic', pos: 'top-center', size: 84, weight: 800, color: '#c2682f', overlay: 'light', opacity: 32, imageStyle: 'bright warm backdrop, uplifting and clean' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#2a2320', overlay: 'light', opacity: 42, imageStyle: 'warm minimal closing frame, optimistic and open' },
    ], {
      emotion: ['optimistic', 'uplifting', 'friendly', 'calm'],
      industry: ['education', 'wellness', 'lifestyle', 'coaching'],
      style: ['minimal', 'bright', 'soft'],
      visualTone: ['bright', 'warm'],
    }),
  },
  {
    name: 'Magazine Layout',
    description: '뉴스·저널리즘 톤. 상단 키커식 헤드라인, 강한 대비, 매거진 편집 감성.',
    config: tmpl([
      { label: 'Hero Headline', pos: 'top-left', size: 68, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 70, imageStyle: 'documentary photojournalism, high contrast, editorial magazine cover', tracking: -1.5 },
      { label: 'Lead', pos: 'bottom-left', size: 44, weight: 500, color: '#ffffff', overlay: 'gradient', opacity: 66, imageStyle: 'candid documentary photograph, natural light, reportage' },
      { label: 'Quote', pos: 'middle-left', size: 52, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 58, imageStyle: 'editorial portrait, dramatic contrast' },
      { label: 'Statistic', pos: 'top-right', size: 88, weight: 800, color: '#ffe08a', overlay: 'dark', opacity: 54, imageStyle: 'newsroom backdrop, high contrast neutral tones' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 74, imageStyle: 'editorial closing frame, magazine end-page mood' },
    ], {
      emotion: ['informative', 'credible', 'bold', 'urgent'],
      industry: ['news', 'media', 'journalism', 'politics'],
      style: ['magazine', 'editorial', 'reportage'],
      visualTone: ['contrast', 'neutral'],
    }),
  },
  {
    name: 'Bold Statement',
    description: '뷰티·라이프스타일·푸드용. 큼직한 가운데 헤드라인과 강렬한 컬러.',
    config: tmpl([
      { label: 'Hero Title', pos: 'middle-center', size: 96, weight: 900, color: '#ffffff', overlay: 'custom', opacity: 40, customColor: '#7c1d6f', imageStyle: 'vibrant high-saturation lifestyle photograph, punchy color, bold mood', tracking: -2, lineHeight: 1.02 },
      { label: 'Editorial Detail', pos: 'bottom-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 50, imageStyle: 'vivid lifestyle photo, energetic, saturated tones' },
      { label: 'Quote', pos: 'middle-center', size: 60, weight: 700, color: '#fff1f6', overlay: 'gradient', opacity: 64, imageStyle: 'bold colorful gradient backdrop, playful' },
      { label: 'Statistic', pos: 'top-center', size: 104, weight: 900, color: '#ffe066', overlay: 'custom', opacity: 46, customColor: '#1a1140', imageStyle: 'vibrant bold backdrop, high energy', tracking: -2 },
      { label: 'CTA', pos: 'bottom-center', size: 52, weight: 800, color: '#ffffff', overlay: 'dark', opacity: 62, imageStyle: 'punchy closing frame, vivid color, call to action energy' },
    ], {
      emotion: ['energetic', 'bold', 'playful', 'excited'],
      industry: ['beauty', 'fashion', 'food', 'lifestyle', 'fitness'],
      style: ['bold', 'vibrant'],
      visualTone: ['vibrant', 'punchy'],
    }),
  },
]

async function main() {
  const existing = new Set((await listCardTemplates()).map((t) => t.name))
  let created = 0
  for (const t of TEMPLATES) {
    if (existing.has(t.name)) {
      console.log(`skip (exists): ${t.name}`)
      continue
    }
    const row = await createCardTemplate({ name: t.name, description: t.description, config: t.config, status: 'active' })
    created++
    console.log(`created: ${row.name} [${row.id}] — ${row.slideCount} slides, active`)
  }
  console.log(`\nDone. ${created} created, ${TEMPLATES.length - created} skipped.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED FAILED', e); process.exit(1) })
