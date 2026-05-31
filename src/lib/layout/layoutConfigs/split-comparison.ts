import type { LayoutConfig } from './config'

export const splitComparisonConfig: LayoutConfig = {
  layoutType: 'split-comparison',
  typographyStyle: 'clean-sans',
  overlayStyle: 'none',
  textPosition: 'left-column',
  imageStyle: 'symmetrical split conceptual studio photography, side-by-side object comparison context',
  safeArea: { top: 80, bottom: 140, left: 60, right: 60 },
  preferredColorPalette: ['white', 'black', 'blue', 'orange'],
  recommendedHeadlineLength: 22,
  recommendedBodyLength: 70,
  visualMood: 'structured, objective, clean, comparative',
  visualDensity: 'medium',
  spacingRules: {
    headlineLineGap: 1.10,
    bodyLineGap: 1.44,
    badgeToHeadlineGap: 20,
    headlineToBodyGap: 34,
  },
}
