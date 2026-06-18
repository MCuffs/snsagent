/**
 * Seeds example card-news templates (active) into the database.
 * - 5 identities, each in a 5-slide and a 7-slide variant (10 templates total)
 * - Bilingual (KO + EN) selection tags so Korean topics match correctly
 * Idempotent: updates an existing template (by name), otherwise creates it.
 *
 * Run: node --experimental-loader ./tests/ts-extension-loader.mjs scripts/seed-card-templates.ts
 */
import { createCardTemplate, updateCardTemplate, listCardTemplates } from '../lib/templates/db'
import type {
  CardTemplateConfig, CardTemplateTags, SupportedSlideCount, TemplateSlideConfig, TextPosition, OverlayType,
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
    typography: { fontSize: s.size, fontWeight: s.weight, lineHeight: s.lineHeight ?? 1.12, letterSpacing: s.tracking ?? -1, textColor: s.color },
    overlay: { type: s.overlay, opacity: s.opacity, ...(s.customColor ? { customColor: s.customColor } : {}) },
    layout: { contentWidth: 86, contentAlignment: align, paddingX: 72, paddingY: 96 },
    background: { imageStyle: s.imageStyle, cropStyle: 'cover', blur: 0 },
  }
}

function cfg(slides: SlideSpec[], tags: CardTemplateTags): CardTemplateConfig {
  return { slideCount: slides.length as SupportedSlideCount, slides: slides.map((s, i) => mk(i + 1, s)), tags }
}

type Identity = { base: string; description: string; tags: CardTemplateTags; slides5: SlideSpec[]; slides7: SlideSpec[] }

const IDENTITIES: Identity[] = [
  {
    base: 'Editorial Dark',
    description: '권위 있고 프리미엄한 비즈니스 톤. 어두운 시네마틱 배경에 흰색 헤드라인.',
    tags: {
      emotion: ['authority', 'premium', 'serious', 'confidence', '권위', '프리미엄', '진중', '신뢰'],
      industry: ['business', 'finance', 'b2b', 'consulting', '비즈니스', '금융', '기업', '컨설팅'],
      style: ['editorial', 'luxury', '에디토리얼', '럭셔리'],
      visualTone: ['dark', 'moody', '다크', '무게감'],
    },
    slides5: [
      { label: 'Hero Title', pos: 'bottom-left', size: 74, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 72, imageStyle: 'moody cinematic editorial photograph, deep shadows, premium business atmosphere' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 52, imageStyle: 'restrained dark editorial photograph, low detail, premium' },
      { label: 'Quote', pos: 'middle-center', size: 54, weight: 500, color: '#f5f0e8', overlay: 'dark', opacity: 60, imageStyle: 'minimal dark backdrop, single subtle object, quiet luxury' },
      { label: 'Statistic', pos: 'top-center', size: 92, weight: 800, color: '#ffd9a8', overlay: 'dark', opacity: 56, imageStyle: 'dark muted gradient backdrop, premium financial mood' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 78, imageStyle: 'deep neutral closing still life, maximum breathing room' },
    ],
    slides7: [
      { label: 'Hero Title', pos: 'bottom-left', size: 74, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 72, imageStyle: 'moody cinematic editorial photograph, deep shadows, premium business atmosphere' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 52, imageStyle: 'restrained dark editorial photograph, low detail, premium' },
      { label: 'Editorial Detail', pos: 'bottom-left', size: 44, weight: 500, color: '#ffffff', overlay: 'dark', opacity: 50, imageStyle: 'dark premium documentary photograph, calm composition' },
      { label: 'Quote', pos: 'middle-center', size: 54, weight: 500, color: '#f5f0e8', overlay: 'dark', opacity: 60, imageStyle: 'minimal dark backdrop, single subtle object, quiet luxury' },
      { label: 'Statistic', pos: 'top-center', size: 92, weight: 800, color: '#ffd9a8', overlay: 'dark', opacity: 56, imageStyle: 'dark muted gradient backdrop, premium financial mood' },
      { label: 'Key Point', pos: 'middle-left', size: 48, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 54, imageStyle: 'restrained dark editorial scene, premium texture' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 78, imageStyle: 'deep neutral closing still life, maximum breathing room' },
    ],
  },
  {
    base: 'Modern Clean',
    description: '스타트업/테크용 밝고 깔끔한 톤. 여백이 넉넉하고 또렷한 산세리프.',
    tags: {
      emotion: ['innovative', 'confident', 'optimistic', '혁신', '자신감', '긍정'],
      industry: ['startup', 'tech', 'saas', 'app', '스타트업', '테크', 'IT', '앱', '서비스', '플랫폼'],
      style: ['modern', 'minimal', 'clean', '모던', '미니멀', '깔끔'],
      visualTone: ['bright', 'airy', '밝음', '산뜻'],
    },
    slides5: [
      { label: 'Hero Title', pos: 'top-left', size: 66, weight: 700, color: '#16181d', overlay: 'light', opacity: 42, imageStyle: 'clean minimal bright studio photograph, soft natural light, generous negative space' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 44, weight: 500, color: '#1c1f26', overlay: 'light', opacity: 36, imageStyle: 'bright airy product photo, clean white surface' },
      { label: 'Quote', pos: 'middle-center', size: 50, weight: 600, color: '#16181d', overlay: 'light', opacity: 40, imageStyle: 'soft gradient pastel background, minimal' },
      { label: 'Statistic', pos: 'top-center', size: 86, weight: 800, color: '#2563eb', overlay: 'light', opacity: 30, imageStyle: 'crisp bright tech backdrop, soft shadow' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#16181d', overlay: 'light', opacity: 46, imageStyle: 'clean minimal closing frame, bright and open' },
    ],
    slides7: [
      { label: 'Hero Title', pos: 'top-left', size: 66, weight: 700, color: '#16181d', overlay: 'light', opacity: 42, imageStyle: 'clean minimal bright studio photograph, soft natural light, generous negative space' },
      { label: 'Editorial Detail', pos: 'middle-left', size: 44, weight: 500, color: '#1c1f26', overlay: 'light', opacity: 36, imageStyle: 'bright airy product photo, clean white surface' },
      { label: 'Editorial Detail', pos: 'top-left', size: 42, weight: 500, color: '#1c1f26', overlay: 'light', opacity: 34, imageStyle: 'minimal bright workspace photo, soft daylight' },
      { label: 'Quote', pos: 'middle-center', size: 50, weight: 600, color: '#16181d', overlay: 'light', opacity: 40, imageStyle: 'soft gradient pastel background, minimal' },
      { label: 'Statistic', pos: 'top-center', size: 86, weight: 800, color: '#2563eb', overlay: 'light', opacity: 30, imageStyle: 'crisp bright tech backdrop, soft shadow' },
      { label: 'Key Point', pos: 'middle-left', size: 46, weight: 600, color: '#16181d', overlay: 'light', opacity: 38, imageStyle: 'clean bright minimal scene, product focus' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#16181d', overlay: 'light', opacity: 46, imageStyle: 'clean minimal closing frame, bright and open' },
    ],
  },
  {
    base: 'Bright Minimal',
    description: '동기부여·교육 콘텐츠용. 밝고 따뜻하며 가운데 정렬의 차분한 구성.',
    tags: {
      emotion: ['optimistic', 'uplifting', 'friendly', 'calm', '긍정', '희망', '따뜻', '차분', '동기부여'],
      industry: ['education', 'wellness', 'lifestyle', 'coaching', '교육', '웰니스', '라이프스타일', '자기계발', '건강'],
      style: ['minimal', 'bright', 'soft', '미니멀', '밝음', '부드러움'],
      visualTone: ['bright', 'warm', '밝음', '따뜻'],
    },
    slides5: [
      { label: 'Hero Title', pos: 'middle-center', size: 70, weight: 700, color: '#2a2320', overlay: 'light', opacity: 38, imageStyle: 'bright airy pastel minimal scene, soft warm morning light' },
      { label: 'Editorial Detail', pos: 'middle-center', size: 44, weight: 500, color: '#2a2320', overlay: 'light', opacity: 34, imageStyle: 'warm minimal lifestyle photo, gentle light' },
      { label: 'Quote', pos: 'middle-center', size: 52, weight: 500, color: '#7a4b2e', overlay: 'light', opacity: 30, imageStyle: 'soft warm gradient, cozy minimal' },
      { label: 'Statistic', pos: 'top-center', size: 84, weight: 800, color: '#c2682f', overlay: 'light', opacity: 32, imageStyle: 'bright warm backdrop, uplifting and clean' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#2a2320', overlay: 'light', opacity: 42, imageStyle: 'warm minimal closing frame, optimistic and open' },
    ],
    slides7: [
      { label: 'Hero Title', pos: 'middle-center', size: 70, weight: 700, color: '#2a2320', overlay: 'light', opacity: 38, imageStyle: 'bright airy pastel minimal scene, soft warm morning light' },
      { label: 'Editorial Detail', pos: 'middle-center', size: 44, weight: 500, color: '#2a2320', overlay: 'light', opacity: 34, imageStyle: 'warm minimal lifestyle photo, gentle light' },
      { label: 'Editorial Detail', pos: 'middle-center', size: 42, weight: 500, color: '#2a2320', overlay: 'light', opacity: 32, imageStyle: 'cozy minimal still life, soft warm tones' },
      { label: 'Quote', pos: 'middle-center', size: 52, weight: 500, color: '#7a4b2e', overlay: 'light', opacity: 30, imageStyle: 'soft warm gradient, cozy minimal' },
      { label: 'Statistic', pos: 'top-center', size: 84, weight: 800, color: '#c2682f', overlay: 'light', opacity: 32, imageStyle: 'bright warm backdrop, uplifting and clean' },
      { label: 'Key Point', pos: 'middle-center', size: 46, weight: 600, color: '#2a2320', overlay: 'light', opacity: 34, imageStyle: 'warm bright minimal scene, encouraging mood' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#2a2320', overlay: 'light', opacity: 42, imageStyle: 'warm minimal closing frame, optimistic and open' },
    ],
  },
  {
    base: 'Magazine Layout',
    description: '뉴스·시사·트렌드 톤. 상단 키커식 헤드라인, 강한 대비, 매거진 편집 감성.',
    tags: {
      emotion: ['informative', 'credible', 'bold', 'urgent', '정보', '신뢰', '임팩트', '속보'],
      industry: ['news', 'media', 'journalism', 'politics', 'trends', '뉴스', '미디어', '저널리즘', '정치', '시사', '트렌드', '이슈', '리포트'],
      style: ['magazine', 'editorial', 'reportage', '매거진', '에디토리얼', '시사'],
      visualTone: ['contrast', 'neutral', '대비', '뉴트럴'],
    },
    slides5: [
      { label: 'Hero Headline', pos: 'top-left', size: 68, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 70, imageStyle: 'documentary photojournalism, high contrast, editorial magazine cover', tracking: -1.5 },
      { label: 'Lead', pos: 'bottom-left', size: 44, weight: 500, color: '#ffffff', overlay: 'gradient', opacity: 66, imageStyle: 'candid documentary photograph, natural light, reportage' },
      { label: 'Quote', pos: 'middle-left', size: 52, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 58, imageStyle: 'editorial portrait, dramatic contrast' },
      { label: 'Statistic', pos: 'top-right', size: 88, weight: 800, color: '#ffe08a', overlay: 'dark', opacity: 54, imageStyle: 'newsroom backdrop, high contrast neutral tones' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 74, imageStyle: 'editorial closing frame, magazine end-page mood' },
    ],
    slides7: [
      { label: 'Hero Headline', pos: 'top-left', size: 68, weight: 800, color: '#ffffff', overlay: 'gradient', opacity: 70, imageStyle: 'documentary photojournalism, high contrast, editorial magazine cover', tracking: -1.5 },
      { label: 'Lead', pos: 'bottom-left', size: 44, weight: 500, color: '#ffffff', overlay: 'gradient', opacity: 66, imageStyle: 'candid documentary photograph, natural light, reportage' },
      { label: 'Context', pos: 'middle-left', size: 44, weight: 500, color: '#ffffff', overlay: 'dark', opacity: 56, imageStyle: 'reportage scene, contextual documentary photograph' },
      { label: 'Quote', pos: 'middle-left', size: 52, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 58, imageStyle: 'editorial portrait, dramatic contrast' },
      { label: 'Statistic', pos: 'top-right', size: 88, weight: 800, color: '#ffe08a', overlay: 'dark', opacity: 54, imageStyle: 'newsroom backdrop, high contrast neutral tones' },
      { label: 'Implication', pos: 'bottom-left', size: 46, weight: 600, color: '#ffffff', overlay: 'gradient', opacity: 64, imageStyle: 'editorial analysis scene, high contrast neutral mood' },
      { label: 'CTA', pos: 'bottom-center', size: 46, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 74, imageStyle: 'editorial closing frame, magazine end-page mood' },
    ],
  },
  {
    base: 'Bold Statement',
    description: '뷰티·라이프스타일·푸드용. 큼직한 가운데 헤드라인과 강렬한 컬러.',
    tags: {
      emotion: ['energetic', 'bold', 'playful', 'excited', '에너지', '대담', '경쾌', '설렘'],
      industry: ['beauty', 'fashion', 'food', 'lifestyle', 'fitness', '뷰티', '패션', '푸드', '음식', '라이프스타일', '피트니스', '운동'],
      style: ['bold', 'vibrant', '볼드', '비비드', '강렬'],
      visualTone: ['vibrant', 'punchy', '비비드', '강렬'],
    },
    slides5: [
      { label: 'Hero Title', pos: 'middle-center', size: 96, weight: 900, color: '#ffffff', overlay: 'custom', opacity: 40, customColor: '#7c1d6f', imageStyle: 'vibrant high-saturation lifestyle photograph, punchy color, bold mood', tracking: -2, lineHeight: 1.02 },
      { label: 'Editorial Detail', pos: 'bottom-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 50, imageStyle: 'vivid lifestyle photo, energetic, saturated tones' },
      { label: 'Quote', pos: 'middle-center', size: 60, weight: 700, color: '#fff1f6', overlay: 'gradient', opacity: 64, imageStyle: 'bold colorful gradient backdrop, playful' },
      { label: 'Statistic', pos: 'top-center', size: 104, weight: 900, color: '#ffe066', overlay: 'custom', opacity: 46, customColor: '#1a1140', imageStyle: 'vibrant bold backdrop, high energy', tracking: -2 },
      { label: 'CTA', pos: 'bottom-center', size: 52, weight: 800, color: '#ffffff', overlay: 'dark', opacity: 62, imageStyle: 'punchy closing frame, vivid color, call to action energy' },
    ],
    slides7: [
      { label: 'Hero Title', pos: 'middle-center', size: 96, weight: 900, color: '#ffffff', overlay: 'custom', opacity: 40, customColor: '#7c1d6f', imageStyle: 'vibrant high-saturation lifestyle photograph, punchy color, bold mood', tracking: -2, lineHeight: 1.02 },
      { label: 'Editorial Detail', pos: 'bottom-left', size: 46, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 50, imageStyle: 'vivid lifestyle photo, energetic, saturated tones' },
      { label: 'Editorial Detail', pos: 'bottom-left', size: 44, weight: 600, color: '#ffffff', overlay: 'dark', opacity: 48, imageStyle: 'bold vivid lifestyle scene, saturated color' },
      { label: 'Quote', pos: 'middle-center', size: 60, weight: 700, color: '#fff1f6', overlay: 'gradient', opacity: 64, imageStyle: 'bold colorful gradient backdrop, playful' },
      { label: 'Statistic', pos: 'top-center', size: 104, weight: 900, color: '#ffe066', overlay: 'custom', opacity: 46, customColor: '#1a1140', imageStyle: 'vibrant bold backdrop, high energy', tracking: -2 },
      { label: 'Key Point', pos: 'middle-center', size: 56, weight: 700, color: '#ffffff', overlay: 'gradient', opacity: 60, imageStyle: 'energetic vivid backdrop, punchy color' },
      { label: 'CTA', pos: 'bottom-center', size: 52, weight: 800, color: '#ffffff', overlay: 'dark', opacity: 62, imageStyle: 'punchy closing frame, vivid color, call to action energy' },
    ],
  },
]

async function upsert(name: string, description: string, config: CardTemplateConfig, existing: Map<string, string>) {
  const id = existing.get(name)
  if (id) {
    await updateCardTemplate(id, { name, description, config, status: 'active' })
    console.log(`updated: ${name} (${config.slideCount}장)`)
  } else {
    const row = await createCardTemplate({ name, description, config, status: 'active' })
    console.log(`created: ${name} (${config.slideCount}장) [${row.id}]`)
  }
}

async function main() {
  const existing = new Map((await listCardTemplates()).map((t) => [t.name, t.id]))
  for (const idv of IDENTITIES) {
    await upsert(idv.base, idv.description, cfg(idv.slides5, idv.tags), existing)
    await upsert(`${idv.base} 7컷`, idv.description, cfg(idv.slides7, idv.tags), existing)
  }
  console.log('\nDone.')
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED FAILED', e); process.exit(1) })
