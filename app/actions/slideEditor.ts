'use server'

import { OpenAI } from 'openai'
import { dbService } from '../../lib/db-service'
import { isConfiguredOpenAIKey } from '../../lib/env'
import { getPipelineImageModel, getPipelineImageProvider } from '../../src/lib/ai/providers'
import { getTextGenerationModel, temperatureOption } from '../../src/lib/ai/llmClient'
import { layerByType, parseEditorialDocument, serializeBrandStyleMemory } from '../../src/lib/editor/document'
import { renderEditorialDocument } from '../../src/lib/editor/renderer'
import { hasWatermark } from '../../lib/limits'
import { repairRenderableCopy } from '../../src/lib/copywriting/renderableCopy'
import { logEditEvent } from '../../src/lib/intelligence/editLogger'
import {
  getSessionUser,
  getErrorMessage,
  forbidden,
  unauthenticated,
  failed,
  hasAiRegenerationAccess,
  regenerationPurchaseRequired,
  withBackgroundFallback,
  slideEditorSeed,
  documentText,
  localCopyRewrite,
} from './_shared'

// Persist local canvas edits and optionally produce a deterministic final asset.
export async function saveEditorialDocumentAction(slideId: string, rawDocument: string, renderOutput = false) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()
  if (rawDocument.length > 120_000) return failed('편집 문서가 너무 큽니다.')

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const document = parseEditorialDocument(rawDocument, slideEditorSeed(existingSlide))
    const { headline, body } = documentText(document)
    const background = layerByType(document, 'background')
    const backgroundImageUrl = background?.imageUrl || null
    const videoUrl = background?.videoUrl || null
    const shouldRenderImage = renderOutput && !videoUrl
    const renderDoc = shouldRenderImage ? withBackgroundFallback(document, existingSlide.backgroundImageUrl) : document
    const imageUrl = shouldRenderImage
      ? await renderEditorialDocument(`editorial-${Date.now()}-${existingSlide.slideNumber}`, renderDoc)
      : existingSlide.imageUrl

    const slide = await dbService.updateSlideCustomization(slideId, {
      headline,
      body,
      imageUrl,
      backgroundImageUrl,
      mediaType: videoUrl ? 'video' : 'image',
      videoUrl,
      videoThumbnailUrl: background?.videoThumbnailUrl ?? null,
      videoStartSec: background?.videoStartSec ?? null,
      videoDurationSec: background?.videoDurationSec ?? null,
      editorDocument: JSON.stringify(document),
    })
    if (renderOutput) {
      await dbService.updateBrandEditorPreferences(existingSlide.campaign.brandId, serializeBrandStyleMemory(document))
    }
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: 'headline_edit', editDelta: { beforeLength: existingSlide.headline.length, afterLength: headline.length }, metadata: { action: 'saveEditorialDocument', rendered: renderOutput } })
    return { success: true as const, slide, document, rendered: renderOutput }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '편집 문서 저장에 실패했습니다.'))
  }
}

export async function regenerateEditorialBackgroundAction(
  slideId: string,
  rawDocument: string,
  variation: 'same-style' | 'stronger-mood' | 'brighter-background',
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()
    if (!hasAiRegenerationAccess(user.plan, user.email)) return regenerationPurchaseRequired()
    const usage = await dbService.reserveRegenerationImages(existingSlide.campaign.id, 1, getPipelineImageModel())
    if (!usage.allowed) return failed(`포함된 AI 배경 재생성 크레딧을 모두 사용했습니다. (${usage.used}/${usage.limit}장)`)

    const document = parseEditorialDocument(rawDocument, slideEditorSeed(existingSlide))
    const direction = {
      'same-style': 'retain identical editorial style, palette, mood and composition; create a different photographic take',
      'stronger-mood': 'retain layout and subject placement; increase cinematic atmosphere and emotional lighting',
      'brighter-background': 'retain layout and visual language; use a brighter clean background with readable negative space',
    }[variation]
    const prompt = `${existingSlide.designPrompt}, ${direction}, never render letters or typography in the image`
    const result = await getPipelineImageProvider().generateImage(prompt, { size: '1024x1536', productImageUrls: [] })
    document.layers = document.layers.map(layer =>
      layer.type === 'background' ? { ...layer, imageUrl: result.imageUrl } : layer
    )
    const imageUrl = await renderEditorialDocument(`editorial-bg-${Date.now()}-${existingSlide.slideNumber}`, document)
    const { headline, body } = documentText(document)
    const slide = await dbService.updateSlideCustomization(slideId, {
      headline,
      body,
      imageUrl,
      backgroundImageUrl: result.imageUrl,
      editorDocument: JSON.stringify(document),
    })
    return { success: true as const, slide, document, regenerationUsage: usage }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '배경 변형 생성에 실패했습니다.'))
  }
}

export async function rewriteEditorialCopyAction(
  slideId: string,
  rawDocument: string,
  intent: 'stronger-hook' | 'emotional' | 'clickbait' | 'premium' | 'luxury' | 'trendy' | 'gen-z' | 'cleaner' | 'shorter' | string,
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()
  try {
    const slide = await dbService.getSlide(slideId)
    if (!slide) return failed('슬라이드를 찾을 수 없습니다.')
    if (slide.campaign.userId !== user.id) return forbidden()
    const document = parseEditorialDocument(rawDocument, slideEditorSeed(slide))
    const text = documentText(document)
    let rewrite = localCopyRewrite(text.headline, text.body, intent)
    const apiKey = process.env.OPENAI_API_KEY
    if (isConfiguredOpenAIKey(apiKey)) {
      const openai = new OpenAI({ apiKey })
      const model = getTextGenerationModel()
      const response = await openai.chat.completions.create({
        model,
        ...temperatureOption(model, 0.7),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '당신은 한국 프리미엄 에디토리얼 카피라이터입니다. 슬라이드 문구만 개선하고 유효한 JSON만 반환하세요.' },
          { role: 'user', content: `방향: ${intent}\n현재 제목: ${text.headline}\n현재 본문: ${text.body}\n제목 25자 이하, 본문 220자 이하로 headline/body JSON을 반환하세요. 본문은 반드시 완성된 문장으로 끝내고 중간에서 자르지 마세요.` },
        ],
      })
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}') as { headline?: string; body?: string }
      if (parsed.headline && parsed.body) {
        rewrite = repairRenderableCopy({
          headline: parsed.headline,
          body: parsed.body,
          constraints: { maxHeadlineChars: 52, maxBodyChars: 220, maxBodyLines: 6, lineLength: 32 },
        })
      }
    }
    document.layers = document.layers.map(layer => {
      if (layer.type === 'title') return { ...layer, text: rewrite.headline }
      if (layer.type === 'subtitle') return { ...layer, text: rewrite.body }
      return layer
    })
    const updated = await dbService.updateSlideCustomization(slideId, {
      headline: rewrite.headline,
      body: rewrite.body,
      editorDocument: JSON.stringify(document),
    })
    logEditEvent({ userId: user.id, brandId: slide.campaign.brandId, campaignId: slide.campaign.id, slideId, eventType: 'copy_rewrite', metadata: { intent, action: 'rewriteEditorialCopy' } })
    return { success: true as const, slide: updated, document }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '카피 제안 생성에 실패했습니다.'))
  }
}

export async function exportEditorialSlideAction(
  slideId: string,
  rawDocument: string,
  format: 'png' | 'jpg',
  scale: 1 | 2,
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()
  try {
    const [slide, userHasWatermark] = await Promise.all([
      dbService.getSlide(slideId),
      hasWatermark(user.id),
    ])
    if (!slide) return failed('슬라이드를 찾을 수 없습니다.')
    if (slide.campaign.userId !== user.id) return forbidden()
    const document = parseEditorialDocument(rawDocument, slideEditorSeed(slide), { hideWatermark: !userHasWatermark })
    const renderDoc = withBackgroundFallback(document, slide.backgroundImageUrl)
    const url = await renderEditorialDocument(`export-${Date.now()}-${slide.slideNumber}`, renderDoc, { format, scale })
    return { success: true as const, url }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '내보내기 렌더링에 실패했습니다.'))
  }
}

// Wipes the stored editorDocument for a slide so it re-initialises from fresh defaults
// on next load (darkness: 100, current clean background, etc.).
export async function resetSlideEditorDocumentAction(slideId: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()
  try {
    const slide = await dbService.getSlide(slideId)
    if (!slide) return failed('슬라이드를 찾을 수 없습니다.')
    if (slide.campaign.userId !== user.id) return forbidden()
    const updated = await dbService.updateSlideCustomization(slideId, { editorDocument: null })
    return { success: true as const, slide: updated }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 초기화에 실패했습니다.'))
  }
}
