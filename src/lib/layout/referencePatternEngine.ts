import type { LayoutType, OverlayStyle, TextPosition, TypographyStyle } from './layoutTypes'

export interface ReferencePatternInput {
  layoutType: LayoutType
  headlineLength: number
  bodyLength: number
  hasNumericSignal: boolean
  imageDominance?: 'low' | 'medium' | 'high'
}

export interface ReferencePattern {
  headlinePosition: TextPosition
  headlineWeight: number
  overlayStyle: OverlayStyle
  visualDensity: 'low' | 'medium' | 'high'
  layoutBalance: 'image-heavy' | 'text-heavy' | 'balanced'
  typographyStyle: TypographyStyle
  whitespaceRatio: number
  styleCategory: LayoutType
}

export function analyzeReferencePattern(input: ReferencePatternInput): ReferencePattern {
  if (input.layoutType === 'stat-highlight') {
    return {
      headlinePosition: 'center',
      headlineWeight: 900,
      overlayStyle: 'vignette',
      visualDensity: 'low',
      layoutBalance: 'text-heavy',
      typographyStyle: 'stat-numeric',
      whitespaceRatio: 0.42,
      styleCategory: input.layoutType,
    }
  }

  if (input.layoutType === 'minimal-clean') {
    return {
      headlinePosition: 'top-left',
      headlineWeight: 800,
      overlayStyle: 'none',
      visualDensity: 'low',
      layoutBalance: 'balanced',
      typographyStyle: 'clean-sans',
      whitespaceRatio: 0.48,
      styleCategory: input.layoutType,
    }
  }

  if (input.layoutType === 'breaking-news') {
    return {
      headlinePosition: 'left-column',
      headlineWeight: 900,
      overlayStyle: 'left-shadow',
      visualDensity: 'high',
      layoutBalance: 'text-heavy',
      typographyStyle: 'condensed-news',
      whitespaceRatio: 0.24,
      styleCategory: input.layoutType,
    }
  }

  return {
    headlinePosition: input.layoutType === 'quote-focus' ? 'center' : 'bottom-left',
    headlineWeight: input.headlineLength > 24 ? 800 : 900,
    overlayStyle: input.layoutType === 'community-style' ? 'bottom-shadow' : 'dark-gradient',
    visualDensity: input.imageDominance || 'medium',
    layoutBalance: input.bodyLength > 70 ? 'text-heavy' : 'balanced',
    typographyStyle: input.layoutType === 'magazine' ? 'magazine-serif' : 'bold-heavy',
    whitespaceRatio: input.bodyLength > 70 ? 0.28 : 0.34,
    styleCategory: input.layoutType,
  }
}
