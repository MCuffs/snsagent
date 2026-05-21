import { LAYOUT_DEFINITIONS, type LayoutDefinition } from './layoutTypes'

export interface VisualDirectionInput {
  layout: LayoutDefinition
  category: string
  topic: string
  tone: string
  visualHint?: string
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

  return {
    prompt: [
      input.layout.imageStyle,
      `topic: ${input.topic}`,
      `category: ${input.category}`,
      `tone: ${input.tone}`,
      input.visualHint ? `visual reference direction: ${input.visualHint}` : '',
      `visual mood: ${input.layout.visualMood}`,
      `preferred color palette: ${palette}`,
      `subject positioning: ${subjectPosition}`,
      `reserve clean empty space for typography at ${safeTypographyArea}`,
      `consider overlay readability: ${input.layout.overlayStyle}`,
      'realistic Korean Instagram media aesthetic',
      'high editorial quality, mobile-first vertical composition',
      'no text, no letters, no Hangul, no captions, no logo, no watermark',
      '1080x1350 portrait composition',
    ].filter(Boolean).join(', '),
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

function inferSubjectPosition(textPosition: string) {
  if (textPosition.includes('left')) return 'center-right'
  if (textPosition.includes('right')) return 'center-left'
  if (textPosition.includes('top')) return 'lower-center'
  if (textPosition.includes('bottom')) return 'upper-center or center-right'
  return 'center with quiet surrounding space'
}
