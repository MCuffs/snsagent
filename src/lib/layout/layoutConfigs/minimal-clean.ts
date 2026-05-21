import type { LayoutConfig } from './config'

export const minimalCleanConfig: LayoutConfig = {
  layoutType: 'minimal-clean',
  typographyStyle: 'clean-sans',
  overlayStyle: 'none',
  textPosition: 'top-left',
  imageStyle: 'minimalist clean room or studio backdrop, massive negative space, white and gray tone objects',
  safeArea: { top: 100, bottom: 130, left: 64, right: 64 },
  preferredColorPalette: ['white', 'black', 'blue'],
  recommendedHeadlineLength: 24,
  recommendedBodyLength: 70,
  visualMood: 'pure, clean, neat, calm',
  visualDensity: 'low',
  spacingRules: {
    headlineLineGap: 1.12,
    bodyLineGap: 1.48,
    badgeToHeadlineGap: 24,
    headlineToBodyGap: 44,
  },
}
