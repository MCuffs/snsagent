import type { LayoutConfig } from './config'

export const quoteFocusConfig: LayoutConfig = {
  layoutType: 'quote-focus',
  typographyStyle: 'quote-large',
  overlayStyle: 'blur-overlay',
  textPosition: 'center',
  imageStyle: 'abstract atmospheric bokeh light background, deep depth of field, subtle textures',
  safeArea: { top: 120, bottom: 160, left: 80, right: 80 },
  preferredColorPalette: ['black', 'white', 'yellow'],
  recommendedHeadlineLength: 28,
  recommendedBodyLength: 70,
  visualMood: 'reflective, emotional, focused, premium quality card text area',
  visualDensity: 'low',
  spacingRules: {
    headlineLineGap: 1.16,
    bodyLineGap: 1.52,
    badgeToHeadlineGap: 30,
    headlineToBodyGap: 36,
  },
}
