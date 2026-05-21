import type { LayoutConfig } from './config'

export const breakingNewsConfig: LayoutConfig = {
  layoutType: 'breaking-news',
  typographyStyle: 'condensed-news',
  overlayStyle: 'left-shadow',
  textPosition: 'left-column',
  imageStyle: 'documentary news photography, real life journalism, high contrast empty background area',
  safeArea: { top: 80, bottom: 150, left: 60, right: 60 },
  preferredColorPalette: ['black', 'white', 'red'],
  recommendedHeadlineLength: 16,
  recommendedBodyLength: 40,
  visualMood: 'urgent, informative, direct, bold',
  visualDensity: 'high',
  spacingRules: {
    headlineLineGap: 1.05,
    bodyLineGap: 1.40,
    badgeToHeadlineGap: 20,
    headlineToBodyGap: 32,
  },
}
