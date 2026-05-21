export type LayoutType =
  | 'breaking-news'
  | 'dark-editorial'
  | 'trend-feed'
  | 'magazine'
  | 'minimal-clean'
  | 'quote-focus'
  | 'split-comparison'
  | 'stat-highlight'
  | 'community-style'
  | 'cinematic-headline'

export type TypographyStyle =
  | 'bold-heavy'
  | 'condensed-news'
  | 'clean-sans'
  | 'magazine-serif'
  | 'quote-large'
  | 'stat-numeric'

export type OverlayStyle =
  | 'none'
  | 'dark-gradient'
  | 'blur-overlay'
  | 'vignette'
  | 'bottom-shadow'
  | 'left-shadow'

export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'left-column'
  | 'right-column'

export interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

export interface LayoutDefinition {
  layoutType: LayoutType
  typographyStyle: TypographyStyle
  overlayStyle: OverlayStyle
  textPosition: TextPosition
  imageStyle: string
  safeArea: SafeArea
  preferredColorPalette: string[]
  recommendedHeadlineLength: number
  recommendedBodyLength: number
  visualMood: string
}

export const LAYOUT_DEFINITIONS: Record<LayoutType, LayoutDefinition> = {
  'breaking-news': {
    layoutType: 'breaking-news',
    typographyStyle: 'condensed-news',
    overlayStyle: 'left-shadow',
    textPosition: 'left-column',
    imageStyle: 'documentary news photography, urgent editorial framing',
    safeArea: { top: 72, bottom: 140, left: 52, right: 52 },
    preferredColorPalette: ['black', 'white', 'red'],
    recommendedHeadlineLength: 18,
    recommendedBodyLength: 42,
    visualMood: 'urgent, high contrast, newsroom, factual',
  },
  'dark-editorial': {
    layoutType: 'dark-editorial',
    typographyStyle: 'bold-heavy',
    overlayStyle: 'dark-gradient',
    textPosition: 'bottom-left',
    imageStyle: 'cinematic Korean editorial photography',
    safeArea: { top: 80, bottom: 140, left: 48, right: 48 },
    preferredColorPalette: ['black', 'white'],
    recommendedHeadlineLength: 18,
    recommendedBodyLength: 45,
    visualMood: 'serious, immersive, dramatic',
  },
  'trend-feed': {
    layoutType: 'trend-feed',
    typographyStyle: 'bold-heavy',
    overlayStyle: 'bottom-shadow',
    textPosition: 'bottom-left',
    imageStyle: 'modern social feed photography, energetic composition',
    safeArea: { top: 76, bottom: 132, left: 54, right: 54 },
    preferredColorPalette: ['black', 'white', 'orange'],
    recommendedHeadlineLength: 20,
    recommendedBodyLength: 55,
    visualMood: 'timely, social, sharp, shareable',
  },
  magazine: {
    layoutType: 'magazine',
    typographyStyle: 'magazine-serif',
    overlayStyle: 'vignette',
    textPosition: 'bottom-center',
    imageStyle: 'premium magazine cover photography',
    safeArea: { top: 90, bottom: 150, left: 70, right: 70 },
    preferredColorPalette: ['cream', 'black', 'gold'],
    recommendedHeadlineLength: 22,
    recommendedBodyLength: 55,
    visualMood: 'premium, composed, editorial, polished',
  },
  'minimal-clean': {
    layoutType: 'minimal-clean',
    typographyStyle: 'clean-sans',
    overlayStyle: 'none',
    textPosition: 'top-left',
    imageStyle: 'clean studio background with generous whitespace',
    safeArea: { top: 82, bottom: 118, left: 64, right: 64 },
    preferredColorPalette: ['white', 'black', 'blue'],
    recommendedHeadlineLength: 24,
    recommendedBodyLength: 70,
    visualMood: 'clear, calm, informational, readable',
  },
  'quote-focus': {
    layoutType: 'quote-focus',
    typographyStyle: 'quote-large',
    overlayStyle: 'blur-overlay',
    textPosition: 'center',
    imageStyle: 'subtle portrait or abstract background with shallow depth',
    safeArea: { top: 110, bottom: 150, left: 70, right: 70 },
    preferredColorPalette: ['black', 'white', 'yellow'],
    recommendedHeadlineLength: 28,
    recommendedBodyLength: 40,
    visualMood: 'memorable, emotional, focused, save-worthy',
  },
  'split-comparison': {
    layoutType: 'split-comparison',
    typographyStyle: 'clean-sans',
    overlayStyle: 'none',
    textPosition: 'left-column',
    imageStyle: 'balanced split-screen conceptual photography',
    safeArea: { top: 78, bottom: 120, left: 52, right: 52 },
    preferredColorPalette: ['white', 'black', 'blue', 'orange'],
    recommendedHeadlineLength: 22,
    recommendedBodyLength: 58,
    visualMood: 'comparative, structured, objective',
  },
  'stat-highlight': {
    layoutType: 'stat-highlight',
    typographyStyle: 'stat-numeric',
    overlayStyle: 'vignette',
    textPosition: 'center',
    imageStyle: 'clean data journalism background, abstract information field',
    safeArea: { top: 86, bottom: 130, left: 64, right: 64 },
    preferredColorPalette: ['white', 'black', 'cyan'],
    recommendedHeadlineLength: 16,
    recommendedBodyLength: 48,
    visualMood: 'data-driven, authoritative, clear',
  },
  'community-style': {
    layoutType: 'community-style',
    typographyStyle: 'bold-heavy',
    overlayStyle: 'bottom-shadow',
    textPosition: 'bottom-left',
    imageStyle: 'Korean online community trend visual, casual realistic context',
    safeArea: { top: 70, bottom: 130, left: 50, right: 50 },
    preferredColorPalette: ['white', 'black', 'green'],
    recommendedHeadlineLength: 20,
    recommendedBodyLength: 52,
    visualMood: 'relatable, fast, community-driven, conversational',
  },
  'cinematic-headline': {
    layoutType: 'cinematic-headline',
    typographyStyle: 'bold-heavy',
    overlayStyle: 'dark-gradient',
    textPosition: 'bottom-center',
    imageStyle: 'cinematic portrait composition, strong subject and lighting',
    safeArea: { top: 82, bottom: 150, left: 58, right: 58 },
    preferredColorPalette: ['black', 'white', 'orange'],
    recommendedHeadlineLength: 18,
    recommendedBodyLength: 42,
    visualMood: 'dramatic, story-led, headline-first',
  },
}
