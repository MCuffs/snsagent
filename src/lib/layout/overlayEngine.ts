import type { OverlayStyle } from './layoutTypes'

export interface OverlayPlan {
  overlayStyle: OverlayStyle
  svgDefs: string
  svgMarkup: string
  textColor: string
  secondaryTextColor: string
}

export function generateOverlay(overlayStyle: OverlayStyle): OverlayPlan {
  if (overlayStyle === 'dark-gradient') {
    return {
      overlayStyle,
      svgDefs: `
        <linearGradient id="overlay-dark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.02"/>
          <stop offset="42%" stop-color="#000000" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.86"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-dark-gradient)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255,255,255,0.78)',
    }
  }

  if (overlayStyle === 'left-shadow') {
    return {
      overlayStyle,
      svgDefs: `
        <linearGradient id="overlay-left-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.78"/>
          <stop offset="56%" stop-color="#000000" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-left-shadow)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255,255,255,0.78)',
    }
  }

  if (overlayStyle === 'bottom-shadow') {
    return {
      overlayStyle,
      svgDefs: `
        <linearGradient id="overlay-bottom-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="68%" stop-color="#000000" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.72"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-bottom-shadow)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255,255,255,0.8)',
    }
  }

  if (overlayStyle === 'vignette') {
    return {
      overlayStyle,
      svgDefs: `
        <radialGradient id="overlay-vignette" cx="50%" cy="42%" r="72%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="70%" stop-color="#000000" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
        </radialGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-vignette)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255,255,255,0.78)',
    }
  }

  if (overlayStyle === 'blur-overlay') {
    return {
      overlayStyle,
      svgDefs: '',
      svgMarkup: '<rect x="54" y="110" width="972" height="1130" rx="34" fill="#ffffff" fill-opacity="0.82"/>',
      textColor: '#111111',
      secondaryTextColor: '#4b5563',
    }
  }

  return {
    overlayStyle,
    svgDefs: '',
    svgMarkup: '',
    textColor: '#111111',
    secondaryTextColor: '#4b5563',
  }
}
