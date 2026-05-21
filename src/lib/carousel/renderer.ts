import { uploadGeneratedAsset } from '../storage/upload'
import type { BrandProfile, SlideCopy, SlideDesignPrompt } from './types'

export async function renderSlide(params: {
  campaignKey: string
  brand: BrandProfile
  copy: SlideCopy
  design: SlideDesignPrompt
  backgroundImageUrl: string
  showSlideNumber?: boolean
}) {
  const y = params.design.textPosition === 'top' ? 250 : params.design.textPosition === 'bottom' ? 700 : 500
  const escapedHeadline = escapeXml(params.copy.headline)
  const escapedBody = escapeXml(params.copy.body)
  const escapedCta = escapeXml(params.copy.ctaText || '')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${escapeXml(params.brand.mainColor || '#ff4f00')}" stop-opacity="0.18"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="20" flood-color="#111827" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <image href="${escapeXml(params.backgroundImageUrl)}" x="0" y="0" width="1080" height="1080" preserveAspectRatio="xMidYMid slice" opacity="0.24"/>
  <rect x="110" y="${y - 190}" width="860" height="${escapedCta ? 390 : 320}" rx="34" fill="#ffffff" opacity="0.92" filter="url(#shadow)"/>
  <text x="540" y="${y - 40}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="64" font-weight="800" fill="#111827">${escapedHeadline}</text>
  <foreignObject x="190" y="${y + 10}" width="700" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif; font-size: 34px; font-weight: 600; color: #334155; line-height: 1.35; text-align: center;">${escapedBody}</div>
  </foreignObject>
  ${escapedCta ? `<rect x="350" y="${y + 180}" width="380" height="74" rx="37" fill="${escapeXml(params.brand.mainColor || '#ff4f00')}"/><text x="540" y="${y + 228}" text-anchor="middle" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="28" font-weight="800" fill="#ffffff">${escapedCta}</text>` : ''}
  <text x="70" y="985" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="26" font-weight="800" fill="#111827" opacity="0.72">${escapeXml(params.brand.name)}</text>
  ${params.showSlideNumber ? `<text x="1010" y="985" text-anchor="end" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#64748b">${params.copy.slideNumber}</text>` : ''}
</svg>`

  return uploadGeneratedAsset({
    fileName: `${params.campaignKey}-slide-${params.copy.slideNumber}.svg`,
    content: svg,
    contentType: 'image/svg+xml',
  })
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
