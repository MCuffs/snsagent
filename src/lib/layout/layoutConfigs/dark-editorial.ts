import type { LayoutConfig } from './config'

export const darkEditorialConfig: LayoutConfig = {
  layoutType: 'dark-editorial',
  typographyStyle: 'bold-heavy',
  overlayStyle: 'dark-gradient',
  textPosition: 'bottom-left',
  imageStyle: 'cinematic Korean editorial photography, moody atmospheric shadows, realistic raw film texture',
  safeArea: { top: 80, bottom: 160, left: 60, right: 60 },
  preferredColorPalette: ['black', 'white'],
  recommendedHeadlineLength: 18,
  recommendedBodyLength: 45,
  visualMood: 'serious, immersive, dramatic, clean background for typography',
  visualDensity: 'medium',
  spacingRules: {
    headlineLineGap: 1.10,
    bodyLineGap: 1.45,
    badgeToHeadlineGap: 24,
    headlineToBodyGap: 38,
  },
}
