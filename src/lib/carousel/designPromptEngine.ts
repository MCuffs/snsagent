import type { BrandProfile, CampaignInput, SlideCopy, SlideDesignPrompt, TextPosition } from './types'

export async function generateDesignPrompts(
  brand: BrandProfile,
  input: CampaignInput,
  copies: SlideCopy[]
): Promise<SlideDesignPrompt[]> {
  return copies.map((copy): SlideDesignPrompt => {
    const textPosition = pickTextPosition(copy.slideNumber, copies.length)
    return {
      slideNumber: copy.slideNumber,
      backgroundPrompt: [
        'minimal clean ecommerce product background',
        'Korean Instagram carousel card news style',
        'soft lighting',
        'plenty of whitespace for text overlay',
        'square 1080x1080 composition',
        `brand accent color ${brand.mainColor}`,
        `product context: ${input.productName}`,
        'no text, no letters, no typography, no Hangul',
      ].join(', '),
      layoutStyle: 'minimal-commerce',
      textPosition,
      visualMood: 'clean, trustworthy, modern',
    }
  })
}

function pickTextPosition(slideNumber: number, slideCount: number): TextPosition {
  if (slideNumber === 1) return 'center'
  if (slideNumber === slideCount) return 'bottom'
  return slideNumber % 2 === 0 ? 'top' : 'center'
}
