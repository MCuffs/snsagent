import type { LayoutConfig } from './config'

export const statHighlightConfig: LayoutConfig = {
  layoutType: 'stat-highlight',
  typographyStyle: 'stat-numeric',
  overlayStyle: 'vignette',
  textPosition: 'center',
  imageStyle: 'abstract data visualization, clean futuristic geometric pattern with huge negative space',
  safeArea: { top: 90, bottom: 150, left: 70, right: 70 },
  preferredColorPalette: ['white', 'black', 'cyan'],
  recommendedHeadlineLength: 16,
  recommendedBodyLength: 48,
  visualMood: 'data-driven, precise, clear, authoritative',
  visualDensity: 'low',
  spacingRules: {
    headlineLineGap: 1.05,
    bodyLineGap: 1.40,
    badgeToHeadlineGap: 24,
    headlineToBodyGap: 30,
  },
}
