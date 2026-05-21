import { LAYOUT_DEFINITIONS, type LayoutType, type OverlayStyle, type TextPosition, type TypographyStyle } from './layoutTypes'

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
  const config = LAYOUT_DEFINITIONS[input.layoutType]
  
  // Determine headline weight based on style rules
  let headlineWeight = 900
  if (config.typographyStyle === 'clean-sans') {
    headlineWeight = 800
  } else if (config.typographyStyle === 'stat-numeric') {
    headlineWeight = 950
  } else if (input.headlineLength > 22) {
    headlineWeight = 800
  }

  // Determine layout balance based on density, lengths, and hasNumericSignal
  let layoutBalance: 'image-heavy' | 'text-heavy' | 'balanced' = 'balanced'
  if (config.visualDensity === 'high' || input.bodyLength > 70) {
    layoutBalance = 'text-heavy'
  } else if (config.visualDensity === 'low' && input.bodyLength < 35) {
    layoutBalance = 'image-heavy'
  }

  // Map whitespace ratio from layout visual density
  let whitespaceRatio = 0.34
  if (config.visualDensity === 'high') {
    whitespaceRatio = 0.22
  } else if (config.visualDensity === 'low') {
    whitespaceRatio = 0.46
  } else if (input.bodyLength > 55) {
    whitespaceRatio = 0.28
  }

  return {
    headlinePosition: config.textPosition,
    headlineWeight,
    overlayStyle: config.overlayStyle,
    visualDensity: config.visualDensity || 'medium',
    layoutBalance,
    typographyStyle: config.typographyStyle,
    whitespaceRatio,
    styleCategory: input.layoutType,
  }
}
