import type { LayoutConfig } from './config'

export const cinematicHeadlineConfig: LayoutConfig = {
  layoutType: 'cinematic-headline',
  typographyStyle: 'bold-heavy',
  overlayStyle: 'dark-gradient',
  textPosition: 'bottom-center',
  imageStyle: 'cinematic dramatic composition, realistic strong lighting, epic cinematic portrait backdrop with clear void for text',
  safeArea: { top: 90, bottom: 160, left: 64, right: 64 },
  preferredColorPalette: ['black', 'white', 'orange'],
  recommendedHeadlineLength: 18,
  recommendedBodyLength: 42,
  visualMood: 'dramatic, epic, story-driven, premium',
  visualDensity: 'medium',
  spacingRules: {
    headlineLineGap: 1.08,
    bodyLineGap: 1.44,
    badgeToHeadlineGap: 26,
    headlineToBodyGap: 38,
  },
}
