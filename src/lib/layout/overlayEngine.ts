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
          <stop offset="0%" stop-color="#171717" stop-opacity="0.28"/>
          <stop offset="42%" stop-color="#171717" stop-opacity="0.34"/>
          <stop offset="68%" stop-color="#171717" stop-opacity="0.54"/>
          <stop offset="88%" stop-color="#111111" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#0b0b0b" stop-opacity="0.92"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="#8c8c8c" fill-opacity="0.24"/><rect width="1080" height="1350" fill="url(#overlay-dark-gradient)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.68)',
    }
  }

  if (overlayStyle === 'left-shadow') {
    return {
      overlayStyle,
      svgDefs: `
        <linearGradient id="overlay-left-shadow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.92"/>
          <stop offset="20%" stop-color="#000000" stop-opacity="0.76"/>
          <stop offset="50%" stop-color="#000000" stop-opacity="0.32"/>
          <stop offset="80%" stop-color="#000000" stop-opacity="0.04"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.0"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-left-shadow)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.74)',
    }
  }

  if (overlayStyle === 'bottom-shadow') {
    return {
      overlayStyle,
      svgDefs: `
        <linearGradient id="overlay-bottom-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#202020" stop-opacity="0.24"/>
          <stop offset="58%" stop-color="#202020" stop-opacity="0.32"/>
          <stop offset="82%" stop-color="#101010" stop-opacity="0.66"/>
          <stop offset="100%" stop-color="#080808" stop-opacity="0.90"/>
        </linearGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="#8c8c8c" fill-opacity="0.18"/><rect width="1080" height="1350" fill="url(#overlay-bottom-shadow)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.68)',
    }
  }

  if (overlayStyle === 'vignette') {
    return {
      overlayStyle,
      svgDefs: `
        <radialGradient id="overlay-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.0"/>
          <stop offset="45%" stop-color="#000000" stop-opacity="0.10"/>
          <stop offset="75%" stop-color="#000000" stop-opacity="0.44"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.82"/>
        </radialGradient>`,
      svgMarkup: '<rect width="1080" height="1350" fill="url(#overlay-vignette)"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.74)',
    }
  }

  if (overlayStyle === 'blur-overlay') {
    // 텍스트 후면 카드 형태로 글래스모피즘 분위기를 내며 가독성을 완전히 살리는 레이어
    return {
      overlayStyle,
      svgDefs: '',
      svgMarkup: '<rect x="54" y="110" width="972" height="1130" rx="36" fill="#ffffff" fill-opacity="0.86"/>',
      textColor: '#111111',
      secondaryTextColor: '#374151',
    }
  }

  // contrast-mask 신규 추가 (미디엄 라이트 그레이 톤으로 대비를 억누르는 효과)
  if ((overlayStyle as string) === 'contrast-mask') {
    return {
      overlayStyle,
      svgDefs: '',
      svgMarkup: '<rect width="1080" height="1350" fill="#000000" fill-opacity="0.32"/>',
      textColor: '#ffffff',
      secondaryTextColor: 'rgba(255, 255, 255, 0.82)',
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
