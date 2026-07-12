import type { LayoutDefinition } from '../../src/lib/layout/layoutTypes'
import type { OverlayPlan } from '../../src/lib/layout/overlayEngine'
import type { TemplateSlideConfig, TemplateOverlay, TemplateBackground } from './types'

// 'cover' is the model's default framing, so it adds no directive (avoids redundant prompt noise).
const CROP_HINTS: Partial<Record<TemplateBackground['cropStyle'], string>> = {
  contain: 'centered subject with generous negative space',
  top: 'subject framed toward the top of the frame',
  center: 'balanced centered composition',
  bottom: 'subject framed toward the bottom of the frame',
}

/**
 * Builds an image-generation style directive from a template's background rules so each
 * template yields a distinct background mood. Returns '' when there is nothing to add.
 * The caller is responsible for sanitizing the result before sending to the image model.
 */
export function templateBackgroundPromptHint(bg: TemplateBackground): string {
  const parts: string[] = []
  const style = bg.imageStyle?.trim()
  if (style) parts.push(style)
  const crop = CROP_HINTS[bg.cropStyle]
  if (crop) parts.push(crop)
  if (bg.blur >= 8) parts.push('soft shallow depth-of-field background blur')
  return parts.length ? `Visual style direction: ${parts.join(', ')}.` : ''
}

export interface TemplateRenderOverrides {
  textColorOverride: string
  headlineFontSizeOverride: number
  bodyFontSizeOverride: number
  bodyTextColorOverride?: string
  emphasisColorOverride?: string
  textPositionOverride: string // one of the 9 logical positions, honored by renderMediaCard
  headlineWeightOverride: number
  headlineTrackingOverride: number
  headlineLineHeightOverride: number
  paddingXOverride: number
  paddingYOverride: number
}

export interface AppliedTemplateRender {
  layout: LayoutDefinition
  overlay: OverlayPlan
  overrides: TemplateRenderOverrides
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Builds an OverlayPlan that honors the template's continuous opacity (and custom color),
 * rather than snapping to a fixed preset — so the generated image matches the admin preview.
 */
function buildTemplateOverlay(o: TemplateOverlay): OverlayPlan {
  const a = clamp01(o.opacity / 100).toFixed(3)
  const rect = (fill: string, opacity: string) =>
    `<rect width="1080" height="1350" fill="${fill}" fill-opacity="${opacity}"/>`

  switch (o.type) {
    case 'none':
      // Non-empty but invisible so renderMediaCard does not substitute its fallback overlay.
      return { overlayStyle: 'none', svgDefs: '', svgMarkup: rect('#000000', '0'), textColor: '#ffffff', secondaryTextColor: 'rgba(255,255,255,0.78)' }
    case 'light':
      return { overlayStyle: 'archive-light', svgDefs: '', svgMarkup: rect('#f4f4f2', a), textColor: '#050505', secondaryTextColor: 'rgba(0,0,0,0.54)' }
    case 'gradient':
      return {
        overlayStyle: 'dark-gradient',
        svgDefs: `<linearGradient id="overlay-tmpl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a0a0c" stop-opacity="0"/>
          <stop offset="55%" stop-color="#0a0a0c" stop-opacity="${(clamp01(o.opacity / 100) * 0.45).toFixed(3)}"/>
          <stop offset="100%" stop-color="#0a0a0c" stop-opacity="${a}"/>
        </linearGradient>`,
        svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-tmpl)"/>',
        textColor: '#ffffff',
        secondaryTextColor: 'rgba(255,255,255,0.68)',
      }
    case 'custom':
      return { overlayStyle: 'bottom-shadow', svgDefs: '', svgMarkup: rect(o.customColor || '#000000', a), textColor: '#ffffff', secondaryTextColor: 'rgba(255,255,255,0.72)' }
    case 'dark':
    default:
      return { overlayStyle: 'archive-dark', svgDefs: '', svgMarkup: rect('#08080a', a), textColor: '#ffffff', secondaryTextColor: 'rgba(255,255,255,0.58)' }
  }
}

/**
 * Maps a template slide config onto the generation pipeline's render inputs:
 * full 9-position text anchor, continuous-opacity overlay, and the per-call render
 * overrides (text color / headline + body font size) that renderMediaCard accepts.
 */
export function applyTemplateSlideToRender(
  baseLayout: LayoutDefinition,
  slide: TemplateSlideConfig,
): AppliedTemplateRender {
  const overlay = buildTemplateOverlay(slide.overlay)

  const layout: LayoutDefinition = {
    ...baseLayout,
    // Keep layout.overlayStyle consistent with the overlay we built (renderer reads it for
    // text-color defaults and the bottom-anchor offset).
    overlayStyle: overlay.overlayStyle,
    imageStyle: slide.background.imageStyle?.trim() || baseLayout.imageStyle,
  }

  const headline = Math.round(slide.typography.fontSize)
  const body = slide.typography.bodyFontSize ?? Math.max(20, Math.round(slide.typography.fontSize * 0.42))

  return {
    layout,
    overlay,
    overrides: {
      textColorOverride: slide.typography.textColor,
      headlineFontSizeOverride: headline,
      bodyFontSizeOverride: body,
      bodyTextColorOverride: slide.typography.bodyColor,
      emphasisColorOverride: slide.typography.emphasisColor,
      textPositionOverride: slide.textPosition,
      headlineWeightOverride: slide.typography.fontWeight,
      headlineTrackingOverride: slide.typography.letterSpacing,
      headlineLineHeightOverride: slide.typography.lineHeight,
      paddingXOverride: slide.layout.paddingX,
      paddingYOverride: slide.layout.paddingY,
    },
  }
}
