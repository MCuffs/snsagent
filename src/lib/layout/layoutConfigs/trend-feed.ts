import type { LayoutConfig } from './config'

export const trendFeedConfig: LayoutConfig = {
  layoutType: 'trend-feed',
  typographyStyle: 'bold-heavy',
  overlayStyle: 'bottom-shadow',
  textPosition: 'bottom-left',
  imageStyle: 'modern social feed snapshot, casual Korean urban vibe, clean negative space around center-right',
  safeArea: { top: 80, bottom: 150, left: 60, right: 60 },
  preferredColorPalette: ['black', 'white', 'orange'],
  recommendedHeadlineLength: 20,
  recommendedBodyLength: 50,
  visualMood: 'active, modern, timely, viral-optimized',
  visualDensity: 'medium',
  spacingRules: {
    headlineLineGap: 1.08,
    bodyLineGap: 1.42,
    badgeToHeadlineGap: 22,
    headlineToBodyGap: 36,
  },
}
