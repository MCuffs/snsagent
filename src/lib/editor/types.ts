export type EditorialLayerType =
  | 'background'
  | 'overlay'
  | 'title'
  | 'subtitle'
  | 'sticker'
  | 'cta'
  | 'watermark'
  | 'text'

export type FontPreset = 'pretendard' | 'suit' | 'noto-sans' | 'serif' | 'magazine'
export type TypographyPreset =
  | 'cinematic-headline'
  | 'breaking-news'
  | 'magazine-editorial'
  | 'minimal-luxury'
  | 'dark-social'
  | 'emotional-storytelling'
  | 'high-ctr-hook'
export type OverlayPreset =
  | 'netflix-dark'
  | 'luxury-editorial'
  | 'noir'
  | 'dreamy'
  | 'instagram-magazine'
  | 'modern-korean-media'

export interface EditorialLayer {
  id: string
  type: EditorialLayerType
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation: number
  blur: number
  shadow: number
  borderRadius?: number   // 0–50 (%) for image layers
  edgeFade?: number       // 0–100 — radial mask fade from edge inward
  text?: string
  textHtml?: string
  imageUrl?: string | null
  videoUrl?: string | null          // 영상 배경 URL (에디터 미리보기 재생용)
  videoThumbnailUrl?: string | null // 영상 첫 프레임 이미지 (SVG export 폴백용)
  videoStartSec?: number            // 재생 시작 지점 (기본 0)
  videoDurationSec?: number         // 재생 구간 길이 3~5초 (기본 3)
  fontPreset?: FontPreset
  fontSize?: number
  fontWeight?: number
  lineHeight?: number
  tracking?: number
  color?: string
  textAlign?: 'left' | 'center' | 'right'
  italic?: boolean
  underline?: boolean
  stroke?: number
  strokeColor?: string
  textBackground?: string
  gradient?: string | null
  animation?: {
    type: 'none' | 'fade' | 'rise' | 'scale'
    duration: number
    delay: number
  }
}

export interface OverlaySettings {
  preset: OverlayPreset
  darkness: number
  vignette: number
  blur: number
  grain: number
  contrast: number
  glow: number
  bloom: number
  colorFilter: string
}

export interface EditorialDocument {
  version: 1
  viewport: { width: 1080; height: 1350; ratio: '4:5' }
  slideRole: string
  intent: string
  emotionalPurpose: string
  contentType: string
  typographyPreset: TypographyPreset
  overlay: OverlaySettings
  layers: EditorialLayer[]
  updatedAt: string
}

export interface SlideEditorSeed {
  slideNumber: number
  headline: string
  body: string
  imageUrl: string | null
  backgroundImageUrl?: string | null
  videoUrl?: string | null          // mp4 from Seedance — used as video background layer
  fontPreset?: string | null
  textColor?: string | null
  headlineFontSize?: number | null
  bodyFontSize?: number | null
  editorDocument?: string | null
}
