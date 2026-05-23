import sharp from 'sharp'
import type { ImageProvider } from '../imageProvider'
import { uploadGeneratedAsset } from '../../storage/upload'

type ArchiveBackgroundTemplate = 'product-light' | 'product-dark' | 'journal-light' | 'cta-dark'

export class MockImageProvider implements ImageProvider {
  async generateImage(prompt: string): Promise<{ imageUrl: string }> {
    const template = inferArchiveTemplate(prompt)
    const seed = hashPrompt(prompt)
    const svg = renderArchiveBackground(template, seed)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    const imageUrl = await uploadGeneratedAsset({
      fileName: `archive-bg-${template}-${Date.now()}-${seed.toString(36)}.png`,
      content: png,
      contentType: 'image/png',
    })

    return { imageUrl }
  }
}

function inferArchiveTemplate(prompt: string): ArchiveBackgroundTemplate {
  const normalized = prompt.toLowerCase()
  if (normalized.includes('black closing slide') || normalized.includes('ending card')) return 'cta-dark'
  if (normalized.includes('journal archive') || normalized.includes('grayscale editorial')) return 'journal-light'
  if (normalized.includes('bright product archive') || normalized.includes('off-white studio')) return 'product-light'
  return 'product-dark'
}

function renderArchiveBackground(template: ArchiveBackgroundTemplate, seed: number) {
  if (template === 'cta-dark') return renderCtaBackground(seed)
  if (template === 'journal-light') return renderJournalBackground(seed)
  if (template === 'product-light') return renderProductBackground(seed, true)
  return renderProductBackground(seed, false)
}

function renderProductBackground(seed: number, light: boolean) {
  const bg = light ? '#f4f3ef' : '#8a8a88'
  const shadow = light ? '0.20' : '0.34'
  const objectY = light ? 440 : 500
  const itemA = pick(seed, ['#d7d7d2', '#c9d4cf', '#dfd8c8', '#d8ded8'])
  const itemB = pick(seed + 1, ['#f2f0e7', '#d3d0c2', '#c5c9bd', '#e1dccd'])
  const accent = pick(seed + 2, ['#9b2d1b', '#2f5f4d', '#1f4f8a', '#7d6b2d'])

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${light ? '#fbfaf7' : '#656563'}"/>
      </linearGradient>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="36" stdDeviation="42" flood-color="#000000" flood-opacity="${shadow}"/>
      </filter>
      <linearGradient id="bagShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#242424"/>
        <stop offset="100%" stop-color="#050505"/>
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)"/>
    ${light ? renderWallRails() : '<rect x="66" y="96" width="948" height="1104" fill="#ffffff" fill-opacity="0.08"/>'}
    <g filter="url(#softShadow)" transform="translate(0 ${objectY})">
      <rect x="298" y="276" width="484" height="246" rx="34" fill="url(#bagShade)"/>
      <rect x="322" y="302" width="436" height="74" rx="22" fill="#050505" fill-opacity="0.72"/>
      <rect x="338" y="156" width="142" height="202" rx="12" fill="${itemA}" transform="rotate(-5 409 257)"/>
      <rect x="470" y="120" width="168" height="244" rx="14" fill="${itemB}" transform="rotate(4 554 242)"/>
      <rect x="588" y="210" width="122" height="122" rx="10" fill="${accent}" fill-opacity="0.86"/>
      <path d="M310 338 C252 342 230 396 252 438 C272 476 318 454 318 418 C318 386 284 380 278 410" fill="none" stroke="#dedede" stroke-width="12" stroke-linecap="round" opacity="0.82"/>
      <circle cx="732" cy="420" r="58" fill="none" stroke="${light ? '#d5d5d0' : '#333333'}" stroke-width="34" opacity="0.72"/>
      <rect x="728" y="390" width="120" height="120" rx="18" fill="${light ? '#e6e3da' : '#363636'}" opacity="0.56"/>
    </g>
  </svg>`
}

function renderJournalBackground(seed: number) {
  const tone = pick(seed, ['#d5d5d2', '#cfcfcb', '#d9d8d3'])
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="0.16"/>
      </filter>
    </defs>
    <rect width="1080" height="1350" fill="${tone}"/>
    <g filter="url(#softShadow)">
      <rect x="220" y="250" width="640" height="720" fill="#efefec"/>
      <rect x="220" y="250" width="640" height="720" fill="#000000" opacity="0.12"/>
      <path d="M342 394 C420 340 520 384 596 348 C684 308 748 380 770 478 C798 608 696 720 552 706 C438 694 322 628 306 512 C300 466 312 424 342 394Z" fill="#6f6f6f" opacity="0.58"/>
      <rect x="412" y="514" width="276" height="190" rx="8" fill="#f6f6f1" opacity="0.82" transform="rotate(-13 550 609)"/>
      ${Array.from({ length: 12 }, (_, index) => `<rect x="${450 + (index % 3) * 62}" y="${552 + Math.floor(index / 3) * 24}" width="44" height="4" fill="#9d9d99" opacity="0.52" transform="rotate(-13 550 609)"/>`).join('')}
    </g>
  </svg>`
}

function renderCtaBackground(seed: number) {
  const ringColor = pick(seed, ['#ffffff', '#d6d2c6', '#c2c8d6', '#d1c1b4'])
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <rect width="1080" height="1350" fill="#000000"/>
    <circle cx="540" cy="674" r="118" fill="none" stroke="${ringColor}" stroke-width="2" opacity="0.18"/>
    <circle cx="540" cy="674" r="8" fill="${ringColor}" opacity="0.2"/>
  </svg>`
}

function renderWallRails() {
  return `
    <rect x="0" y="0" width="1080" height="1350" fill="#ffffff" opacity="0.20"/>
    <rect x="0" y="110" width="1080" height="8" fill="#9b9b96" opacity="0.34"/>
    <rect x="0" y="620" width="1080" height="8" fill="#9b9b96" opacity="0.24"/>
    <circle cx="540" cy="180" r="22" fill="#b8b8b4" opacity="0.52"/>
  `
}

function hashPrompt(prompt: string) {
  return Math.abs(Array.from(prompt).reduce((sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0, 0))
}

function pick(valuesSeed: number, values: string[]) {
  return values[valuesSeed % values.length]
}
