import type { LayoutType, TypographyStyle, OverlayStyle, TextPosition, SafeArea } from '../layoutTypes'

export interface LayoutConfig {
  layoutType: LayoutType
  typographyStyle: TypographyStyle
  overlayStyle: OverlayStyle
  textPosition: TextPosition
  imageStyle: string
  safeArea: SafeArea
  preferredColorPalette: string[]
  recommendedHeadlineLength: number
  recommendedBodyLength: number
  visualMood: string
  // 에디토리얼 세부 규칙
  visualDensity: 'low' | 'medium' | 'high'
  spacingRules: {
    headlineLineGap: number
    bodyLineGap: number
    badgeToHeadlineGap: number
    headlineToBodyGap: number
  }
}
