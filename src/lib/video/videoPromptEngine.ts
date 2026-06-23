/**
 * Video prompt engine for Seedance video generation.
 *
 * Generates detailed English cinematic prompts covering:
 * - Camera angle & movement
 * - Subject expression & body language
 * - Background motion & depth
 * - Lighting temperature & color grading
 * - Atmosphere & visual mood
 */

import type { EditorialSlideRole } from '../editorial/editorialDirector'

export interface VideoPromptInput {
  topic: string
  headline: string
  body: string
  role: EditorialSlideRole
  slideNumber: number
  totalSlides: number
  brandTone?: string
  domainLabel?: string  // e.g. "food", "finance", "fashion"
  hasReferenceImages?: boolean
  referenceImageCount?: number
}

export interface VideoPromptOutput {
  prompt: string        // full English cinematic prompt for Seedance
  negativeHint: string  // what to avoid (also fed to API if supported)
}

// Domain-aware visual style presets
const DOMAIN_VISUAL_STYLE: Record<string, {
  lightingTemp: string
  colorGrade: string
  backgroundMotion: string
  subject: string
}> = {
  food: {
    lightingTemp: 'warm golden-hour light (5500K), soft diffused top light',
    colorGrade: 'warm cream tones, slightly desaturated greens, rich amber highlights',
    backgroundMotion: 'very slow steam rising from food, gentle bokeh depth',
    subject: 'real food or beverage with visible texture detail',
  },
  fashion: {
    lightingTemp: 'cool studio light (6000K) with a subtle warm rim light',
    colorGrade: 'clean whites, deep blacks, muted cool-neutral palette',
    backgroundMotion: 'fabric gently swaying in a soft breeze, abstract urban blur',
    subject: 'styled outfit or accessory close-up with natural model movement',
  },
  finance: {
    lightingTemp: 'neutral daylight (5000K), restrained office ambient',
    colorGrade: 'desaturated blue-grey tones, minimal color, data-report look',
    backgroundMotion: 'subtle parallax depth on document or city background',
    subject: 'abstract financial or desk context, no people or explicit numbers',
  },
  health: {
    lightingTemp: 'soft natural daylight (5500K), gentle morning window light',
    colorGrade: 'fresh greens, clean whites, airy open feel',
    backgroundMotion: 'slow peaceful movement — breathing, gentle stretch, leaves',
    subject: 'wellness routine or calm environment, human-scale natural scene',
  },
  tech: {
    lightingTemp: 'cool blue-white LED ambient (6500K) with subtle screen glow',
    colorGrade: 'dark background, cool blue-teal accents, minimal high-contrast',
    backgroundMotion: 'soft UI or desk surface bokeh, very slight camera drift',
    subject: 'device or workspace detail, focused and clean',
  },
  news: {
    lightingTemp: 'neutral news-studio light (5000K), slight edge shadow',
    colorGrade: 'neutral greys, muted palette, journalistic feel',
    backgroundMotion: 'slow push-in on symbolic public space or documents',
    subject: 'symbolic public context, no identifiable faces or readable text',
  },
  living: {
    lightingTemp: 'warm afternoon indoor light (3200K), window soft box',
    colorGrade: 'warm wood tones, soft whites, earthy neutral palette',
    backgroundMotion: 'very slow drift across a styled room, gentle dust motes',
    subject: 'interior detail or furniture in practical use',
  },
  travel: {
    lightingTemp: 'golden-hour natural light (4500K), directional warm sun',
    colorGrade: 'vivid but natural, warm saturation, cinematic travel feel',
    backgroundMotion: 'slow dolly through landscape or street scene',
    subject: 'destination, local street, nature, or travel moment',
  },
  beauty: {
    lightingTemp: 'soft beauty-dish light (5500K), macro skin texture detail',
    colorGrade: 'clean skin tones, soft pinks, delicate and premium feel',
    backgroundMotion: 'extremely slow product rotate or skin-texture reveal',
    subject: 'beauty product or close-up application detail',
  },
  general: {
    lightingTemp: 'balanced natural daylight (5000K)',
    colorGrade: 'clean neutral palette, minimal color cast',
    backgroundMotion: 'subtle ambient motion — nature, urban, or abstract',
    subject: 'one clear relatable daily-life element',
  },
}

// Role-specific camera movement
const ROLE_CAMERA: Record<EditorialSlideRole, {
  movement: string
  angle: string
  lens: string
}> = {
  hook: {
    movement: 'slow push-in (0.3x zoom), subtle parallax on background layer',
    angle: 'eye-level or very slight low-angle (10°), assertive framing',
    lens: 'wide 24mm equivalent — captures environment and subject together',
  },
  context: {
    movement: 'gentle horizontal drift (pan left 5°), documentary feel',
    angle: 'eye-level, observer POV, candid framing',
    lens: '35mm equivalent — natural perspective, human-scale',
  },
  'key-point': {
    movement: 'slow rack focus from background to subject, then hold',
    angle: 'slightly above eye-level (15°), authoritative editorial angle',
    lens: '50mm equivalent — neutral compression, editorial',
  },
  detail: {
    movement: 'slow orbital drift (5° arc around subject)',
    angle: 'close medium shot, 3/4 profile angle, intimate',
    lens: '85mm equivalent — soft background compression, detail focus',
  },
  stat: {
    movement: 'nearly static, micro-handheld shimmer only',
    angle: 'overhead (30–45°) or straight-on tabletop angle',
    lens: 'macro or 100mm — crisp texture detail, grounded',
  },
  summary: {
    movement: 'slow pull-back (zoom-out 0.2x), resolution and openness',
    angle: 'wide establishing shot, slightly high angle (20°)',
    lens: '28mm equivalent — open and spacious',
  },
  'save-cta': {
    movement: 'minimal motion, clean hold with subtle breathing',
    angle: 'centered, perfectly balanced symmetry',
    lens: '50mm equivalent — calm, composed, brand-closing',
  },
}

export function buildVideoPrompt(input: VideoPromptInput): VideoPromptOutput {
  const domain = input.domainLabel || 'general'
  const style = DOMAIN_VISUAL_STYLE[domain] || DOMAIN_VISUAL_STYLE.general

  // Diagnostic: log domainLabel resolution to detect Korean→English key mismatch
  if (input.domainLabel && !DOMAIN_VISUAL_STYLE[input.domainLabel]) {
    console.warn(
      `[VideoPromptEngine] domainLabel "${input.domainLabel}" did not match any DOMAIN_VISUAL_STYLE key ` +
      `(available: ${Object.keys(DOMAIN_VISUAL_STYLE).join(', ')}). Falling back to "general".`,
    )
  }
  const camera = ROLE_CAMERA[input.role] || ROLE_CAMERA['detail']

  const duration = '4-second cinematic loop'
  const aspectNote = 'wide 16:9 video made for the upper media panel of a vertical card news layout'

  // Build the subject line based on headline
  const subjectContext = buildSubjectFromHeadline(input.headline, input.topic, domain)

  const prompt = [
    // Core subject
    `${subjectContext}.`,
    '',
    // Camera & motion
    `Camera: ${camera.lens} lens. Movement: ${camera.movement}. Angle: ${camera.angle}.`,
    '',
    // Lighting
    `Lighting: ${style.lightingTemp}. Color grade: ${style.colorGrade}.`,
    '',
    // Background & atmosphere
    `Background motion: ${style.backgroundMotion}.`,
    `Visual atmosphere: ${buildAtmosphere(input.role, input.brandTone)}.`,
    '',
    // Technical specs
    `Format: ${duration}, ${aspectNote}. Keep the main subject centered with generous headroom and side margins so it remains intact when placed above text. No text, no UI elements, no watermarks, no logos, no readable signage anywhere in frame. Background photograph and motion only.`,
    input.hasReferenceImages
      ? buildReferenceImageInstruction(input.referenceImageCount ?? 1)
      : '',
  ].join('\n').trim()

  const negativeHint = 'text, subtitles, watermark, logo, UI elements, readable signs, fast cuts, shaky cam, overexposed highlight clipping, distorted faces, artificial CGI look'

  return { prompt, negativeHint }
}

function buildSubjectFromHeadline(headline: string, topic: string, domain: string): string {
  const style = DOMAIN_VISUAL_STYLE[domain] || DOMAIN_VISUAL_STYLE.general

  // Clean headline to extract subject essence
  const clean = headline
    .replace(/[""'"']/g, '')
    .replace(/\?|!|\.$/g, '')
    .trim()

  // Use the headline as the primary visual subject.
  // The topic is included as secondary context but the prompt is structured
  // so the model focuses on visual storytelling rather than translating text.
  return `Cinematic scene illustrating the concept of "${clean}" — ${style.subject}. The scene should visually evoke the theme without any text or readable elements`
}

function buildReferenceImageInstruction(count: number) {
  const labels = Array.from({ length: Math.max(1, Math.min(3, count)) }, (_, index) => `image${index + 1}`)
  const imageList = labels.join(', ')

  if (labels.length === 1) {
    return [
      'Reference image priority:',
      'Use image1 as the primary visual anchor and opening visual source.',
      'Preserve its main product/object shape, composition, color palette, material texture, packaging cues, and brand mood.',
      'Animate it with subtle natural motion; do not replace it with a generic stock scene.',
    ].join(' ')
  }

  return [
    `Reference image priority: the uploaded references are ordered as ${imageList}.`,
    'Use image1 as the main visual anchor.',
    'Use the remaining images for supporting product details, color palette, material texture, packaging cues, and brand mood.',
    'Keep the referenced objects recognizable while adding subtle natural motion; do not replace them with generic stock scenes.',
  ].join(' ')
}

function buildAtmosphere(role: EditorialSlideRole, brandTone?: string): string {
  const base: Record<EditorialSlideRole, string> = {
    hook: 'tension and curiosity — a moment that makes you stop scrolling',
    context: 'familiar and relatable — the viewer recognizes their own situation',
    'key-point': 'clarity and insight — a decisive visual moment',
    detail: 'intimate and confident — practical detail that builds trust',
    stat: 'precise and grounded — evidence-backed calmness',
    summary: 'relief and resolution — the satisfying close of a journey',
    'save-cta': 'clean and inviting — a calm, branded ending',
  }

  const atm = base[role] || 'engaging and on-brand'
  if (brandTone) return `${atm}; brand tone: ${brandTone}`
  return atm
}

// Generate consistent prompts for an entire carousel (ensures visual coherence)
export function buildCarouselVideoPrompts(
  slides: Array<{
    slideNumber: number
    role: EditorialSlideRole
    headline: string
    body: string
  }>,
  topic: string,
  domainLabel?: string,
  brandTone?: string,
  referenceImageUrls: string[] = [],
): VideoPromptOutput[] {
  // Establish a "visual anchor" — shared subject context across all slides
  const anchorDomain = domainLabel || 'general'
  const anchorStyle = DOMAIN_VISUAL_STYLE[anchorDomain] || DOMAIN_VISUAL_STYLE.general

  return slides.map(slide => {
    const base = buildVideoPrompt({
      ...slide,
      topic,
      totalSlides: slides.length,
      domainLabel,
      brandTone,
      hasReferenceImages: referenceImageUrls.length > 0,
      referenceImageCount: referenceImageUrls.length,
    })

    // Add coherence note to all slides after the first
    if (slide.slideNumber > 1) {
      const coherenceNote = `Maintain visual consistency with the series: same ${anchorStyle.colorGrade} color grade, same ${anchorStyle.lightingTemp} lighting character, same visual world as slide 1.`
      return {
        prompt: base.prompt + '\n\n' + coherenceNote,
        negativeHint: base.negativeHint,
      }
    }

    return base
  })
}
