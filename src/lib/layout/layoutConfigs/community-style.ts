import type { LayoutConfig } from './config'

export const communityStyleConfig: LayoutConfig = {
  layoutType: 'community-style',
  typographyStyle: 'bold-heavy',
  overlayStyle: 'bottom-shadow',
  textPosition: 'bottom-left',
  imageStyle: 'everyday realistic Korean scene, snapshot photography style, clean dark zone for overlay text',
  safeArea: { top: 80, bottom: 140, left: 60, right: 60 },
  preferredColorPalette: ['white', 'black', 'green'],
  recommendedHeadlineLength: 20,
  recommendedBodyLength: 52,
  visualMood: 'relatable, direct, casual, conversational',
  visualDensity: 'high',
  spacingRules: {
    headlineLineGap: 1.10,
    bodyLineGap: 1.42,
    badgeToHeadlineGap: 18,
    headlineToBodyGap: 34,
  },
}
