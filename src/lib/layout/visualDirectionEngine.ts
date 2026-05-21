import { LAYOUT_DEFINITIONS, type LayoutDefinition } from './layoutTypes'

export interface VisualDirectionInput {
  layout: LayoutDefinition
  category: string
  topic: string
  tone: string
  visualHint?: string
  brandMainColor?: string
  brandToneOfVoice?: string
  brandIndustry?: string
}

export interface VisualDirection {
  prompt: string
  compositionGuide: {
    subjectPosition: string
    safeTypographyArea: string
    overlayRecommendation: string
  }
}

export function generateVisualDirection(input: VisualDirectionInput): VisualDirection {
  const subjectPosition = inferSubjectPosition(input.layout.textPosition)
  const safeTypographyArea = input.layout.textPosition
  const palette = input.layout.preferredColorPalette.join(', ')
  const context = `${input.brandIndustry || ''} ${input.category} ${input.topic} ${input.tone}`.toLowerCase()

  const scene = inferScene(context)
  const prompt = [
    'Korean Instagram media card news background',
    'realistic editorial documentary photography',
    'photojournalism, high contrast, full-bleed vertical image',
    'dark cinematic shadows, desaturated natural colors, subtle film grain',
    scene,
    `topic: ${input.topic}`,
    `category: ${input.category}`,
    `tone: ${input.brandToneOfVoice || input.tone}`,
    input.visualHint ? `reference direction: ${input.visualHint}` : '',
    `preferred palette: ${palette}`,
    `subject positioning: ${subjectPosition}`,
    `leave ${safeTypographyArea} area readable under a dark gradient overlay`,
    `overlay style: ${input.layout.overlayStyle}`,
    'no generated text, no letters, no Hangul, no numbers, no logo, no watermark, no UI, no frame',
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
