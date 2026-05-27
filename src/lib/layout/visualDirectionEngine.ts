import { LAYOUT_DEFINITIONS, type LayoutDefinition } from './layoutTypes'
import { buildVisualBrandAnchors } from './brandHarness'
import type { EditorialVisualDirection } from '../editorial/editorialDirector'

export interface VisualDirectionInput {
  layout: LayoutDefinition
  category: string
  topic: string
  tone: string
  visualHint?: string
  brandMainColor?: string
  brandToneOfVoice?: string
  brandIndustry?: string
  brandDna?: string | null
  editorialDirection?: EditorialVisualDirection
}

export interface VisualDirection {
  prompt: string
  compositionGuide: {
    subjectPosition: string
    safeTypographyArea: string
    overlayRecommendation: string
  }
}

function inferSubject(topic: string, category: string): string {
  const text = `${topic} ${category}`.toLowerCase()
  if (text.includes('bag') || text.includes('백') || text.includes('가방')) return 'a premium designer bag'
  if (text.includes('shoe') || text.includes('슈즈') || text.includes('스니커즈') || text.includes('신발')) return 'designer shoes'
  if (text.includes('cosmetic') || text.includes('세럼') || text.includes('크림') || text.includes('화장품') || text.includes('skin') || text.includes('뷰티') || text.includes('토너') || text.includes('앰플')) return 'a premium skincare cosmetic bottle'
  if (text.includes('coffee') || text.includes('커피') || text.includes('카페') || text.includes('원두')) return 'a cup of coffee'
  if (text.includes('chair') || text.includes('의자') || text.includes('furniture') || text.includes('가구')) return 'minimalist designer furniture'
  if (text.includes('tumbler') || text.includes('텀블러') || text.includes('보틀') || text.includes('컵')) return 'a sleek minimalist tumbler'
  if (text.includes('clothing') || text.includes('의류') || text.includes('옷') || text.includes('패션') || text.includes('shirt') || text.includes('아우터')) return 'modern editorial clothing'
  
  return 'a premium lifestyle object'
}

export function generateVisualDirection(input: VisualDirectionInput): VisualDirection {
  const subjectPosition = inferSubjectPosition(input.layout.textPosition)
  const safeTypographyArea = input.layout.textPosition
  const palette = input.layout.preferredColorPalette.join(', ')
  const context = `${input.brandIndustry || ''} ${input.category} ${input.topic} ${input.tone}`.toLowerCase()
  const brandAnchors = buildVisualBrandAnchors(input.brandDna)

  const scene = inferScene(context)
  // Reference design system: dark editorial card style (observed from reference templates)
  // - Full-bleed vertical photo with strong cinematic subject
  // - Strong gradient-dark overlay in lower 40% for headline legibility
  // - Dramatic lighting, desaturated tones, high contrast
  // - Upper-left brand watermark area stays minimal
  // - Bottom-left typography safe zone is the primary text anchor
  const referenceStyleBase = [
    'Korean social media editorial card background — full-bleed cinematic portrait photograph',
    'inspired by premium Korean news card layout: dramatic subject, lower half darkened for text overlay',
    'deep shadow gradient at bottom 40% of frame',
    'photojournalism quality, documentary lighting, subtle film grain',
    'high contrast, cinematic color grade, muted naturalistic palette',
  ].join(', ')

  const subject = inferSubject(input.topic, input.category)

  const prompt = [
    referenceStyleBase,
    scene,
    `subject: ${subject}`,
    `tone: ${input.brandToneOfVoice || input.tone}`,
    input.visualHint ? `reference direction: ${input.visualHint}` : '',
    brandAnchors ? `brand visual anchors: ${brandAnchors}` : '',
    input.editorialDirection ? `editorial purpose: ${input.editorialDirection.imagePurpose}` : '',
    input.editorialDirection ? `visual focus: ${input.editorialDirection.focus}` : '',
    input.editorialDirection ? `composition rhythm: ${input.editorialDirection.composition}, whitespace ${input.editorialDirection.whitespaceRatio}, text dominance ${input.editorialDirection.textDominance}` : '',
    input.editorialDirection ? `emotional mood: ${input.editorialDirection.mood}` : '',
    `preferred palette: ${palette}`,
    `subject positioning: ${subjectPosition}`,
    `keep ${safeTypographyArea} area as clean dark negative space for app-rendered text overlay`,
    `overlay style: ${input.layout.overlayStyle}`,
    'no generated text, no pseudo text, no letters, no Hangul, no alphabet, no numbers, no logo, no watermark, no UI, no frame',
    'no signage, no posters, no menu boards, no book covers, no newspaper headlines, no package labels, no screens with text',
    '1080x1350 portrait composition',
  ].filter(Boolean).join(', ')

  return {
    prompt,
    compositionGuide: {
      subjectPosition,
      safeTypographyArea,
      overlayRecommendation: input.layout.overlayStyle,
    },
  }
}

export function getLayoutDefinition(layoutType: keyof typeof LAYOUT_DEFINITIONS) {
  return LAYOUT_DEFINITIONS[layoutType]
}

function inferScene(text: string) {
  if (/정치|사회|뉴스|시장|금융|vc|스타트업|투자|tech|it|business/.test(text)) {
    return 'newsroom, newspaper texture, public speech, office glass, market board, or documentary business scene'
  }
  if (/여행|공간|장소|로컬|맛집|카페|생활|라이프/.test(text)) {
    return 'real Korean street, store interior, cafe table, travel spot, or everyday lifestyle documentary scene'
  }
  if (/제품|출시|브랜드|커머스|스토어|패션|뷰티|리빙/.test(text)) {
    return 'premium product-adjacent editorial scene, real store shelf, fabric texture, object close-up, or studio reportage'
  }
  if (/건강|웰니스|식품|자연|운동/.test(text)) {
    return 'natural wellness editorial scene, raw texture, food market, gym, plant shadow, or calm documentary close-up'
  }
  return 'realistic Korean editorial scene with a clear subject and strong photographic depth'
}

function inferSubjectPosition(textPosition: string) {
  if (textPosition.includes('left')) return 'center-right composition, keeping left area readable'
  if (textPosition.includes('right')) return 'center-left composition, keeping right area readable'
  if (textPosition.includes('top')) return 'lower-center composition, keeping upper area readable'
  if (textPosition.includes('bottom')) return 'upper-center composition, keeping lower area readable'
  return 'center composition with quiet surrounding space'
}
