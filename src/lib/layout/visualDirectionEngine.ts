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

  const industryLower = (input.brandIndustry || '').toLowerCase()
  const categoryLower = input.category.toLowerCase()
  const toneLower = (input.brandToneOfVoice || input.tone || '').toLowerCase()

  let monochromeStyle = 'completely desaturated black and white photography, grayscale monochrome, high contrast, dark and moody background, raw texture, realistic film grain'
  if (/건강|웰빙|웰니스|유기농|푸드|식품|자연|식물|beauty|health|wellness|nature|organic/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'highly desaturated photography with a very subtle organic forest green monochrome tint, high contrast, atmospheric editorial shadows, natural soft lighting'
  } else if (/패션|뷰티|화장품|리빙|가구|인테리어|쇼핑|커머스|스토어|fashion|beauty|living|interior|store|commerce/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'highly desaturated photography with a very subtle warm cream and beige monochrome tint, soft contrast, premium aesthetic studio lighting, elegant shadows'
  } else if (/finance|tech|it|비즈니스|테크|금융|투자|vc|트렌드|startup/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'completely neutral charcoal black and white photography, high contrast grayscale, sharp shadows, cool moody editorial news photo'
  }

  let industryContext = ''
  if (/건강|웰빙|웰니스|유기농|푸드|식품|자연|식물|health|wellness|organic|food/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'a close-up symbolic texture of organic plants, soft shadows of leaves, raw wooden table surface, clean minimalist apothecary elements'
  } else if (/패션|뷰티|화장품|리빙|가구|인테리어|쇼핑|커머스|스토어|fashion|beauty|living|interior|store|commerce/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'a premium aesthetic product backdrop, close-up texture of organic linen fabric, minimalist ceramic plate, soft studio shadows of an arch shadow or blinds'
  } else if (/finance|tech|it|비즈니스|테크|금융|투자|vc|트렌드|startup/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'editorial abstract representation, newspaper typography collage pattern, minimalist office glass reflection, blurred chart background silhouette'
  } else {
    industryContext = 'abstract conceptual object, soft geometric shadows, minimalist atmospheric editorial composition with elegant negative space'
  }

  const prompt = [
    monochromeStyle,
    industryContext,
    `topic: ${input.topic}`,
    `category: ${input.category}`,
    `brand tone: ${input.brandToneOfVoice || input.tone}`,
    input.visualHint ? `visual reference direction: ${input.visualHint}` : '',
    `preferred color palette: ${palette}`,
    `subject positioning: ${subjectPosition}`,
    `reserve clean empty space for typography at ${safeTypographyArea}, ensure the text area has zero visual noise, perfect clean dark background for heavy text overlay`,
    `consider overlay readability: ${input.layout.overlayStyle}`,
    'realistic Instagram editorial media aesthetic, raw photography',
    'no text, no letters, no Hangul, no captions, no logo, no watermark',
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

function inferSubjectPosition(textPosition: string) {
  if (textPosition.includes('left')) return 'center-right'
  if (textPosition.includes('right')) return 'center-left'
  if (textPosition.includes('top')) return 'lower-center'
  if (textPosition.includes('bottom')) return 'upper-center or center-right'
  return 'center with quiet surrounding space'
}
