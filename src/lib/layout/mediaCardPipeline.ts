import type { ImageProvider } from '../ai/imageProvider'
import { getPipelineImageProvider } from '../ai/providers'
import { selectLayout } from './layoutEngine'
import { LAYOUT_DEFINITIONS, type LayoutDefinition, type LayoutType } from './layoutTypes'
import type { OverlayPlan } from './overlayEngine'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from './mediaCardHarness'
import { planTypography } from './typographyEngine'
import { runMediaCardQualityCheck } from './qualityCheck'
import { analyzeReferencePattern } from './referencePatternEngine'
import { renderMediaCard } from './renderer'
import { generateVisualDirection } from './visualDirectionEngine'

export interface GenerateMediaCardInput {
  topic: string
  category: string
  title: string
  keyContent: string
  tone: string
  contentType: string
  visualHint?: string
  source?: string
  pageNumber?: number
  totalPages?: number
  imageProvider?: ImageProvider
}

export interface GenerateMediaCardResult {
  layoutType: LayoutType
  layout: LayoutDefinition
  visualDirection: ReturnType<typeof generateVisualDirection>
  backgroundImageUrl: string
  typography: ReturnType<typeof planTypography>
  overlay: OverlayPlan
  referencePattern: ReturnType<typeof analyzeReferencePattern>
  finalImageUrl: string
  qualityCheck: ReturnType<typeof runMediaCardQualityCheck>
}

export async function generateMediaCard(input: GenerateMediaCardInput): Promise<GenerateMediaCardResult> {
  const layoutType = selectLayout({
    category: input.category,
    topic: input.topic,
    tone: input.tone,
    contentType: input.contentType,
  })
  const layout = LAYOUT_DEFINITIONS[layoutType]

  const imageProvider = input.imageProvider || getPipelineImageProvider()
  const typographyPlan = planTypography({
    headline: input.title,
    body: input.keyContent,
    category: input.category,
    layout,
  })
  const harness = applyMediaCardHarness({
    layout,
    typography: typographyPlan,
    slideNumber: input.pageNumber,
    totalSlides: input.totalPages,
  })
  const visualDirection = generateVisualDirection({
    layout: harness.layout,
    category: input.category,
    topic: input.topic,
    headline: input.title,
    body: input.keyContent,
    tone: input.tone,
    visualHint: input.visualHint,
  })

  const background = await imageProvider.generateImage(buildHarnessedVisualPrompt(visualDirection.prompt, harness.template), {
    size: '1024x1536',
    productImageUrls: [],
  })

  const referencePattern = analyzeReferencePattern({
    layoutType,
    headlineLength: input.title.length,
    bodyLength: input.keyContent.length,
    hasNumericSignal: /[\d%]/.test(`${input.title} ${input.keyContent}`),
  })

  const qualityCheck = runMediaCardQualityCheck({
    layout: harness.layout,
    typography: harness.typography,
    headline: input.title,
    body: input.keyContent,
    backgroundImageUrl: background.imageUrl,
    harnessDiagnostics: harness.diagnostics,
  })

  const finalImageUrl = await renderMediaCard({
    id: `media-card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    layout: harness.layout,
    typography: harness.typography,
    overlay: harness.overlay,
    category: input.category,
    headline: input.title,
    body: input.keyContent,
    backgroundImageUrl: background.imageUrl,
    source: input.source,
    pageNumber: input.pageNumber,
    totalPages: input.totalPages,
  })

  return {
    layoutType,
    layout: harness.layout,
    visualDirection,
    backgroundImageUrl: background.imageUrl,
    typography: harness.typography,
    overlay: harness.overlay,
    referencePattern,
    finalImageUrl,
    qualityCheck,
  }
}
