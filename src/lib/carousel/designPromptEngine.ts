import { parseBrandDna } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, CarouselStructure, SlideCopy, SlideDesignPrompt, SlideRole, TextPosition } from './types'

// ─── Shot type pool — enforced diversity across a carousel ───────────────────

interface ShotDirective {
  id: string
  camera: string
  compositionRule: string
  negativeSpacelocation: string
  humanElement: string
  depthOfField: string
}

const SHOT_DIRECTIVES: Record<string, ShotDirective> = {
  hero_close: {
    id: 'hero_close',
    camera: '50mm close editorial framing, subject filling upper-right 55% of frame, slight off-axis',
    compositionRule: 'rule of thirds — subject anchored upper-right, clean tension on left side',
    negativeSpacelocation: 'lower-left 40% kept as quiet low-detail area for text overlay',
    humanElement: 'one hand or fingertip in frame — natural grip, not posed',
    depthOfField: 'shallow f/2.0 — subject sharp, background bokeh with ambient color bleed',
  },
  lifestyle_medium: {
    id: 'lifestyle_medium',
    camera: '35mm eye-level lifestyle framing, person-to-product relationship visible, moderate scene depth',
    compositionRule: 'diagonal leading line from lower-left to upper-right, product in right third',
    negativeSpacelocation: 'upper-left 35% open sky or clean wall for headline',
    humanElement: 'partial human presence — arms, torso, or lifestyle trace (jacket on chair, open book)',
    depthOfField: 'moderate f/4.0 — both subject and near-background in focus',
  },
  detail_macro: {
    id: 'detail_macro',
    camera: '85mm close macro crop, extreme surface texture fill, nearly abstract but identifiable',
    compositionRule: 'subject texture filling 70% of frame, strong left-right contrast in material',
    negativeSpacelocation: 'left 40% fade to soft blur or shadow for text area',
    humanElement: 'surface wear marks, fingerprint trace, or usage residue — product was touched',
    depthOfField: 'very shallow f/1.8 — micro-detail crisp, edges dissolve',
  },
  overhead_scene: {
    id: 'overhead_scene',
    camera: "directly overhead bird's-eye, organized-but-lived-in flat lay, asymmetric arrangement",
    compositionRule: 'objects on rule-of-thirds grid, not centered — one empty quadrant for text',
    negativeSpacelocation: 'upper-left or upper-right quadrant left intentionally empty',
    humanElement: 'one object clearly mid-use (open container, unfolded wrapper, used utensil)',
    depthOfField: 'flat plane, sharp end-to-end, natural surface shadows',
  },
  context_wide: {
    id: 'context_wide',
    camera: '28mm wide environmental, product as supporting actor within a believable Korean daily-life scene',
    compositionRule: 'product anchored right-center, environment tells the lifestyle story on left',
    negativeSpacelocation: 'top 30% — open sky, wall, or ceiling for headline text',
    humanElement: "human trace without visible person — shoes by door, phone face-down, keys on table",
    depthOfField: 'deep f/8.0 — scene-wide sharpness, no bokeh',
  },
  hands_use: {
    id: 'hands_use',
    camera: '50mm close action — hands actively using the product, caught in natural mid-motion',
    compositionRule: 'hands and product fill center frame, slight diagonal energy, not symmetrical',
    negativeSpacelocation: 'lower-left corner soft transition area for body text',
    humanElement: 'real hands — not manicured, natural skin texture, believable grip',
    depthOfField: 'shallow f/2.8 — hands and product sharp, background soft',
  },
  still_cta: {
    id: 'still_cta',
    camera: 'restrained still-life framing, nearly front-facing, generous breathing room, calm energy',
    compositionRule: 'single product centered slightly above middle, abundant negative space',
    negativeSpacelocation: 'center and lower 50% available for CTA text overlay',
    humanElement: 'product alone — but placed as if just set down, not arranged for a catalog',
    depthOfField: 'moderate f/4.0 — product crisp, background slightly soft',
  },
  dutch_angle: {
    id: 'dutch_angle',
    camera: '35mm slight dutch tilt (8-12°), asymmetric tension, dynamic energy without chaos',
    compositionRule: 'subject on upper-left third, diagonal composition, kinetic feel',
    negativeSpacelocation: 'lower-right 35% for text placement',
    humanElement: 'motion implied — product edge slightly blurred, or shadow suggesting movement',
    depthOfField: 'moderate f/3.5 — subject sharp, edges allowed to blur',
  },
  pov_shot: {
    id: 'pov_shot',
    camera: "first-person POV — viewer looking down at product in their own hands or on their desk",
    compositionRule: 'product centered-low in frame as if viewer just placed it, desk edge visible',
    negativeSpacelocation: 'upper 40% open scene background for text',
    humanElement: "viewer's own perspective implied — immersive, not third-person",
    depthOfField: 'shallow f/2.0 — product sharp, peripheral scene soft',
  },
  split_light: {
    id: 'split_light',
    camera: '50mm editorial crop, product lit from one side only — strong light-shadow contrast',
    compositionRule: 'vertical split: lit right half, shadowed left half, product crossing the divide',
    negativeSpacelocation: 'darker left side for white or light text overlay',
    humanElement: 'material reaction to light — specular highlight, cast shadow, texture revealed',
    depthOfField: 'moderate f/3.5 — crisp across the split',
  },
}

// Carousel-level shot sequences — no two slides share the same type
const SHOT_SEQUENCES: Record<number, string[]> = {
  5: ['hero_close', 'lifestyle_medium', 'overhead_scene', 'detail_macro', 'still_cta'],
  7: ['hero_close', 'lifestyle_medium', 'context_wide', 'overhead_scene', 'detail_macro', 'hands_use', 'still_cta'],
  10: ['hero_close', 'lifestyle_medium', 'dutch_angle', 'overhead_scene', 'detail_macro', 'context_wide', 'hands_use', 'pov_shot', 'split_light', 'still_cta'],
}

function getShotSequence(slideCount: number): string[] {
  const exact = SHOT_SEQUENCES[slideCount]
  if (exact) return exact
  const base = slideCount <= 6 ? SHOT_SEQUENCES[5] : slideCount <= 8 ? SHOT_SEQUENCES[7] : SHOT_SEQUENCES[10]
  const padded = [...base]
  while (padded.length < slideCount) padded.push(base[padded.length % base.length])
  return padded.slice(0, slideCount)
}

// ─── Product subject — uses actual product name, never generic fallback ───────

function buildProductSubject(productName: string, productDescription: string, industry: string): string {
  const ctx = `${productName} ${productDescription} ${industry}`.toLowerCase()

  if (/견과|호두|아몬드|캐슈|피스타치오|식품|건강식|간식|과일|채소|쿠키|그래놀라|초콜릿|먹|씹|건강/.test(ctx)) {
    return `${productName} — showing real product texture and a natural serving moment, not a beauty shot`
  }
  if (/커피|차|음료|주스|스무디|우유|카페|원두|드립|티/.test(ctx)) {
    return `${productName} in a realistic drink preparation or enjoyment moment — steam, condensation, or pour visible`
  }
  if (/세럼|크림|토너|앰플|클렌저|마스크|스킨케어|뷰티|화장품|선크림/.test(ctx)) {
    return `${productName} packaging with realistic product texture — a small amount on fingertip or just applied to skin`
  }
  if (/의류|의상|옷|패션|티셔츠|아우터|자켓|청바지|원피스|셔츠|니트/.test(ctx)) {
    return `${productName} worn naturally in a daily-life context — fabric texture and drape visible, not a mannequin`
  }
  if (/폰|기기|가전|전자|디바이스|충전|케이블|이어폰|노트북|태블릿/.test(ctx)) {
    return `${productName} in active-use context — screen on, hand nearby, practical desk environment`
  }
  if (/가구|인테리어|홈|생활|주방|욕실|침실|리빙|쿠션|조명|선반/.test(ctx)) {
    return `${productName} placed naturally in a realistic Korean home — not a showroom, lived-in feel`
  }
  if (/영양제|보충제|단백질|비타민|오메가|캡슐|정|건강보조/.test(ctx)) {
    return `${productName} with a few capsules or measured serving visible — morning routine, water glass nearby`
  }

  // Never "a premium lifestyle object" — always use the actual product name
  return `${productName} in a realistic Korean daily-life usage moment — product clearly identifiable, in-use rather than displayed`
}

// ─── Role-specific scene and emotional direction ──────────────────────────────

interface RoleSceneDirective {
  koreanScene: string
  emotionalAtmosphere: string
  lightingNote: string
  colorTemp: 'warm' | 'cool' | 'neutral'
}

const ROLE_SCENES: Record<string, RoleSceneDirective> = {
  hook: {
    koreanScene: 'caught mid-action in a recognizable Korean daily moment — before the viewer has time to scroll past',
    emotionalAtmosphere: 'interrupted curiosity — something slightly unresolved draws the eye',
    lightingNote: 'dramatic available light — a single strong source creating real shadow',
    colorTemp: 'neutral',
  },
  problem: {
    koreanScene: 'a quiet moment of mild frustration or uncertainty in a familiar Korean setting',
    emotionalAtmosphere: 'relatable low-level stress — the viewer recognizes this feeling immediately',
    lightingNote: 'slightly desaturated, overcast soft light — no golden warmth yet',
    colorTemp: 'cool',
  },
  cause: {
    koreanScene: 'a simple comparison or revealing detail — two objects side by side, or one object showing the issue',
    emotionalAtmosphere: 'analytical clarity — understanding rather than emotion',
    lightingNote: 'clean flat lighting, minimal shadow — honest and clear',
    colorTemp: 'neutral',
  },
  common_mistake: {
    koreanScene: 'a recognizable wrong-choice moment — the thing people normally reach for without thinking',
    emotionalAtmosphere: 'gentle recognition — not shaming, just revealing',
    lightingNote: 'slightly harsh directional light — creates an uncomfortable edge',
    colorTemp: 'cool',
  },
  product_solution: {
    koreanScene: 'the product appearing as the natural answer — not a hero shot, a quiet resolution moment',
    emotionalAtmosphere: 'quiet relief — the problem just became smaller',
    lightingNote: 'warmer light entering the scene — mood literally brightens',
    colorTemp: 'warm',
  },
  feature: {
    koreanScene: 'a specific product detail being used or touched — tactile and immediate',
    emotionalAtmosphere: "focused interest — that's the part that makes it work",
    lightingNote: 'precise directional light revealing the feature detail clearly',
    colorTemp: 'neutral',
  },
  feature_1: {
    koreanScene: 'first key feature in active use — product doing its primary job',
    emotionalAtmosphere: 'confident and capable — this feature delivers',
    lightingNote: 'clean precise light, feature-enhancing shadow',
    colorTemp: 'neutral',
  },
  feature_2: {
    koreanScene: 'second feature in context — different angle or use case from feature_1',
    emotionalAtmosphere: 'practical satisfaction — and it does this too',
    lightingNote: 'slightly warmer than feature_1 — visual variety across the pair',
    colorTemp: 'warm',
  },
  benefit_or_proof: {
    koreanScene: 'a warm life moment after using the product — life is slightly better, believably',
    emotionalAtmosphere: 'quiet everyday contentment — not aspirational fantasy',
    lightingNote: 'golden afternoon or soft morning window light',
    colorTemp: 'warm',
  },
  proof: {
    koreanScene: 'evidence of real use — visible signs the product is part of someone\'s life',
    emotionalAtmosphere: 'earned trust — people actually use this',
    lightingNote: 'natural available light, no retouching energy',
    colorTemp: 'warm',
  },
  offer: {
    koreanScene: 'product presented clearly without distraction — single clean look before the decision',
    emotionalAtmosphere: 'low-pressure clarity — here it is, your choice',
    lightingNote: 'soft even light, no drama',
    colorTemp: 'neutral',
  },
  cta: {
    koreanScene: 'a calm open scene — space for the viewer to imagine themselves with the product',
    emotionalAtmosphere: 'invitation without pressure — whenever you\'re ready',
    lightingNote: 'open bright ambient light — spacious, breathing room',
    colorTemp: 'warm',
  },
}

// ─── Human-feel injections — reduces AI aesthetic signature ──────────────────

const HUMAN_FEEL_BY_SHOT: Record<string, string> = {
  hero_close: 'slight natural fingerprint smudge on surface, natural material wear at one edge',
  lifestyle_medium: 'one nearby object slightly out of place — casually set down, not arranged',
  detail_macro: 'microscopic surface texture, slight variation in material — not factory-perfect',
  overhead_scene: 'one element showing actual use — crumb, open fold, drip trace, or partial peel',
  context_wide: 'environmental story: keys nearby, phone face-down, jacket on chair back',
  hands_use: 'real hand skin texture — not retouched, natural nail and knuckle detail visible',
  still_cta: 'product placed as if just set down gently — slight tilt, natural contact shadow',
  dutch_angle: 'motion trace — slight blur at product edge, or shadow suggesting recent movement',
  pov_shot: 'desk surface texture under product — wood grain, fabric, or concrete with natural marks',
  split_light: 'dust particles caught in light beam, natural specular on material surface',
}

// ─── Korean lifestyle scene per industry ─────────────────────────────────────

function buildKoreanLifestyleContext(industry: string, productName: string): string {
  const ctx = `${industry} ${productName}`.toLowerCase()
  if (/건강|식품|견과|영양|웰니스/.test(ctx)) return 'weekday Seoul office or apartment — mid-morning light, practical Korean daily-routine'
  if (/뷰티|스킨|화장품|cosmetic|skincare/.test(ctx)) return 'Korean apartment bathroom or vanity corner — morning skincare routine, real bathroom textures'
  if (/커피|음료|카페|beverage/.test(ctx)) return 'Seoul neighborhood cafe or apartment kitchen — morning or afternoon slow moment'
  if (/패션|의류|fashion|clothing/.test(ctx)) return 'Korean apartment entryway or street — natural daylight, real wear context'
  if (/기술|tech|전자|device/.test(ctx)) return 'Seoul startup office or home workspace — desk with working context, natural daylight'
  if (/가구|인테리어|리빙|home|living/.test(ctx)) return 'realistic Korean apartment interior — lived-in, thoughtfully arranged, real home feel'
  return 'realistic Korean daily-life environment — natural light, unposed moment, believable setting'
}

// ─── Text position inferred from negative space ───────────────────────────────

function pickTextPosition(negativeSpacelocation: string, slideNumber: number, total: number): TextPosition {
  if (negativeSpacelocation.includes('lower') || negativeSpacelocation.includes('bottom') || negativeSpacelocation.includes('center and lower')) return 'bottom'
  if (negativeSpacelocation.includes('upper') || negativeSpacelocation.includes('top')) return 'top'
  if (slideNumber === total) return 'bottom'
  return 'center'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateDesignPrompts(
  brand: BrandProfile,
  input: CampaignInput,
  copies: SlideCopy[],
  structure?: CarouselStructure
): Promise<SlideDesignPrompt[]> {
  const roleMap = new Map(structure?.slides.map(s => [s.slideNumber, s.role]) ?? [])
  const dna = parseBrandDna(brand.brandDna)
  const avoidVisuals = dna.avoidVisuals.length ? dna.avoidVisuals : []

  const shotSequence = getShotSequence(copies.length)
  const productSubject = buildProductSubject(input.productName, input.productDescription, brand.industry)
  const koreanContext = buildKoreanLifestyleContext(brand.industry, input.productName)
  const brandColorNote = brand.mainColor
    ? `brand accent ${brand.mainColor} appears only as a restrained reflected tint or single object accent — never dominant`
    : 'restrained neutral palette with one subtle warm accent'

  return copies.map((copy, index): SlideDesignPrompt => {
    const role = (roleMap.get(copy.slideNumber) ?? 'product_solution') as string
    const shotKey = shotSequence[index] ?? 'still_cta'
    const shot = SHOT_DIRECTIVES[shotKey]
    const scene = ROLE_SCENES[role] ?? ROLE_SCENES.product_solution
    const humanFeel = HUMAN_FEEL_BY_SHOT[shotKey] ?? HUMAN_FEEL_BY_SHOT.still_cta
    const avoidClause = avoidVisuals.map(v => `no ${v}`).join(', ')

    const backgroundPrompt = [
      // Contract
      `Background-only photograph for Korean Instagram 4:5 carousel slide ${copy.slideNumber}/${copies.length}. No text, no typography, no Hangul, no Latin letters, no numbers, no logos, no watermarks, no labels, no packaging text of any kind — final typography is rendered by the application.`,
      // Shot
      `SHOT: ${shot.camera}. ${shot.compositionRule}.`,
      // Scene and subject
      `SCENE: ${koreanContext}. Subject: ${productSubject}. ${scene.koreanScene}.`,
      // Mood and light
      `MOOD: ${scene.emotionalAtmosphere}. Lighting: ${scene.lightingNote}. Color temperature: ${scene.colorTemp === 'warm' ? 'warm 3200K' : scene.colorTemp === 'cool' ? 'cool 6500K' : 'neutral daylight 5000K'}.`,
      // Depth of field
      `OPTICS: ${shot.depthOfField}.`,
      // Text safe area
      `TEXT SAFE ZONE: Keep ${shot.negativeSpacelocation} clear of sharp details — this area is reserved for app-rendered text overlay.`,
      // Brand color
      `BRAND COLOR: ${brandColorNote}.`,
      // Human feel
      `REALISM: ${humanFeel}. Subtle ISO 400 film grain. Natural surface imperfections. Unretouched scene. Avoid: over-clean rooms, perfect symmetry, generic minimalism, stock-photo staging, fake luxury props.`,
      // Avoid
      avoidClause ? `AVOID: ${avoidClause}.` : '',
    ].filter(Boolean).join('\n')

    return {
      slideNumber: copy.slideNumber,
      backgroundPrompt,
      layoutStyle: 'minimal-commerce',
      textPosition: pickTextPosition(shot.negativeSpacelocation, copy.slideNumber, copies.length),
      visualMood: scene.emotionalAtmosphere,
    }
  })
}
