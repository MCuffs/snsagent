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

  // 1. 극단적으로 대비가 높고 톤다운된 에디토리얼 시네마틱 스타일 지정
  let monochromeStyle = 'completely desaturated black and white photography, grayscale monochrome, high contrast cinematic film, moody atmospheric shadows, realistic raw film grain'
  
  if (/건강|웰빙|웰니스|유기농|푸드|식품|자연|식물|beauty|health|wellness|nature|organic/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'highly desaturated photography with an extremely subtle organic forest green monochrome tint, high contrast, atmospheric editorial shadows, natural soft lighting, raw natural texture'
  } else if (/패션|뷰티|화장품|리빙|가구|인테리어|쇼핑|커머스|스토어|fashion|beauty|living|interior|store|commerce/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'highly desaturated photography with a very subtle warm cream and beige monochrome tint, soft contrast, premium aesthetic studio lighting, elegant shadows, premium linen texture'
  } else if (/finance|tech|it|비즈니스|테크|금융|투자|vc|트렌드|startup/.test(industryLower + categoryLower + toneLower)) {
    monochromeStyle = 'completely neutral charcoal black and white photography, high contrast grayscale, sharp industrial shadows, cool moody editorial news photo'
  }

  // 2. 피사체 배치에 여백(Negative Space) 확보
  let industryContext = ''
  if (/건강|웰빙|웰니스|유기농|푸드|식품|자연|식물|health|wellness|organic|food/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'a minimalist close-up texture of organic plants, soft shadows of leaves on a raw wooden table surface, clean minimalist apothecary elements'
  } else if (/패션|뷰티|화장품|리빙|가구|인테리어|쇼핑|커머스|스토어|fashion|beauty|living|interior|store|commerce/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'a premium aesthetic product backdrop, close-up texture of organic linen fabric, minimalist ceramic plate, soft studio shadows of blinds'
  } else if (/finance|tech|it|비즈니스|테크|금융|투자|vc|트렌드|startup/.test(industryLower + categoryLower + toneLower)) {
    industryContext = 'editorial abstract representation, blurred chart background silhouette, minimalist office glass reflection, neat professional geometry'
  } else {
    industryContext = 'abstract conceptual object, soft geometric shadows, minimalist atmospheric editorial composition with elegant negative space'
  }

  // 3. 텍스트 안전 영역 확보 지시 및 절대 문자 생성 금지 규칙 강화
  const prompt = [
    monochromeStyle,
    industryContext,
    `topic: ${input.topic}`,
    `category: ${input.category}`,
    `brand tone: ${input.brandToneOfVoice || input.tone}`,
    input.visualHint ? `visual reference direction: ${input.visualHint}` : '',
    `preferred color palette: ${palette}`,
    `subject positioning: ${subjectPosition}`,
    // 안전 가독성 영역 명시 (텍스트가 얹어질 공간은 피사체 없이 고요한 어둠 또는 여백으로 채우도록 유도)
    `reserve a completely clean, solid, empty negative space for typography at the ${safeTypographyArea} area, this safe area must have zero visual noise, no details, and a dark/clean background for heavy overlay text`,
    `consider overlay style: ${input.layout.overlayStyle}`,
    'realistic Korean Instagram explore feed style raw photography, mobile-first social composition',
    // 절대적 텍스트 배제 규칙 (중요)
    'NEVER generate any text, no typography, no letters, no alphabet, no Hangul, no korean characters, no numbers, no words, no captions, no logo, no watermark, no framing borders, no UI mockups, no buttons',
    '1080x1350 vertical portrait composition, social media aspect ratio',
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
  // 텍스트 위치의 반대 방향 또는 중앙 주변부에 조용히 배치하도록 피사체 조율
  if (textPosition.includes('left')) return 'center-right or right-side composition, keeping the left side empty'
  if (textPosition.includes('right')) return 'center-left or left-side composition, keeping the right side empty'
  if (textPosition.includes('top')) return 'lower-center composition, keeping the upper portion empty'
  if (textPosition.includes('bottom')) return 'upper-center or center-right composition, keeping the lower portion empty'
  return 'center with quiet surrounding blank negative space'
}
