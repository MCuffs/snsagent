'use server'

import { dbService } from '../../lib/db-service'
import { getPipelineImageModel, getPipelineImageProvider } from '../../src/lib/ai/providers'
import { searchPexelsBackgroundCandidates } from '../../src/lib/ai/providers/pexelsImageProvider'
import { LAYOUT_DEFINITIONS } from '../../src/lib/layout/layoutTypes'
import { renderMediaCard } from '../../src/lib/layout/renderer'
import { planTypography } from '../../src/lib/layout/typographyEngine'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from '../../src/lib/layout/mediaCardHarness'
import { resolveEditableBackgroundImageUrl } from '../../src/lib/editor/document'
import { logEditEvent } from '../../src/lib/intelligence/editLogger'
import {
  getSessionUser,
  getErrorMessage,
  forbidden,
  unauthenticated,
  failed,
  hasAiRegenerationAccess,
  regenerationPurchaseRequired,
  inferLayoutType,
  LAYOUT_DEFINITIONS as SHARED_LAYOUT_DEFINITIONS,
} from './_shared'

// Update slide copy content
export async function updateSlideAction(slideId: string, headline: string, body: string, imageUrl?: string | null) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: 'headline_edit', editDelta: { beforeLength: existingSlide.headline.length, afterLength: headline.length }, metadata: { action: 'updateSlide' } })
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 수정에 실패했습니다.'))
  }
}

export async function rerenderMediaSlideAction(
  slideId: string,
  headline: string,
  body: string,
  options?: { fontFamily?: string; textColor?: string }
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()
    if (!hasAiRegenerationAccess(user.plan, user.email)) return regenerationPurchaseRequired()

    const regenerationUsage = await dbService.reserveRegenerationImages(
      existingSlide.campaign.id,
      1,
      getPipelineImageModel(),
    )
    if (!regenerationUsage.allowed) {
      return failed(`포함된 AI 배경 재생성 크레딧을 모두 사용했습니다. (${regenerationUsage.used}/${regenerationUsage.limit}장)`)
    }

    const brand = await dbService.getBrand(existingSlide.campaign.brandId)
    const source = brand?.name || 'shuffla'
    const layout = LAYOUT_DEFINITIONS[inferLayoutType(existingSlide.designPrompt)]
    const typography = planTypography({
      headline,
      body,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      layout,
    })
    const harness = applyMediaCardHarness({
      layout,
      typography,
      slideNumber: existingSlide.slideNumber,
      totalSlides: existingSlide.campaign.slideCount,
    })
    const background = await getPipelineImageProvider().generateImage(buildHarnessedVisualPrompt(existingSlide.designPrompt, harness.template), {
      size: '1024x1536',
      productImageUrls: [],
    })

    const imageUrl = await renderMediaCard({
      id: `media-card-rerender-${Date.now()}-${existingSlide.slideNumber}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      headline,
      body,
      backgroundImageUrl: background.imageUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
      fontOverride: options?.fontFamily,
      textColorOverride: options?.textColor,
    })

    const slide = await dbService.updateSlideCustomization(slideId, {
      headline,
      body,
      imageUrl,
      backgroundImageUrl: background.imageUrl,
    })
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: 'layout_change', metadata: { action: 'rerenderMediaSlide', fontFamily: options?.fontFamily } })
    return { success: true as const, slide, regenerationUsage }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 재렌더링에 실패했습니다.'))
  }
}

// Save text only — no rerender, instant
export async function saveSlideTextAction(slideId: string, headline: string, body: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const slide = await dbService.updateSlideContent(slideId, headline, body, existingSlide.imageUrl)
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: headline !== existingSlide.headline ? 'headline_edit' : 'body_edit', editDelta: { beforeLength: existingSlide.headline.length + existingSlide.body.length, afterLength: headline.length + body.length } })
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 저장에 실패했습니다.'))
  }
}

// Fast text-only rerender reuses only the original clean background, never a rendered slide.
export async function fastRerenderTextAction(
  slideId: string,
  headline: string,
  body: string,
  options?: { fontFamily?: string; textColor?: string }
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()
    const backgroundImageUrl = resolveEditableBackgroundImageUrl(existingSlide.backgroundImageUrl, existingSlide.imageUrl)
    if (!backgroundImageUrl) return failed('편집 가능한 원본 배경이 없습니다. 배경을 다시 생성하거나 업로드해 주세요.')

    const brand = await dbService.getBrand(existingSlide.campaign.brandId)
    const source = brand?.name || 'shuffla'
    const layout = LAYOUT_DEFINITIONS[inferLayoutType(existingSlide.designPrompt)]
    const typography = planTypography({
      headline,
      body,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      layout,
    })
    const harness = applyMediaCardHarness({
      layout,
      typography,
      slideNumber: existingSlide.slideNumber,
      totalSlides: existingSlide.campaign.slideCount,
    })

    const imageUrl = await renderMediaCard({
      id: `fast-rerender-${Date.now()}-${existingSlide.slideNumber}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      headline,
      body,
      backgroundImageUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
      fontOverride: options?.fontFamily,
      textColorOverride: options?.textColor,
    })

    const slide = await dbService.updateSlideCustomization(slideId, {
      headline,
      body,
      imageUrl,
      backgroundImageUrl,
    })
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: 'font_change', metadata: { action: 'fastRerenderText', fontFamily: options?.fontFamily, textColor: options?.textColor } })
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '빠른 재렌더링에 실패했습니다.'))
  }
}

// Replace background — upload URL provided, rerender SVG with new background
export async function replaceBackgroundAction(
  slideId: string,
  backgroundUrl: string,
  options?: { fontFamily?: string; textColor?: string }
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const brand = await dbService.getBrand(existingSlide.campaign.brandId)
    const source = brand?.name || 'shuffla'
    const layout = LAYOUT_DEFINITIONS[inferLayoutType(existingSlide.designPrompt)]
    const typography = planTypography({
      headline: existingSlide.headline,
      body: existingSlide.body,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      layout,
    })
    const harness = applyMediaCardHarness({
      layout,
      typography,
      slideNumber: existingSlide.slideNumber,
      totalSlides: existingSlide.campaign.slideCount,
    })

    const cleanBackgroundUrl = resolveEditableBackgroundImageUrl(backgroundUrl, existingSlide.imageUrl)
    if (!cleanBackgroundUrl) return failed('완성된 카드 이미지는 배경으로 사용할 수 없습니다.')

    const imageUrl = await renderMediaCard({
      id: `bg-replace-${Date.now()}-${existingSlide.slideNumber}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      headline: existingSlide.headline,
      body: existingSlide.body,
      backgroundImageUrl: cleanBackgroundUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
      fontOverride: options?.fontFamily,
      textColorOverride: options?.textColor,
    })

    const slide = await dbService.updateSlideCustomization(slideId, {
      headline: existingSlide.headline,
      body: existingSlide.body,
      imageUrl,
      backgroundImageUrl: cleanBackgroundUrl,
    })
    logEditEvent({ userId: user.id, brandId: existingSlide.campaign.brandId, campaignId: existingSlide.campaign.id, slideId, eventType: 'image_replace', metadata: { action: 'replaceBackground' } })
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '배경 교체에 실패했습니다.'))
  }
}

export async function searchPexelsBackgroundsAction(slideId: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const queryPrompt = [
      existingSlide.designPrompt,
      existingSlide.headline,
      existingSlide.body,
      existingSlide.campaign.productName,
      existingSlide.campaign.keyBenefits,
    ].filter(Boolean).join('\n')
    const images = await searchPexelsBackgroundCandidates(queryPrompt, undefined, 12)
    return { success: true as const, images }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, 'Pexels 이미지를 불러오지 못했습니다.'))
  }
}
