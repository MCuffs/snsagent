import { LAYOUT_DEFINITIONS, type LayoutDefinition } from './layoutTypes'
import { formatVisualBrandLanguage, translateBrandToVisualLanguage } from './brandHarness'
import type { EditorialSlideRole, EditorialVisualDirection } from '../editorial/editorialDirector'
import { formatDomainVisualGuidance, getDomainProfileForText } from '../content/domainProfile'

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
  role?: EditorialSlideRole
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
  const profile = getDomainProfileForText(topic, category)
  if (profile.domain !== 'general') return profile.imageSubject

  const text = `${topic} ${category}`.toLowerCase()
  if (text.includes('bag') || text.includes('백') || text.includes('가방')) return 'a premium designer bag'
  if (text.includes('shoe') || text.includes('슈즈') || text.includes('스니커즈') || text.includes('신발')) return 'designer shoes'
  if (text.includes('cosmetic') || text.includes('세럼') || text.includes('크림') || text.includes('화장품') || text.includes('skin') || text.includes('뷰티') || text.includes('토너') || text.includes('앰플')) return 'a premium skincare cosmetic bottle'
  if (text.includes('coffee') || text.includes('커피') || text.includes('카페') || text.includes('원두')) return 'a cup of coffee'
  if (text.includes('snack') || text.includes('간식') || text.includes('그래놀라') || text.includes('쿠키') || text.includes('식품')) return 'an opened pouch of bite-sized snacks with realistic food texture'
  if (text.includes('chair') || text.includes('의자') || text.includes('furniture') || text.includes('가구')) return 'minimalist designer furniture'
  if (text.includes('tumbler') || text.includes('텀블러') || text.includes('보틀') || text.includes('컵')) return 'a sleek minimalist tumbler'
  if (text.includes('clothing') || text.includes('의류') || text.includes('옷') || text.includes('패션') || text.includes('shirt') || text.includes('아우터')) return 'modern editorial clothing'
  
  return `one tangible lived-in usage cue for ${topic.replace(/\s+/g, ' ').trim().slice(0, 60) || 'the featured product'}`
}

export function generateVisualDirection(input: VisualDirectionInput): VisualDirection {
  const context = `${input.brandIndustry || ''} ${input.category} ${input.topic} ${input.tone}`.toLowerCase()
  const domainProfile = getDomainProfileForText(input.topic, input.category, input.tone, input.brandIndustry, input.visualHint, input.brandDna)
  const role = input.role || 'detail'
  const roleDirection = roleVisualLanguage(role)
  const scene = inferScene(context, domainProfile.imageScene)
  const subject = inferSubject(input.topic, input.category)
  const brandLanguage = translateBrandToVisualLanguage({
    brandIndustry: input.brandIndustry,
    brandToneOfVoice: input.brandToneOfVoice,
    brandMainColor: input.brandMainColor,
    brandDna: input.brandDna,
  })
  const subjectPosition = roleDirection.subjectPosition
  const safeTypographyArea = roleDirection.copySafeArea

  const prompt = [
    'CONTRACT: Background-only vertical editorial photograph for a Korean Instagram carousel; final typography is added by the application.',
    `PRIMARY SCENE: ${scene}; feature ${subject} in a single believable moment. ${roleDirection.narrativeBeat}.`,
    `CAMERA AND EMOTION: ${roleDirection.camera}; ${roleDirection.emotion}. ${input.editorialDirection?.imagePurpose || ''}`.trim(),
    `COMPOSITION: Portrait source intended for a final 4:5 crop; ${subjectPosition}; reserve ${safeTypographyArea} as quiet low-detail negative space; keep essential details inside the central crop-safe region.`,
    formatDomainVisualGuidance(domainProfile),
    `BRAND TRANSLATION: ${formatVisualBrandLanguage(brandLanguage)}.`,
    `KOREAN REALISM: ${roleDirection.realism}; subtle sensor grain, natural surface wear, believable reflections, restrained retouching.`,
    input.visualHint ? `REFERENCE DIRECTION: ${input.visualHint}.` : '',
  ].filter(Boolean).join('\n')

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

function inferScene(text: string, domainScene?: string) {
  if (domainScene) return domainScene
  if (/정치|사회|뉴스|시장|금융|vc|스타트업|투자|tech|it|business/.test(text)) {
    return 'weekday Seoul office or startup meeting table with glass reflections, notebook edge, and a lived-in working trace'
  }
  if (/여행|공간|장소|로컬|맛집|카페|생활|라이프/.test(text)) {
    return 'rain-softened Seongsu side-street cafe window seat with tray, pavement reflection, and an unposed daily trace'
  }
  if (/제품|출시|브랜드|커머스|스토어|패션|뷰티|리빙/.test(text)) {
    return 'small Seoul apartment entryway or shelf vignette with fabric texture, practical storage details, and natural daylight'
  }
  if (/건강|웰니스|식품|자연|운동/.test(text)) {
    return 'weekday 3:40 PM Seoul shared-office break scene with natural crumbs, reusable bottle, and softened window daylight'
  }
  return 'realistic Korean daily-life setting with one clear subject, a human usage trace, and natural available light'
}

function roleVisualLanguage(role: EditorialSlideRole) {
  const language: Record<EditorialSlideRole, {
    narrativeBeat: string
    camera: string
    emotion: string
    subjectPosition: string
    copySafeArea: string
    realism: string
  }> = {
    hook: {
      narrativeBeat: 'Capture an unresolved interruption rather than a polished product beauty shot',
      camera: '35mm close documentary framing, asymmetric foreground tension and a slight off-axis angle',
      emotion: 'curiosity with restrained tension',
      subjectPosition: 'place the key subject on the upper-right or middle-right third',
      copySafeArea: 'the lower-left 42% of the frame',
      realism: 'unposed workday evidence and imperfect object alignment',
    },
    context: {
      narrativeBeat: 'Show a recognizable everyday situation before the solution appears',
      camera: '50mm eye-level observational framing with moderate depth',
      emotion: 'recognition and empathy',
      subjectPosition: 'place the situational action in the lower-right zone',
      copySafeArea: 'the upper-left 35% of the frame',
      realism: 'ordinary Korean routine objects and available daylight',
    },
    'key-point': {
      narrativeBeat: 'Reduce the problem to one memorable physical contrast',
      camera: '70mm focused editorial crop with one defining detail',
      emotion: 'clarity after tension',
      subjectPosition: 'place one defining object in the middle-right zone',
      copySafeArea: 'the left 40% of the frame',
      realism: 'tactile material texture and plausible use marks',
    },
    detail: {
      narrativeBeat: 'Prove value through a practical in-use moment and tactile detail',
      camera: '50mm close documentary view or restrained macro detail with realistic depth of field',
      emotion: 'confidence and practical desire',
      subjectPosition: 'place the product interaction in the upper-right to middle-right zone',
      copySafeArea: 'the lower-left 38% of the frame',
      realism: 'hands, folds, crumbs, condensation, fabric, or subtle repeated-use traces',
    },
    stat: {
      narrativeBeat: 'Show quiet physical evidence rather than a literal infographic',
      camera: 'stable front-facing frame with simplified geometry and controlled depth',
      emotion: 'trust',
      subjectPosition: 'place a single evidence-supporting object on the right half',
      copySafeArea: 'the left 45% of the frame',
      realism: 'ordered but not sterile props with natural lighting falloff',
    },
    summary: {
      narrativeBeat: 'Resolve the previous tension in an open, breathable lifestyle moment',
      camera: '50mm relaxed framing with increased spatial breathing room',
      emotion: 'relief and resolution',
      subjectPosition: 'place the resolved moment in the lower-right or center-right zone',
      copySafeArea: 'the upper-left 40% of the frame',
      realism: 'natural completion cues without posed celebration',
    },
    'save-cta': {
      narrativeBeat: 'End on one calm object that leaves a memorable brand afterimage',
      camera: 'restrained still-life framing, nearly front-facing, generous quiet space',
      emotion: 'satisfaction and low-friction action',
      subjectPosition: 'keep one small object centered slightly above the middle',
      copySafeArea: 'the central and lower 50% of the frame',
      realism: 'minimal props, controlled shadow, no decorative clutter',
    },
  }
  return language[role]
}
