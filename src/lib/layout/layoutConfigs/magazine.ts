import type { LayoutConfig } from './config'

export const magazineConfig: LayoutConfig = {
  layoutType: 'magazine',
  typographyStyle: 'magazine-serif',
  overlayStyle: 'vignette',
  textPosition: 'bottom-center',
  imageStyle: 'premium luxury editorial backdrop, minimalist aesthetic studio props, warm ambient glow',
  safeArea: { top: 90, bottom: 160, left: 70, right: 70 },
  preferredColorPalette: ['cream', 'black', 'gold'],
  recommendedHeadlineLength: 22,
  recommendedBodyLength: 55,
  visualMood: 'luxurious, sophisticated, slow, premium',
  visualDensity: 'low',
  spacingRules: {
    headlineLineGap: 1.15,
    bodyLineGap: 1.50,
    badgeToHeadlineGap: 28,
    headlineToBodyGap: 40,
  },
}
