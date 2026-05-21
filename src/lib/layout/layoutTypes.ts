import { LAYOUT_CONFIGS } from './layoutConfigs'

export type LayoutType =
  | 'breaking-news'
  | 'dark-editorial'
  | 'trend-feed'
  | 'magazine'
  | 'minimal-clean'
  | 'quote-focus'
  | 'split-comparison'
  | 'stat-highlight'
  | 'community-style'
  | 'cinematic-headline'

export type TypographyStyle =
  | 'bold-heavy'
  | 'condensed-news'
  | 'clean-sans'
  | 'magazine-serif'
  | 'quote-large'
  | 'stat-numeric'

export type OverlayStyle =
  | 'none'
  | 'dark-gradient'
  | 'blur-overlay'
  | 'vignette'
  | 'bottom-shadow'
  | 'left-shadow'

export type TextPosition =
  | 'top-left'
  | 'top-center'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'left-column'
  | 'right-column'

export interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

export interface LayoutDefinition {
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
  // 에디토리얼 속성 추가 지원
  visualDensity?: 'low' | 'medium' | 'high'
  spacingRules?: {
    headlineLineGap: number
    bodyLineGap: number
    badgeToHeadlineGap: number
    headlineToBodyGap: number
  }
}

// LAYOUT_DEFINITIONS 상수를 LAYOUT_CONFIGS로 맵핑하여 기존 파이프라인 코드들과 하위 호환성 유지
export const LAYOUT_DEFINITIONS: Record<LayoutType, LayoutDefinition> = LAYOUT_CONFIGS
