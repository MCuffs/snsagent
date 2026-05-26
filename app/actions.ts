'use server'

import { cookies } from 'next/headers'
import { dbService, User } from '../lib/db-service'
import { schedulePost, tokenEncryptor } from '../lib/instagram/client'
import { checkBrandCountLimit, checkCampaignCreationLimit } from '../lib/limits'
import { getInstagramAccountId, isInstagramMockMode, getAppBaseUrl, isConfiguredOpenAIKey, getGeminiApiKey, isConfiguredGeminiKey, getGroqApiKey, isConfiguredGroqKey, getPerplexityApiKey, isConfiguredPerplexityKey, getNaverClientId, getNaverClientSecret, isConfiguredNaverApi, isProduction } from '../lib/env'
import { OpenAI } from 'openai'
import { analyzeBrandWithGemini } from '../lib/gemini'
import { analyzeBrandWithGroq } from '../lib/groq'
import { analyzeBrandWithPerplexity, analyzeNaverStoreWithPerplexity } from '../lib/perplexity'
import { fetchNaverStoreProducts, buildStoreContext, extractSmartStoreId } from '../lib/naver-shopping'
import { isSubscriptionPlan } from '../lib/limits-types'
import { generateCarouselCampaign } from '../src/lib/carousel/pipeline'
import { getPipelineImageModel, getPipelineImageProvider } from '../src/lib/ai/providers'
import { LAYOUT_DEFINITIONS, type LayoutType } from '../src/lib/layout/layoutTypes'
import { renderMediaCard } from '../src/lib/layout/renderer'
import { planTypography } from '../src/lib/layout/typographyEngine'
import { applyMediaCardHarness, buildHarnessedVisualPrompt } from '../src/lib/layout/mediaCardHarness'
import { layerByType, parseEditorialDocument } from '../src/lib/editor/document'
import { renderEditorialDocument } from '../src/lib/editor/renderer'
import type { EditorialDocument } from '../src/lib/editor/types'
import { createSessionToken, LEGACY_SESSION_COOKIE_NAME, readSessionEmail, sessionCookieOptions, SESSION_COOKIE_NAME } from '../lib/auth/session'
import { buildBrandDnaFromProfile, formatBrandDnaForPrompt } from '../lib/brand-dna'
import { collectBrandUrlContext } from '../lib/brand-url-collector'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function forbidden() {
  return { success: false as const, error: '접근 권한이 없습니다.' }
}

function unauthenticated() {
  return { success: false as const, error: '로그인이 필요합니다.' }
}

function failed(error: string) {
  return { success: false as const, error }
}

function slideEditorSeed(slide: {
  slideNumber: number
  headline: string
  body: string
  imageUrl: string | null
  backgroundImageUrl: string | null
  fontPreset: string | null
  textColor: string | null
  headlineFontSize: number | null
  bodyFontSize: number | null
  editorDocument: string | null
}) {
  return {
    slideNumber: slide.slideNumber,
    headline: slide.headline,
    body: slide.body,
    imageUrl: slide.imageUrl,
    backgroundImageUrl: slide.backgroundImageUrl,
    fontPreset: slide.fontPreset,
    textColor: slide.textColor,
    headlineFontSize: slide.headlineFontSize,
    bodyFontSize: slide.bodyFontSize,
    editorDocument: slide.editorDocument,
  }
}

function documentText(document: EditorialDocument) {
  return {
    headline: layerByType(document, 'title')?.text || '',
    body: layerByType(document, 'subtitle')?.text || '',
  }
}

async function getOwnedBrandOrFallback(userId: string, brandId?: string | null) {
  const brand = brandId ? await dbService.getBrand(brandId) : null
  if (brand?.userId === userId) return brand

  const [fallbackBrand] = await dbService.getBrands(userId)
  return fallbackBrand || null
}

function withBrandDna<T extends {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  ctaStyle: string
  brandDna?: string | null
}>(profile: T, sourceText?: string, parsed?: Record<string, unknown>) {
  return {
    ...profile,
    brandDna: profile.brandDna || buildBrandDnaFromProfile({
      name: profile.name,
      industry: profile.industry,
      targetAudience: profile.targetAudience,
      toneOfVoice: profile.toneOfVoice,
      mainColor: profile.mainColor,
      ctaStyle: profile.ctaStyle,
      sourceText,
      parsed,
    }),
  }
}

// Helper to get authenticated user from session cookies
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const email = readSessionEmail(cookieStore.get(SESSION_COOKIE_NAME)?.value)
  if (!email) return null
  
  try {
    return await dbService.getUserByEmail(email)
  } catch (e) {
    console.error('Failed to get session user:', e)
    return null
  }
}

// User Mock Login Action
export async function loginAction(email: string, name?: string) {
  if (isProduction()) {
    return failed('운영 환경에서는 Google 로그인을 사용해 주세요.')
  }

  if (!email || !email.includes('@')) {
    return failed('올바른 이메일 주소를 입력해주세요.')
  }

  const user = await dbService.getOrCreateUser(email.trim().toLowerCase(), name)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.email), sessionCookieOptions())
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)

  return { success: true as const, user }
}

// Logout Action
export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  return { success: true as const }
}

// Change Plan Action (Mock Pricing Switcher)
export async function changeUserPlanAction(plan: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!isSubscriptionPlan(plan)) {
    return failed('지원하지 않는 요금제입니다.')
  }

  if (plan !== 'FREE') {
    return failed('유료 플랜 변경은 결제 승인 후에만 가능합니다.')
  }

  await dbService.updateUserPlan(user.id, plan)
  
  // Clear layout cache
  await cookies() // dummy read to bypass Next.js server actions cache
  return { success: true as const }
}

// Brand Save/Update Action
export async function saveBrandAction(brandId: string | null, data: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  // Limit check for new brand creation
  if (!brandId) {
    const limitCheck = await checkBrandCountLimit(user.id)
    if (!limitCheck.allowed) {
      return failed(`브랜드 생성 한도를 초과했습니다. 현재 요금제(${user.plan})의 브랜드 한도는 최대 ${limitCheck.limit}개입니다.`)
    }
  }

  try {
    let effectiveBrandId = brandId
    if (effectiveBrandId) {
      const existingBrand = await dbService.getBrand(effectiveBrandId)
      if (!existingBrand || existingBrand.userId !== user.id) {
        // Stale or foreign ID: update this user's existing brand if one exists.
        const [fallbackBrand] = await dbService.getBrands(user.id)
        effectiveBrandId = fallbackBrand?.id || null
      }
    }

    // Run the creation limit check after stale ID normalization.
    if (!effectiveBrandId) {
      const limitCheck = await checkBrandCountLimit(user.id)
      if (!limitCheck.allowed) {
        return failed(`브랜드 생성 한도를 초과했습니다. 현재 요금제(${user.plan})의 브랜드 한도는 최대 ${limitCheck.limit}개입니다.`)
      }
    }

    const brand = await dbService.saveBrand(user.id, effectiveBrandId, data)
    return { success: true as const, brand }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '브랜드 저장에 실패했습니다.'))
  }
}

// AI Content & Campaign Planning Action
export async function createCampaignAction(brandId: string, data: {
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
  slideCount: number
}) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  // Limit Check
  const limitCheck = await checkCampaignCreationLimit(user.id)
  if (!limitCheck.allowed) {
    return failed(`월간 카드뉴스 생성 한도를 초과했습니다. 이번 달 누적 생성 건수: ${limitCheck.current}/${limitCheck.limit}개 (${user.plan} 플랜)`)
  }

  const brand = await dbService.getBrand(brandId)
  if (!brand) return failed('브랜드를 찾을 수 없습니다.')
  if (brand.userId !== user.id) return forbidden()

  try {
    const result = await generateCarouselCampaign({
      userId: user.id,
      brandProfile: {
        id: brand.id,
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        toneOfVoice: brand.toneOfVoice,
        mainColor: brand.mainColor,
        forbiddenWords: brand.forbiddenWords,
        ctaStyle: brand.ctaStyle,
      },
      campaignInput: {
        ...data,
        productImageUrls: [],
      },
    })

    return { 
      success: true as const, 
      campaignId: result.campaignId,
      postId: result.postId 
    }
  } catch (err: unknown) {
    console.error('Campaign creation failed:', err)
    return failed(getErrorMessage(err, '카드뉴스 기획 생성에 실패했습니다.'))
  }
}

// Update slide copy content
export async function updateSlideAction(slideId: string, headline: string, body: string, imageUrl?: string | null) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingSlide = await dbService.getSlide(slideId)
    if (!existingSlide) return failed('슬라이드를 찾을 수 없습니다.')
    if (existingSlide.campaign.userId !== user.id) return forbidden()

    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
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

    const regenerationUsage = await dbService.reserveRegenerationImages(
      existingSlide.campaign.id,
      1,
      getPipelineImageModel(),
    )
    if (!regenerationUsage.allowed) {
      return failed(`포함된 AI 배경 재생성 크레딧을 모두 사용했습니다. (${regenerationUsage.used}/${regenerationUsage.limit}장)`)
    }

    const brand = await dbService.getBrand(existingSlide.campaign.brandId)
    const account = await dbService.getInstagramAccount(user.id, existingSlide.campaign.brandId)
    const source = account?.username || brand?.name || 'instaagent'
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
      size: '1024x1024',
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

    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
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
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 저장에 실패했습니다.'))
  }
}

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
    const backgroundImageUrl = layerByType(document, 'background')?.imageUrl || existingSlide.backgroundImageUrl
    const imageUrl = renderOutput
      ? await renderEditorialDocument(`editorial-${Date.now()}-${existingSlide.slideNumber}`, document)
      : existingSlide.imageUrl

    const slide = await dbService.updateSlideCustomization(slideId, {
      headline,
      body,
      imageUrl,
      backgroundImageUrl,
      editorDocument: JSON.stringify(document),
    })
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
    const usage = await dbService.reserveRegenerationImages(existingSlide.campaign.id, 1, getPipelineImageModel())
    if (!usage.allowed) return failed(`포함된 AI 배경 재생성 크레딧을 모두 사용했습니다. (${usage.used}/${usage.limit}장)`)

    const document = parseEditorialDocument(rawDocument, slideEditorSeed(existingSlide))
    const direction = {
      'same-style': 'retain identical editorial style, palette, mood and composition; create a different photographic take',
      'stronger-mood': 'retain layout and subject placement; increase cinematic atmosphere and emotional lighting',
      'brighter-background': 'retain layout and visual language; use a brighter clean background with readable negative space',
    }[variation]
    const prompt = `${existingSlide.designPrompt}, ${direction}, never render letters or typography in the image`
    const result = await getPipelineImageProvider().generateImage(prompt, { size: '1024x1024', productImageUrls: [] })
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
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '당신은 한국 프리미엄 에디토리얼 카피라이터입니다. 슬라이드 문구만 개선하고 유효한 JSON만 반환하세요.' },
          { role: 'user', content: `방향: ${intent}\n현재 제목: ${text.headline}\n현재 본문: ${text.body}\n제목 26자 이하, 본문 60자 이하로 headline/body JSON을 반환하세요.` },
        ],
      })
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}') as { headline?: string; body?: string }
      if (parsed.headline && parsed.body) rewrite = { headline: parsed.headline.slice(0, 52), body: parsed.body.slice(0, 120) }
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
    const slide = await dbService.getSlide(slideId)
    if (!slide) return failed('슬라이드를 찾을 수 없습니다.')
    if (slide.campaign.userId !== user.id) return forbidden()
    const document = parseEditorialDocument(rawDocument, slideEditorSeed(slide))
    const url = await renderEditorialDocument(`export-${Date.now()}-${slide.slideNumber}`, document, { format, scale })
    return { success: true as const, url }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '내보내기 렌더링에 실패했습니다.'))
  }
}

function localCopyRewrite(headline: string, body: string, intent: string) {
  switch (intent) {
    case 'stronger-hook':
      return { headline: `${headline.replace(/[.!?]+$/, '')}, 놓치지 마세요`, body }
    case 'shorter':
    case 'cleaner':
      return { headline: headline.slice(0, 20), body: body.slice(0, 42) }
    case 'premium':
    case 'luxury':
      return { headline: `더 정제된 ${headline}`.slice(0, 28), body: body.slice(0, 56) }
    default:
      return { headline, body }
  }
}

// Fast text-only rerender — reuse existing imageUrl as background, skip DALL-E
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
    if (!existingSlide.imageUrl) return failed('배경 이미지가 없습니다.')

    const brand = await dbService.getBrand(existingSlide.campaign.brandId)
    const account = await dbService.getInstagramAccount(user.id, existingSlide.campaign.brandId)
    const source = account?.username || brand?.name || 'instaagent'
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
      backgroundImageUrl: existingSlide.imageUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
      fontOverride: options?.fontFamily,
      textColorOverride: options?.textColor,
    })

    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
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
    const account = await dbService.getInstagramAccount(user.id, existingSlide.campaign.brandId)
    const source = account?.username || brand?.name || 'instaagent'
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

    const imageUrl = await renderMediaCard({
      id: `bg-replace-${Date.now()}-${existingSlide.slideNumber}`,
      layout: harness.layout,
      typography: harness.typography,
      overlay: harness.overlay,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      headline: existingSlide.headline,
      body: existingSlide.body,
      backgroundImageUrl: backgroundUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
      fontOverride: options?.fontFamily,
      textColorOverride: options?.textColor,
    })

    const slide = await dbService.updateSlideContent(slideId, existingSlide.headline, existingSlide.body, imageUrl)
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '배경 교체에 실패했습니다.'))
  }
}

// Update post caption & hashtags
export async function updatePostDetailsAction(postId: string, caption: string, hashtags: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingPost = await dbService.getPost(postId)
    if (!existingPost) return failed('피드를 찾을 수 없습니다.')
    if (existingPost.userId !== user.id) return forbidden()

    const post = await dbService.updatePostDetails(postId, caption, hashtags)
    return { success: true as const, post }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '피드 정보 수정에 실패했습니다.'))
  }
}

function inferLayoutType(prompt: string): LayoutType {
  const normalized = prompt.toLowerCase()
  if (normalized.includes('data journalism')) return 'stat-highlight'
  if (normalized.includes('clean studio')) return 'dark-editorial'
  if (normalized.includes('cinematic portrait')) return 'cinematic-headline'
  if (normalized.includes('documentary news')) return 'breaking-news'
  if (normalized.includes('social feed')) return 'trend-feed'
  if (normalized.includes('magazine cover')) return 'magazine'
  if (normalized.includes('split-screen')) return 'split-comparison'
  if (normalized.includes('community')) return 'community-style'
  if (normalized.includes('shallow depth')) return 'dark-editorial'
  return 'dark-editorial'
}

// Campaign & Post approval trigger (Human-in-the-loop)
export async function approveAndScheduleCampaignAction(
  campaignId: string,
  postId: string,
  postData: { caption: string; hashtags: string; scheduledAt: string }
) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    // 1. Fetch Instagram Account integration info
    const campaign = await dbService.getCampaign(campaignId)
    if (!campaign) return failed('캠페인을 찾을 수 없습니다.')
    if (campaign.userId !== user.id) return forbidden()

    const post = await dbService.getPost(postId)
    if (!post) return failed('피드를 찾을 수 없습니다.')
    if (post.userId !== user.id || post.campaignId !== campaign.id || post.brandId !== campaign.brandId) {
      return forbidden()
    }

    const account = await dbService.getInstagramAccount(user.id, campaign.brandId)
    const isMock = isInstagramMockMode()

    if (!isMock && (!account || account.status !== 'CONNECTED')) {
      return failed('인스타그램 연동 정보가 없습니다. [Instagram 설정] 메뉴에서 먼저 계정을 연동해 주세요.')
    }

    const accountId = account?.instagramAccountId || getInstagramAccountId()
    const decryptedToken = account ? tokenEncryptor.decrypt(account.accessTokenEncrypted) : ''

    const baseUrl = getAppBaseUrl()
    // Gather all slide images
    const imageUrls = campaign.slides
      .sort((a, b) => a.slideNumber - b.slideNumber)
      .map(s => {
        if (!s.imageUrl) return null
        if (s.imageUrl.startsWith('http://') || s.imageUrl.startsWith('https://')) {
          return s.imageUrl
        }
        return `${baseUrl}${s.imageUrl}`
      })
      .filter((url): url is string => !!url)

    if (imageUrls.length === 0) {
      return failed('카드뉴스에 유효한 이미지가 없습니다.')
    }

    // 2. Parse scheduled time
    const scheduledDate = new Date(postData.scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return failed('잘못된 예약 시간 형식입니다.')
    }

    // 3. Update campaign & post details in DB
    await dbService.updatePostDetails(postId, postData.caption, postData.hashtags)
    await dbService.updateCampaignStatus(campaignId, 'pending_approval')

    // 4. Fire Instagram API Call (Mocked or Real)
    const result = await schedulePost(
      accountId,
      decryptedToken,
      imageUrls,
      `${postData.caption}\n\n${postData.hashtags}`,
      scheduledDate
    )

    if (!result.success) {
      await dbService.updatePostStatus(postId, 'failed')
      await dbService.updateCampaignStatus(campaignId, 'failed')
      return failed(`인스타그램 예약 업로드 실패: ${result.error}`)
    }

    // 5. Update status to scheduled or posted
    const targetStatus = scheduledDate.getTime() <= Date.now() + 60000 ? 'posted' : 'scheduled'
    
    await dbService.updatePostStatus(postId, targetStatus, result.mediaId)
    await dbService.updateCampaignStatus(campaignId, targetStatus)

    return { 
      success: true as const, 
      status: targetStatus,
      message: targetStatus === 'posted' ? '인스타그램에 즉시 업로드 완료!' : '예약이 승인되어 스케줄러에 등록되었습니다.'
    }
  } catch (err: unknown) {
    console.error('Approval flow error:', err)
    return failed(getErrorMessage(err, '승인 처리 도중 오류가 발생했습니다.'))
  }
}

// Regenerate campaign images using a specific style preset
export async function regenerateCampaignImagesAction(campaignId: string, styleName: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const campaign = await dbService.getCampaign(campaignId)
  if (!campaign) return failed('캠페인을 찾을 수 없습니다.')
  if (campaign.userId !== user.id) return forbidden()

  const brand = await dbService.getBrand(campaign.brandId)
  if (!brand) return failed('브랜드 정보를 찾을 수 없습니다.')
  const account = await dbService.getInstagramAccount(user.id, campaign.brandId)
  const source = account?.username || brand.name

  const styleKeywords: Record<string, string> = {
    minimalist: 'Korean media documentary photo, subdued realistic scene, dark editorial contrast, no generated text',
    gradients: 'dark cinematic editorial photography, high contrast colored lighting, no abstract gradient background, no generated text',
    cyberpunk: 'futuristic documentary city photography, dark cyber lighting, realistic scene, no generated text',
    vector: 'realistic editorial photo with strong graphic composition, not illustration, no generated text',
    photo: 'photojournalism, Korean magazine news photography, realistic full-bleed scene, no generated text',
  }

  const keyword = styleKeywords[styleName] || styleKeywords.photo

  try {
    const regenerationUsage = await dbService.reserveRegenerationImages(
      campaign.id,
      campaign.slides.length,
      getPipelineImageModel(),
    )
    if (!regenerationUsage.allowed) {
      return failed(`전체 스타일 재생성에는 ${campaign.slides.length}장의 AI 배경 크레딧이 필요합니다. 남은 크레딧이 부족합니다. (${Math.max(regenerationUsage.limit - regenerationUsage.used, 0)}장 남음)`)
    }

    const provider = getPipelineImageProvider()
    const updatedSlides = await Promise.all(
      campaign.slides.map(async (slide) => {
        const layout = LAYOUT_DEFINITIONS[inferLayoutType(slide.designPrompt)]
        const typography = planTypography({
          headline: slide.headline,
          body: slide.body,
          category: campaign.keyBenefits || '카드뉴스',
          layout,
          brandMainColor: brand.mainColor,
        })
        const harness = applyMediaCardHarness({
          layout,
          typography,
          slideNumber: slide.slideNumber,
          totalSlides: campaign.slideCount,
        })
        const finalPrompt = `${keyword}, ${slide.designPrompt}`
        const imgResult = await provider.generateImage(buildHarnessedVisualPrompt(finalPrompt, harness.template))
        
        const finalImageUrl = await renderMediaCard({
          id: `media-card-style-${Date.now()}-${slide.slideNumber}`,
          layout: harness.layout,
          typography: harness.typography,
          overlay: harness.overlay,
          category: campaign.keyBenefits || '카드뉴스',
          headline: slide.headline,
          body: slide.body,
          backgroundImageUrl: imgResult.imageUrl,
          source,
          pageNumber: slide.slideNumber,
          totalPages: campaign.slideCount,
        })

        // Save to DB
        const updated = await dbService.updateSlideContent(slide.id, slide.headline, slide.body, finalImageUrl)
        
        // Return matching format
        return {
          id: updated.id,
          campaignId: updated.campaignId,
          slideNumber: updated.slideNumber,
          headline: updated.headline,
          body: updated.body,
          designPrompt: updated.designPrompt,
          imageUrl: updated.imageUrl,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt
        }
      })
    )

    return {
      success: true as const,
      slides: updatedSlides.sort((a, b) => a.slideNumber - b.slideNumber),
      regenerationUsage,
    }
  } catch (err: unknown) {
    console.error('Failed to regenerate style images:', err)
    return failed(getErrorMessage(err, '이미지 스타일 일괄 재생성에 실패했습니다.'))
  }
}

// Manually trigger background scheduler (Simulator)
export async function triggerSchedulerAction() {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    // Fetch all posts for the user
    const posts = await dbService.getPosts(user.id)
    
    // Filter scheduled posts (we process ALL scheduled posts for instant testing gratification)
    const scheduledPosts = posts.filter(p => p.status === 'scheduled')

    if (scheduledPosts.length === 0) {
      return { 
        success: true as const, 
        processedCount: 0, 
        message: '현재 발행 대기 중(scheduled)인 포스트가 없습니다. 카드뉴스를 승인하여 예약 상태로 먼저 만들어보세요.' 
      }
    }

    let processedCount = 0
    let failuresCount = 0
    let lastError = ''

    // Process each post
    for (const post of scheduledPosts) {
      const isMock = isInstagramMockMode()
      const account = await dbService.getInstagramAccount(user.id, post.brandId)

      if (!isMock && account && account.status === 'CONNECTED') {
        // Real Instagram publishing integration
        try {
          const campaign = await dbService.getCampaign(post.campaignId)
          if (!campaign) {
            throw new Error('캠페인을 찾을 수 없습니다.')
          }

          const baseUrl = getAppBaseUrl()
          // Gather all slide images
          const imageUrls = campaign.slides
            .sort((a, b) => a.slideNumber - b.slideNumber)
            .map(s => {
              if (!s.imageUrl) return null
              if (s.imageUrl.startsWith('http://') || s.imageUrl.startsWith('https://')) {
                return s.imageUrl
              }
              return `${baseUrl}${s.imageUrl}`
            })
            .filter((url): url is string => !!url)

          if (imageUrls.length === 0) {
            throw new Error('카드뉴스에 유효한 이미지가 없습니다.')
          }

          const decryptedToken = tokenEncryptor.decrypt(account.accessTokenEncrypted)
          const accountId = account.instagramAccountId

          // Publish immediately by forcing current time or force immediate inside client
          const result = await schedulePost(
            accountId,
            decryptedToken,
            imageUrls,
            `${post.caption}\n\n${post.hashtags}`,
            new Date() // force immediate
          )

          if (!result.success) {
            throw new Error(result.error || '인스타그램 업로드 실패')
          }

          // Update DB statuses to posted
          await dbService.updatePostStatus(post.id, 'posted', result.mediaId)
          await dbService.updateCampaignStatus(post.campaignId, 'posted')
          processedCount++
        } catch (err: unknown) {
          failuresCount++
          lastError = err instanceof Error ? err.message : '알 수 없는 오류'
          await dbService.updatePostStatus(post.id, 'failed')
          await dbService.updateCampaignStatus(post.campaignId, 'failed')
        }
      } else {
        // Mock simulator logic
        const mockMediaId = `ig_media_${Math.floor(10000000 + Math.random() * 90000000)}`
        
        // Update DB post status to posted
        await dbService.updatePostStatus(post.id, 'posted', mockMediaId)
        
        // Update campaign status to posted
        await dbService.updateCampaignStatus(post.campaignId, 'posted')
        processedCount++
      }
    }

    const message = failuresCount > 0
      ? `스케줄러 시뮬레이터 작동 완료 (성공: ${processedCount}개, 실패: ${failuresCount}개). 마지막 에러: ${lastError}`
      : `성공: 대기 중이던 ${processedCount}개의 카드뉴스 포스트가 인스타그램에 발행 완료(posted) 처리되었습니다.`

    return { 
      success: true as const, 
      processedCount, 
      message 
    }
  } catch (err: unknown) {
    console.error('Scheduler manual execution failed:', err)
    return failed(getErrorMessage(err, '스케줄러 작동 중 실패했습니다.'))
  }
}

export async function updatePostScheduledTimeAction(postId: string, dateStr: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  try {
    const existingPost = await dbService.getPost(postId)
    if (!existingPost) return failed('피드를 찾을 수 없습니다.')
    if (existingPost.userId !== user.id) return forbidden()

    const newDate = new Date(dateStr)
    if (isNaN(newDate.getTime())) {
      return failed('올바르지 않은 날짜 형식입니다.')
    }

    const post = await dbService.updatePostScheduledTime(postId, newDate)
    return { success: true as const, post }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '예약 시간 수정에 실패했습니다.'))
  }
}

function removeMarkdownBold(text: string): string {
  if (!text) return ''
  return text.replace(/\*\*/g, '')
}

function readAiText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function readRecommendedKeyContent(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value

  const slideValues = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && 'slides' in value && Array.isArray(value.slides)
      ? value.slides
      : []

  const lines = slideValues
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (typeof item !== 'object' || item === null) return ''

      const slide = item as Record<string, unknown>
      const headline = readAiText(slide.headline ?? slide.title, '')
      const body = readAiText(slide.body ?? slide.content ?? slide.description, '')
      return [headline, body].filter(Boolean).join(': ')
    })
    .filter(Boolean)

  return lines.length > 0 ? lines.join('\n') : fallback
}

function getGenericWebsiteFallback(url: string) {
  let host = 'brand'
  try {
    host = new URL(url).hostname.replace(/^www\./, '').split('.')[0] || host
  } catch {
    host = url.replace(/^https?:\/\//, '').split(/[/?#.:]/)[0] || host
  }
  const displayName = host
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || '브랜드'

  const brandProfile = {
    name: displayName,
    industry: '온라인 스토어',
    targetAudience: '온라인에서 상품과 서비스를 비교하고 구매하는 잠재 고객',
    toneOfVoice: '친근하고 신뢰감 있게',
    mainColor: '#1f1512',
    forbiddenWords: '무조건, 100% 보장, 업계 최고, 한정 수량 과장',
    ctaStyle: '스토어에서 자세히 보기',
  }

  const markdownReport = `# 브랜드 분석 및 구도 기획서

입력한 웹사이트가 일시적으로 접근 제한, 과도한 요청 제한, 보안 정책 등으로 직접 수집되지 않아 Shuffla의 대체 분석 엔진으로 브랜드 초안을 생성했습니다.

## 1. 브랜드 기본 프로필
브랜드명: ${displayName}
업종: 온라인 스토어
메인 컬러: #1f1512

## 2. 브랜드 방향
대상 고객: 온라인에서 상품과 서비스를 비교하고 구매하는 잠재 고객
톤앤매너: 친근하고 신뢰감 있게

## 3. 카드뉴스 운영 제안
상품의 핵심 특징, 사용 상황, 고객이 얻는 이점을 짧은 카드뉴스 구조로 정리하는 방향을 권장합니다.
금칙어: 무조건, 100% 보장, 업계 최고, 한정 수량 과장
CTA: 스토어에서 자세히 보기
`

  return { brandProfile: withBrandDna(brandProfile, url), markdownReport }
}

function getNaverSmartstoreFallback(shopId: string, url: string) {
  const isHu100 = shopId.toLowerCase() === 'hu100'

  if (isHu100) {
    const brandProfile = {
      name: '휴100 (hu100)',
      industry: '온라인 스토어' as const,
      targetAudience: '바쁜 일상 속 건강한 식습관과 친환경 웰빙 라이프스타일을 지향하는 3050 직장인 및 가족',
      toneOfVoice: '친근하고 명확한 톤' as const,
      mainColor: '#2F855A', // 편안한 오가닉 그린
      forbiddenWords: '만병통치약, 기적의 효과, 최저가, 100% 완치',
      ctaStyle: '오늘의 건강 혜택 프로필 링크에서 확인하기'
    }

    const markdownReport = `# 🏷️ 브랜드 분석 및 구도 기획서 [휴100 - 스마트스토어]

네이버 스마트스토어(\`${url}\`)의 접속 차단을 우회하여 숍 식별자(\`${shopId}\`) 기반 건강/웰빙 웰니스 카테고리 프로필을 적용하였습니다.

## 1. 브랜드 기본 프로필
* **브랜드명**: \`휴100 (hu100)\`
* **업종**: \`온라인 스토어 (건강/친환경/웰빙 라이프스타일 숍)\`
* **메인 컬러**: 오가닉 라이프를 상징하는 딥 숲 그린 (\`#2F855A\`)

## 2. 브랜드 정체성 & 강점
* **핵심 타겟**: 몸과 마음의 휴식을 필요로 하는 바쁜 현대인, 자연주의 제품을 찾는 스마트 컨슈머.
* **브랜드 메시지**: "하루 100%의 완전한 휴식과 건강을 채우는 시간"
* **권장 톤앤매너**: 차분하고 다정하며 정보전달력이 우수한 어조.

## 3. SNS 카드뉴스 콘텐츠 전략
* **콘텐츠 포커스**:
  1. **웰빙 정보성 콘텐츠**: 면역력을 지키는 생활 습관, 친환경 제품 고르는 법 등 유용한 상식을 가독성 높은 카드뉴스로 연재.
  2. **일상 공감 & 휴식**: 힐링 감성을 담은 릴스 및 자연 친화적 피드 비주얼 구축.
* **사용 지양 용어 (금칙어)**: \`만병통치약, 기적의 효과, 최저가, 100% 완치\` (의료법상 허위/과대광고 소지가 있거나 신뢰를 저해하는 극단적 표현 배제)
* **피드 전환율 상승을 위한 CTA**: \`오늘의 건강 혜택 프로필 링크에서 확인하기\`
`
    return { brandProfile: withBrandDna(brandProfile, `${shopId} ${url}`), markdownReport }
  } else {
    const brandProfile = {
      name: `${shopId} 스토어`,
      industry: '온라인 스토어' as const,
      targetAudience: '스마트스토어를 애용하는 합리적이고 트렌디한 2040 모바일 쇼핑족',
      toneOfVoice: '친근하고 명확한 톤' as const,
      mainColor: '#03C75A', // 네이버 스마트스토어 시그니처 그린
      forbiddenWords: '최저가, 100% 보장, 광고, 실패없는',
      ctaStyle: '스토어에서 단독 혜택 만나보기'
    }

    const markdownReport = `# 🏷️ 브랜드 분석 및 구도 기획서 [스마트스토어]

네이버 스마트스토어(\`${url}\`)의 접속 차단을 우회하여 숍 식별자(\`${shopId}\`) 기반 온라인 스토어 프로필을 적용하였습니다.

## 1. BRAND IDENTITY
* **브랜드명**: \`${shopId} 스토어\`
* **업종**: \`온라인 스토어\`
* **메인 컬러**: 네이버 스토어의 시그니처 아이덴티티를 살린 그린 (\`#03C75A\`)

## 2. 브랜드 정체성 & 강점
* **핵심 타겟**: 모바일 쇼핑과 빠른 배송, 상세페이지의 직관적 정보를 신뢰하는 스마트 쇼퍼.
* **브랜드 경쟁력**: 트렌디한 셀렉션과 친절하고 신속한 네이버 톡톡 응대력.

## 3. SNS 카드뉴스 콘텐츠 전략
* **콘텐츠 포커스**:
  1. **실제 사용 후기**: 고객의 리얼 포토리뷰를 활용한 소셜 프루프(Social Proof) 카드뉴스 제작.
  2. **혜택 안내**: 알림받기 동의 쿠폰, 포인트 적립 이벤트 등 스마트스토어 연동 혜택 적극 홍보.
* **사용 지양 용어 (금칙어)**: \`최저가, 100% 보장, 광고, 실패없는\` (지나치게 상업적이거나 어뷰징 요소가 느껴지는 문구 제외)
* **피드 전환율 상승을 위한 CTA**: \`스토어에서 단독 혜택 만나보기\`
`
    return { brandProfile: withBrandDna(brandProfile, `${shopId} ${url}`), markdownReport }
  }
}

export async function analyzeBrandWebsiteAction(url: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!url || !url.startsWith('http')) {
    return failed('올바른 URL 형식(http:// 또는 https://)을 입력해 주세요.')
  }

  const targetUrl = url
  const isSmartStore = url.includes('smartstore.naver.com')
  const shopId = isSmartStore ? extractSmartStoreId(url) : null

  // ── 네이버 스마트스토어 전용 경로 ──────────────────────────────────────────
  if (isSmartStore && shopId) {
    const naverClientId = getNaverClientId()
    const naverClientSecret = getNaverClientSecret()
    const perplexityKey = getPerplexityApiKey()
    const hasNaverApi = isConfiguredNaverApi(naverClientId, naverClientSecret)
    const hasPerplexity = isConfiguredPerplexityKey(perplexityKey)

    if (hasNaverApi && hasPerplexity) {
      try {
        console.log(`[SmartStore] 네이버 API + Perplexity로 분석: ${shopId}`)
        const storeData = await fetchNaverStoreProducts(naverClientId, naverClientSecret, shopId)
        const storeContext = buildStoreContext(storeData)
        const parsed = await analyzeNaverStoreWithPerplexity(perplexityKey, shopId, storeContext) as Record<string, unknown>
        return {
          success: true as const,
          brandProfile: {
            name: String(parsed.name || storeData.storeName || shopId),
            industry: String(parsed.industry || '온라인 스토어'),
            targetAudience: String(parsed.targetAudience || ''),
            toneOfVoice: String(parsed.toneOfVoice || '친근하고 명확한 톤'),
            mainColor: String(parsed.mainColor || '#b94718'),
            forbiddenWords: String(parsed.forbiddenWords || ''),
            ctaStyle: String(parsed.ctaStyle || '스토어에서 확인하기'),
            brandDna: buildBrandDnaFromProfile({
              name: String(parsed.name || shopId),
              industry: String(parsed.industry || '온라인 스토어'),
              targetAudience: String(parsed.targetAudience || ''),
              toneOfVoice: String(parsed.toneOfVoice || '친근하고 명확한 톤'),
              mainColor: String(parsed.mainColor || '#b94718'),
              ctaStyle: String(parsed.ctaStyle || ''),
              parsed,
            }),
          },
          markdownReport: removeMarkdownBold(String(parsed.markdownReport || `# ${parsed.name} 브랜드 분석\n\n네이버 스마트스토어 API 기반 분석 완료.`)),
        }
      } catch (e) {
        console.error('[SmartStore] 네이버 API 분석 실패, 일반 경로로 폴백:', e)
        // 실패 시 아래 일반 경로로 계속 진행
      }
    } else {
      const missing = []
      if (!hasNaverApi) missing.push('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET')
      if (!hasPerplexity) missing.push('PERPLEXITY_API_KEY')
      console.warn(`[SmartStore] API 키 미설정 (${missing.join(', ')}), 일반 경로로 폴백`)
    }
  }

  try {
    console.log(`Collecting brand URL context: ${targetUrl}`)
    const collected = await collectBrandUrlContext(targetUrl, { isNaverStore: isSmartStore })
    const cleanedText = collected.promptContext
    console.log(`Brand URL collection complete: ${collected.finalUrl} | ${collected.diagnostics.join(', ')}`)

    const perplexityKey = getPerplexityApiKey()
    const groqKey = getGroqApiKey()
    const geminiKey = getGeminiApiKey()
    const openaiKey = process.env.OPENAI_API_KEY
    const usePerplexity = isConfiguredPerplexityKey(perplexityKey)
    const useGroq = !usePerplexity && isConfiguredGroqKey(groqKey)
    const useGemini = !usePerplexity && !useGroq && isConfiguredGeminiKey(geminiKey)
    const useOpenAI = !usePerplexity && !useGroq && !useGemini && isConfiguredOpenAIKey(openaiKey)

    if (usePerplexity || useGroq || useGemini || useOpenAI) {
      let parsed: Record<string, unknown>

      if (usePerplexity) {
        // Perplexity는 URL을 직접 방문하므로 원본 URL을 넘김
        console.log('Using Perplexity sonar-pro for brand analysis')
        parsed = await analyzeBrandWithPerplexity(perplexityKey, targetUrl)
      } else if (useGroq) {
        console.log('Using Groq (Llama 3.3 70B) for brand analysis')
        parsed = await analyzeBrandWithGroq(groqKey, cleanedText)
      } else if (useGemini) {
        console.log('Using Gemini 1.5 Flash for brand analysis')
        parsed = await analyzeBrandWithGemini(geminiKey, cleanedText)
      } else {
        // GPT-4o 2단계 harness (신호 추출 → 전체 합성)
        console.log('Using GPT-4o 2-stage harness for brand analysis')
        const openai = new OpenAI({ apiKey: openaiKey })

        // STAGE 1: 핵심 신호 추출 (gpt-4o-mini, 빠르고 저렴)
        const signalPrompt = `당신은 한국 디지털 마케팅 전문가입니다. 아래 웹사이트 스크랩 데이터에서 브랜드 분석에 필요한 핵심 신호를 추출하세요.

[스크랩 데이터]
${cleanedText.slice(0, 6000)}

다음 JSON 형식으로만 응답하세요:
{
  "brandName": "정확한 브랜드명 (공식 명칭 우선)",
  "platformType": "smartstore|coupang|brandsite|cafe|instagram|other",
  "topProducts": ["최대 5개 핵심 상품/서비스"],
  "priceRange": "저가/중가/고가/프리미엄",
  "primaryColor": "#HEXCODE (메타데이터, 로고, 헤더에서 추출한 주요 컬러)",
  "targetSignals": "타겟 고객 신호 (나이대, 성별, 라이프스타일)",
  "uniqueSellingPoints": ["차별화 포인트 최대 3개"],
  "categoryKeywords": ["업종 관련 키워드 최대 5개"]
}`
        const signalResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: signalPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 600,
        })
        const signals = JSON.parse(signalResponse.choices[0].message.content || '{}')

        // STAGE 2: 전체 브랜드 프로필 합성 (gpt-4o)
        const synthPrompt = `당신은 한국 SNS 카드뉴스 전문 브랜드 전략가입니다.
아래 1차 신호 분석 결과와 원본 데이터를 기반으로 완전한 브랜드 프로필과 콘텐츠 DNA를 생성하세요.

[1차 신호 분석 결과]
${JSON.stringify(signals, null, 2)}

[원본 웹사이트 데이터 (보충 참고용)]
${cleanedText.slice(0, 5000)}

[생성 규칙]
- name: 공식 브랜드명. 플랫폼명(스마트스토어, 쿠팡 등)은 포함하지 않음
- industry: 반드시 아래 6개 중 하나 선택
  · 온라인 스토어 · 카페 / F&B · 피트니스 · 뷰티 / 케어 · 교육 / 강의 · IT / SaaS
- targetAudience: "20~30대 직장인 여성" 처럼 나이+성별+라이프스타일 조합 (50자 이내)
- toneOfVoice: 반드시 아래 4개 중 하나
  · "친근하고 명확한 톤" · "전문적이고 신뢰감 있는 톤" · "젊고 경쾌한 톤" · "고급스럽고 차분한 톤"
- mainColor: 브랜드 아이덴티티에 맞는 HEX 코드. 너무 밝거나(#ffffff 계열) 너무 어두운(#000000 계열) 극단값 금지
- forbiddenWords: 이 업종에서 남용/스팸으로 여겨지는 표현 2~4개, 쉼표 구분
- ctaStyle: 콘텐츠에서 실제 사용할 짧은 CTA 문구
- brandDescription: 브랜드를 처음 보는 사람에게 설명하는 한국어 2~3문장 소개
- coreProducts: 실제 판매/제공하는 구체적 상품명/서비스명 (최대 5개)
- valueProposition: 브랜드가 고객에게 제공하는 핵심 약속 (1문장)
- customerPainPoints: 이 브랜드가 해결하는 고객 고민 (최대 4개)
- differentiators: 경쟁사 대비 구체적 차별점 (최대 4개)
- visualMood: 카드뉴스 이미지 방향
- contentPillars: SNS 카드뉴스 콘텐츠 주제 축 (최대 5개)
- brandKeywords: AI 카드뉴스 생성 시 반드시 반영할 키워드 (최대 8개)
- avoidVisuals: 이 브랜드에 어울리지 않는 비주얼 스타일 (최대 4개)

JSON 형식으로만 응답하세요:`
        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: '당신은 한국 브랜드 전략 AI입니다. 반드시 유효한 JSON만 반환하세요. 마크다운 볼드(**) 사용 금지.' },
            { role: 'user', content: synthPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        })
        const rawJson = aiResponse.choices[0].message.content
        if (!rawJson) throw new Error('AI 분석 실패: 응답이 비어있습니다.')
        parsed = JSON.parse(rawJson)
        // GPT-4o는 markdownReport를 별도 생성해 붙임
        parsed.markdownReport = `# 브랜드 분석 완료\n\n브랜드명: ${parsed.name || signals.brandName}\n업종: ${parsed.industry}\n타겟: ${parsed.targetAudience}\n\n가치 제안: ${parsed.valueProposition || '-'}\n\n차별점: ${Array.isArray(parsed.differentiators) ? parsed.differentiators.join(', ') : '-'}`
      }

      if (parsed) {
        return {
          success: true as const,
          brandProfile: {
            name: String(parsed.name || '알 수 없음'),
            industry: String(parsed.industry || '온라인 스토어'),
            targetAudience: String(parsed.targetAudience || '대중 고객'),
            toneOfVoice: String(parsed.toneOfVoice || '친근하고 명확한 톤'),
            mainColor: String(parsed.mainColor || '#b94718'),
            forbiddenWords: String(parsed.forbiddenWords || ''),
            ctaStyle: String(parsed.ctaStyle || '프로필 링크에서 확인하기'),
            brandDna: buildBrandDnaFromProfile({
              name: String(parsed.name || 'Unknown brand'),
              industry: String(parsed.industry || 'Online store'),
              targetAudience: String(parsed.targetAudience || 'Target customers'),
              toneOfVoice: String(parsed.toneOfVoice || 'Friendly and clear'),
              mainColor: String(parsed.mainColor || '#b94718'),
              ctaStyle: String(parsed.ctaStyle || ''),
              sourceText: collected.sourceText,
              parsed,
            })
          },
          markdownReport: removeMarkdownBold(String(parsed.markdownReport || '# 분석 실패\n\nAI 분석 결과를 불러오지 못했습니다.'))
        }
      }

    } else {
      console.log('Using Mock Brand Website Analyzer (no AI key configured — set GEMINI_API_KEY in .env)')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulation delay

      if (isSmartStore && shopId) {
        const result = getNaverSmartstoreFallback(shopId, targetUrl)
        return {
          success: true as const,
          brandProfile: withBrandDna(result.brandProfile, `${shopId} ${targetUrl}`),
          markdownReport: result.markdownReport
        }
      }

      const lowerUrl = url.toLowerCase()
      let mockProfile: {
        name: string
        industry: '온라인 스토어' | '카페 / F&B' | '피트니스' | '뷰티 / 케어' | '교육 / 강의' | 'IT / SaaS'
        targetAudience: string
        toneOfVoice: string
        mainColor: string
        forbiddenWords: string
        ctaStyle: string
      } = {
        name: '모카 숍 (Mock)',
        industry: '온라인 스토어',
        targetAudience: '2030 트렌디한 쇼핑족',
        toneOfVoice: '젊고 경쾌한 톤',
        mainColor: '#E28743',
        forbiddenWords: '최저가, 100% 보장, 광고',
        ctaStyle: '스토어에서 자세히 보기'
      }
      let typeLabel = '온라인 셀렉트숍'
      let strengths = '트렌디한 아이템 큐레이션 및 빠른 고객 응대'
      let colorDesc = '따뜻하고 활력 있는 오렌지 브라운 계열 (#E28743)'

      if (lowerUrl.includes('cafe') || lowerUrl.includes('coffee') || lowerUrl.includes('roast')) {
        mockProfile = {
          name: '카페 모카 (Mock)',
          industry: '카페 / F&B',
          targetAudience: '아늑한 휴식을 찾는 카공족 및 커피 애호가',
          toneOfVoice: '고급스럽고 차분한 톤',
          mainColor: '#6F4E37',
          forbiddenWords: '존맛, 최고존엄, 절대 실패없는',
          ctaStyle: '프로필 링크에서 예약하기'
        }
        typeLabel = '스페셜티 커피 전문 F&B'
        strengths = '매일 볶는 신선한 원두와 아늑한 인테리어 분위기'
        colorDesc = '커피 향을 담은 깊고 부드러운 브라운 계열 (#6F4E37)'
      } else if (lowerUrl.includes('fit') || lowerUrl.includes('gym') || lowerUrl.includes('health') || lowerUrl.includes('pilates')) {
        mockProfile = {
          name: '에너지 피트니스 (Mock)',
          industry: '피트니스',
          targetAudience: '체력 증진과 바디프로필을 목표로 하는 직장인',
          toneOfVoice: '친근하고 명확한 톤',
          mainColor: '#1A365D',
          forbiddenWords: '단기간 폭풍감량, 부작용 제로, 기적',
          ctaStyle: '무료 상담 신청하기'
        }
        typeLabel = '체계적 PT 전문 헬스센터'
        strengths = '개인 맞춤 피드백과 과학적 운동 데이터 제공'
        colorDesc = '신뢰감과 에너지를 부여하는 네이비 블루 계열 (#1A365D)'
      } else if (lowerUrl.includes('beauty') || lowerUrl.includes('skin') || lowerUrl.includes('salon') || lowerUrl.includes('care')) {
        mockProfile = {
          name: '라벨 뷰티 (Mock)',
          industry: '뷰티 / 케어',
          targetAudience: '자연스러운 스킨케어와 이너뷰티를 지향하는 고객',
          toneOfVoice: '고급스럽고 차분한 톤',
          mainColor: '#D9A5B3',
          forbiddenWords: '기적의 피부, 즉각 효과, 무조건 성공',
          ctaStyle: 'DM으로 문의하기'
        }
        typeLabel = '토탈 에스테틱 뷰티 살롱'
        strengths = '피부 저자극 프리미엄 천연 아로마 케어 및 1:1 예약제 관리'
        colorDesc = '우아하고 세련된 더스티 핑크 계열 (#D9A5B3)'
      } else if (lowerUrl.includes('tech') || lowerUrl.includes('saas') || lowerUrl.includes('software') || lowerUrl.includes('app')) {
        mockProfile = {
          name: '센스 에이전트 (Mock)',
          industry: 'IT / SaaS',
          targetAudience: '업무 자동화와 스마트 워크를 지향하는 1인 기업 및 소상공인',
          toneOfVoice: '전문적이고 신뢰감 있는 톤',
          mainColor: '#4A5568',
          forbiddenWords: '세계 1등, 절대 깨지지 않는, 무한 기능',
          ctaStyle: '프로필 링크에서 자세히 알아보기'
        }
        typeLabel = 'AI 기반 업무 자동화 SaaS 솔루션'
        strengths = '반복 업무 90% 이상 절감 및 사용자 친화적 대시보드'
        colorDesc = '스마트하고 정돈된 슬레이트 그레이 계열 (#4A5568)'
      }

      const markdownReport = `# 🏷️ 브랜드 분석 및 구도 기획서 (시뮬레이터)

본 보고서는 사용자가 입력한 사이트 URL(\`${url}\`)을 AI 기반으로 분석하여 추출한 브랜드 정체성 및 SNS 콘텐츠 가이드라인입니다. *(현재 로컬 시뮬레이션 모드로 분석되었습니다)*

## 1. 브랜드 기본 프로필
* 브랜드명: \`${mockProfile.name}\`
* 업종: \`${mockProfile.industry}\` (${typeLabel})
* 메인 컬러: ${colorDesc}

## 2. 브랜드 정체성 & 강점
* 핵심 타겟: ${mockProfile.targetAudience}
* 브랜드 경쟁력: ${strengths}
* 권장 톤앤매너: ${mockProfile.toneOfVoice} (일관된 콘텐츠 브랜딩에 도움을 줍니다)

## 3. SNS 카드뉴스 콘텐츠 전략
* 콘텐츠 포커스:
  1. 정보성 콘텐츠 위주로 전문성과 신뢰도를 확보합니다.
  2. 고객 피드백과 비포/애프터(혹은 후기)를 가공해 캐러셀 카드뉴스로 구성합니다.
* 사용 지양 용어 (금칙어): \`${mockProfile.forbiddenWords}\` (콘텐츠 신뢰 유지를 위해 사용을 삼가세요)
* 피드 전환율 상승을 위한 CTA: \`${mockProfile.ctaStyle}\`
`

      return {
        success: true as const,
        brandProfile: withBrandDna(mockProfile, `${url} ${markdownReport}`),
        markdownReport: removeMarkdownBold(markdownReport)
      }
    }
  } catch (err: unknown) {
    console.error('Brand Website Analysis failed, trying fallback:', err)

    if (isSmartStore && shopId) {
      console.log(`Executing Graceful Fallback for Smartstore: ${shopId}`)

      const apiKey = process.env.OPENAI_API_KEY
      const useRealAI = isConfiguredOpenAIKey(apiKey)

      if (useRealAI) {
        try {
          const openai = new OpenAI({ apiKey })
          const isHu100 = shopId.toLowerCase() === 'hu100'
          const hint = isHu100 ? '이 상점은 한글 브랜드명이 "휴100" 혹은 "휴백"일 가능성이 높으며, 카테고리는 건강 식품, 친환경 웰빙 라이프스타일, 오가닉 푸드/굿즈 관련 웰니스 샵입니다.' : ''

          const prompt = `
You are an expert brand consultant and digital marketer.
We tried to scrape the user's Naver SmartStore but were blocked (HTTP 429/403 or timeout).
However, we know the SmartStore shop ID is "${shopId}" and the URL is "${url}".
${hint}

Based on this information, infer/predict a highly relevant brand profile and write a professional brand identity and social card-news content strategy report in Markdown.

[Requirements]
1. Since we couldn't scrape, predict the brand profile values based on the shop ID "${shopId}". For "hu100", match it to a Wellness/Healthy food/Eco-friendly curated lifestyle store. For other IDs, generate a plausible modern online store profile.
2. The tone of voice must match one of: "친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤".
3. The industry must fit '온라인 스토어'.
4. Write a beautiful brand identity and social card-news content strategy report in Markdown (under "markdownReport") in Korean.
5. Emphasize in the report that this profile was generated via our smart shop-ID analysis fallback engine due to temporary carrier block, but is tailored for their store.
6. CRITICAL: Do NOT use markdown bold syntax like '**' or '***' anywhere in the "markdownReport". Write section items in plain text, e.g. use "브랜드명: 값" instead of "**브랜드명**: 값".

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "name": "Brand Name (Korean/English)",
  "industry": "온라인 스토어",
  "targetAudience": "Target customers description",
  "toneOfVoice": "One of the 4 tones",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "word1, word2, word3",
  "ctaStyle": "CTA style recommendation",
  "markdownReport": "# 🏷️ 브랜드 분석 및 구도 기획서 (스마트스토어 분석 복원)\\n\\n1. 브랜드 정체성\\n브랜드명: 휴100\\n업종: 온라인 스토어\\n\\n2. SNS 콘텐츠 전략\\n..."
}
`
          const aiResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a brand analysis AI agent. Return JSON only. Never use markdown bold syntax (**).'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' }
          })

          const rawJson = aiResponse.choices[0].message.content
          if (rawJson) {
            const parsed = JSON.parse(rawJson)
            return {
              success: true as const,
              brandProfile: {
                name: parsed.name || `${shopId} 스토어`,
                industry: '온라인 스토어' as const,
                targetAudience: parsed.targetAudience || '대중 고객',
                toneOfVoice: parsed.toneOfVoice || '친근하고 명확한 톤',
                mainColor: parsed.mainColor || '#03C75A',
                forbiddenWords: parsed.forbiddenWords || '',
                ctaStyle: parsed.ctaStyle || '프로필 링크에서 확인하기',
                brandDna: buildBrandDnaFromProfile({
                  name: parsed.name || `${shopId} store`,
                  industry: '온라인 스토어',
                  targetAudience: parsed.targetAudience || 'Target customers',
                  toneOfVoice: parsed.toneOfVoice || 'Friendly and clear',
                  mainColor: parsed.mainColor || '#03C75A',
                  ctaStyle: parsed.ctaStyle || '',
                  sourceText: `${shopId} ${url}`,
                  parsed,
                })
              },
              markdownReport: removeMarkdownBold(parsed.markdownReport || '# 분석 복원 완료\n\n브랜드 분석 결과를 성공적으로 생성했습니다.')
            }
          }
        } catch (aiErr) {
          console.error('Fallback AI generation failed, using local fallback:', aiErr)
        }
      }

      const localResult = getNaverSmartstoreFallback(shopId, url)
      return {
        success: true as const,
        brandProfile: withBrandDna(localResult.brandProfile, `${shopId} ${url}`),
        markdownReport: removeMarkdownBold(localResult.markdownReport)
      }
    }

    const fallback = getGenericWebsiteFallback(url)
    return {
      success: true as const,
      brandProfile: withBrandDna(fallback.brandProfile, url),
      markdownReport: removeMarkdownBold(fallback.markdownReport)
    }
  }
}

export async function recommendCampaignAction(brandId: string, topic: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!brandId) {
    return failed('브랜드를 선택해 주세요.')
  }
  if (!topic || topic.trim().length === 0) {
    return failed('카드뉴스 주제를 입력해 주세요.')
  }

  try {
    const brand = await getOwnedBrandOrFallback(user.id, brandId)
    if (!brand) return failed('브랜드를 찾을 수 없습니다.')

    const apiKey = process.env.OPENAI_API_KEY
    const useRealAI = isConfiguredOpenAIKey(apiKey)

    if (useRealAI) {
      const openai = new OpenAI({ apiKey })
      const prompt = `
You are an expert AI Marketing Planner.
Based on the following brand profile and a raw topic/idea for a social card-news campaign, generate optimized configuration values and slide content for the campaign.

[Brand Profile]
- Brand Name: ${brand.name}
- Industry: ${brand.industry}
- Target Audience: ${brand.targetAudience}
- Tone of Voice: ${brand.toneOfVoice}
- Main Color: ${brand.mainColor}
- Forbidden Words: ${brand.forbiddenWords || 'None'}
- CTA Style: ${brand.ctaStyle || 'None'}

[Brand DNA Harness]
${formatBrandDnaForPrompt(brand.brandDna)}

[Campaign Topic/Idea]
${topic}

[Requirements]
1. Select the most matching option for each field:
   - "contentType": One of ['신상품 홍보', '베스트셀러 추천', '고객 리얼 리뷰', '브랜드 스토리', '세일/이벤트 안내', '꿀팁/큐레이션']
   - "category": One of ['패션/의류', '뷰티/화장품', '리빙/인테리어', '푸드/식품', '디지털/가전', '라이프스타일', '반려동물', '기타']
   - "tone": One of ['감성적이고 따뜻하게', '시크하고 고급스럽게', '톡톡 튀고 트렌디하게', '정보가 쏙쏙 들어오게', '신뢰감 있고 전문적이게']
   - "slideCount": Recommended total number of slides (Must be exactly one of [5, 7, 10])
2. Generate:
   - "title": A concise Korean archive-card headline (under 18 Korean chars, no emoji, no markdown bold, do not prepend brand name unless the topic explicitly asks for it).
   - "keyContent": Detailed copy for each slide. Write one line per slide. The number of lines must match "slideCount". Each line should contain a short headline and sub-content separated by ":". Use the brand's industry, target audience, tone of voice, forbidden words, CTA style, and Brand DNA. At least 70% of slides must mention or imply the Brand DNA's product/service, differentiator, customer pain, or value proposition. Do not include markdown bold syntax (**).
   - "visualHint": A premium archive-card background prompt. It must match the Brand DNA's core products, visual mood, differentiators, and avoidVisuals. It should not ask for text in the image. Prefer product/editorial photography, muted archive layout, and enough lower-left blank negative space for app-rendered copy.
   - "source": Recommended brand label/watermark (e.g. brand website, brand handle, or simply "${brand.name}")
3. CRITICAL: Do NOT use markdown bold syntax (** or ***) anywhere in the text. Keep all text plain and clean.
4. Avoid forbidden words exactly: ${brand.forbiddenWords || 'None'}.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "contentType": "...",
  "category": "...",
  "tone": "...",
  "title": "...",
  "keyContent": "...",
  "visualHint": "...",
  "source": "...",
  "slideCount": 7
}
`

      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional marketing planner AI agent. Return JSON only. Never use markdown bold (**).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      })

      const rawJson = aiResponse.choices[0].message.content
      if (rawJson) {
        const parsed = JSON.parse(rawJson) as Record<string, unknown>
        const fallbackTitle = `[${brand.name}] ${topic}`
        const fallbackContent = `- 핵심가치 소개: ${topic} 관련 브랜드 스토리\n- 주요 특징 안내: 스토어만의 강점`
        const recommendedSlideCount = Number(parsed.slideCount)
        return {
          success: true as const,
          recommendation: {
            contentType: readAiText(parsed.contentType, '신상품 홍보'),
            category: readAiText(parsed.category, '기타'),
            tone: readAiText(parsed.tone, '감성적이고 따뜻하게'),
            title: removeMarkdownBold(readAiText(parsed.title, fallbackTitle)),
            keyContent: removeMarkdownBold(readRecommendedKeyContent(parsed.keyContent, fallbackContent)),
            visualHint: readAiText(parsed.visualHint, `minimalist design matching brand color ${brand.mainColor}`),
            source: readAiText(parsed.source, brand.name),
            slideCount: [5, 7, 10].includes(recommendedSlideCount) ? recommendedSlideCount : 7
          }
        }
      } else {
        throw new Error('추천 생성에 실패했습니다.')
      }

    } else {
      // Mock simulation logic
      console.log('Using Mock Campaign Recommendation Engine (OpenAI key not configured)')
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulation delay

      const lowerTopic = topic.toLowerCase()
      const lowerIndustry = brand.industry.toLowerCase()

      const brandTone = brand.toneOfVoice || '차분하고 명확한 톤'
      const audience = brand.targetAudience || '브랜드 고객'
      const cta = brand.ctaStyle || '프로필 링크에서 자세히 보기'
      const forbidden = brand.forbiddenWords
        .split(',')
        .map(word => word.trim())
        .filter(Boolean)

      // Default values
      let contentType = '신상품 홍보'
      let category = '라이프스타일'
      let tone = mapBrandToneToCampaignTone(brandTone)
      let title = archiveTitleFromTopic(topic)
      let keyContent = buildBrandKeyContent({
        topic,
        brandName: brand.name,
        industry: brand.industry,
        audience,
        tone: brandTone,
        cta,
      })
      let visualHint = buildBrandVisualHint(brand.industry, brand.mainColor, brandTone)
      const slideCount = 5

      // Matching based on topic and industry
      if (lowerTopic.includes('세일') || lowerTopic.includes('할인') || lowerTopic.includes('이벤트') || lowerTopic.includes('쿠폰')) {
        contentType = '세일/이벤트 안내'
        title = '놓치기 전 확인'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'limited-offer' })
      } else if (lowerTopic.includes('리뷰') || lowerTopic.includes('후기') || lowerTopic.includes('추천') || lowerTopic.includes('베스트')) {
        contentType = '고객 리얼 리뷰'
        title = '써본 뒤 남은 것'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'review' })
      } else if (lowerTopic.includes('꿀팁') || lowerTopic.includes('정보') || lowerTopic.includes('방법') || lowerTopic.includes('큐레이션')) {
        contentType = '꿀팁/큐레이션'
        title = '필요한 것만'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'curation' })
      }

      // Category matching by Industry
      if (lowerIndustry.includes('온라인') || lowerIndustry.includes('스토어') || lowerIndustry.includes('셀렉')) {
        category = lowerTopic.includes('원피스') || lowerTopic.includes('의류') || lowerTopic.includes('패션') ? '패션/의류' : '라이프스타일'
      } else if (lowerIndustry.includes('뷰티') || lowerIndustry.includes('화장') || lowerIndustry.includes('헤어') || lowerIndustry.includes('에스테틱')) {
        category = '뷰티/화장품'
        tone = '시크하고 고급스럽게'
        if (contentType === '신상품 홍보') {
          title = '피부가 쉬는 방식'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'beauty' })
        }
      } else if (lowerIndustry.includes('카페') || lowerIndustry.includes('푸드') || lowerIndustry.includes('식품') || lowerIndustry.includes('커피')) {
        category = '푸드/식품'
        tone = '톡톡 튀고 트렌디하게'
        if (contentType === '신상품 홍보') {
          title = '오늘의 맛 기록'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'food' })
        }
      } else if (lowerIndustry.includes('피트니스') || lowerIndustry.includes('헬스') || lowerIndustry.includes('운동')) {
        category = '라이프스타일'
        tone = '정보가 쏙쏙 들어오게'
        if (contentType === '신상품 홍보') {
          title = '몸이 기억하는 루틴'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'wellness' })
        }
      } else if (lowerIndustry.includes('it') || lowerIndustry.includes('saas') || lowerIndustry.includes('소프트웨어')) {
        category = '디지털/가전'
        tone = '신뢰감 있고 전문적이게'
      }

      // Add visual hint based on category & color
      if (category === '패션/의류') {
        visualHint = buildBrandVisualHint('패션/의류', brand.mainColor, brandTone)
      } else if (category === '뷰티/화장품') {
        visualHint = buildBrandVisualHint('뷰티/화장품', brand.mainColor, brandTone)
      } else if (category === '푸드/식품') {
        visualHint = buildBrandVisualHint('푸드/식품', brand.mainColor, brandTone)
      } else {
        visualHint = buildBrandVisualHint(brand.industry, brand.mainColor, brandTone)
      }

      // Custom adjustments based on user input
      if (lowerTopic.includes('원피스') || lowerTopic.includes('리넨')) {
        category = '패션/의류'
        tone = '감성적이고 따뜻하게'
        title = `여름에 남는 옷`
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'fashion' })
      } else if (lowerTopic.includes('건강식품') || lowerTopic.includes('웰빙') || lowerTopic.includes('영양제')) {
        category = '푸드/식품'
        tone = '신뢰감 있고 전문적이게'
        title = `매일 챙기는 기준`
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'wellness' })
      }

      keyContent = removeForbiddenTerms(keyContent, forbidden)

      return {
        success: true as const,
        recommendation: {
          contentType,
          category,
          tone,
          title,
          keyContent,
          visualHint,
          source: brand.name,
          slideCount
        }
      }
    }

  } catch (err: unknown) {
    console.error('Campaign recommendation failed:', err)
    return failed(err instanceof Error ? err.message : '추천 데이터를 기획하는 도중 오류가 발생했습니다.')
  }
}

function mapBrandToneToCampaignTone(toneOfVoice: string) {
  const text = toneOfVoice.toLowerCase()
  if (/고급|차분|프리미엄|시크|minimal|premium/.test(text)) return '시크하고 고급스럽게'
  if (/전문|신뢰|명확|정보|분석/.test(text)) return '신뢰감 있고 전문적이게'
  if (/젊|경쾌|트렌디|톡톡|재치/.test(text)) return '톡톡 튀고 트렌디하게'
  if (/친근|따뜻|감성|부드/.test(text)) return '감성적이고 따뜻하게'
  return '정보가 쏙쏙 들어오게'
}

function archiveTitleFromTopic(topic: string) {
  const clean = topic
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[!?.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/가방|백|bag/i.test(clean)) return '정돈된 가방'
  if (/책|독서|문장|글/i.test(clean)) return '가방 속 물건'
  if (/옷|원피스|리넨|패션/i.test(clean)) return '오래 입는 기준'
  if (/피부|뷰티|케어|화장/i.test(clean)) return '피부가 쉬는 방식'
  if (/식품|건강|영양|웰빙/i.test(clean)) return '매일 챙기는 기준'
  return clean.length > 14 ? clean.slice(0, 14) : clean || '저장해두세요'
}

function buildBrandKeyContent(input: {
  topic: string
  brandName: string
  industry: string
  audience: string
  tone: string
  cta: string
  angle?: string
}) {
  const subject = archiveTitleFromTopic(input.topic)
  const context = `${input.industry} 고객인 ${input.audience}`
  const angleLine = input.angle === 'limited-offer'
    ? '오늘만 확인할 것: 필요한 혜택과 조건을 차분히 정리합니다'
    : input.angle === 'review'
      ? '써본 뒤 남은 것: 실제 선택 이유와 만족 포인트를 정리합니다'
      : input.angle === 'curation'
        ? '필요한 것만: 복잡한 정보에서 바로 쓸 내용만 남깁니다'
        : `${subject}: ${context}에게 필요한 기준을 먼저 보여줍니다`

  return [
    `${subject}: ${input.tone}으로 브랜드가 제안하는 핵심 기준`,
    angleLine,
    `선택 기준: ${input.industry} 맥락에서 놓치기 쉬운 디테일`,
    `사용 장면: ${input.audience}가 실제로 떠올릴 수 있는 상황`,
    `저장 포인트: ${input.cta}`,
  ].join('\n')
}

function buildBrandVisualHint(industry: string, mainColor: string, toneOfVoice: string) {
  const context = `${industry} ${toneOfVoice}`.toLowerCase()
  const base = 'Korean premium archive social card photography, no generated text, no logo, no watermark, object centered in upper-middle, quiet lower-left typography space'

  if (/패션|의류|리빙|스토어|셀렉|온라인|bag|가방/.test(context)) {
    return `${base}, product archive still life, soft off-white studio background, fabric texture, black object details, subtle brand color ${mainColor}`
  }
  if (/뷰티|화장|케어|스킨/.test(context)) {
    return `${base}, cosmetic product archive still life, translucent packaging, soft bathroom or vanity light, muted gray-white palette, subtle brand color ${mainColor}`
  }
  if (/푸드|식품|카페|커피/.test(context)) {
    return `${base}, editorial food or cafe object still life, neutral table surface, natural window light, muted warm gray palette, subtle brand color ${mainColor}`
  }
  if (/건강|웰빙|피트니스|운동/.test(context)) {
    return `${base}, wellness object still life, clean towel, bottle, notebook, calm natural light, muted gray palette, subtle brand color ${mainColor}`
  }
  if (/it|saas|디지털|가전|소프트웨어/.test(context)) {
    return `${base}, minimal tech desk still life, device and notebook, soft gray background, calm product documentation mood, subtle brand color ${mainColor}`
  }
  return `${base}, muted editorial product still life, clean background, calm archive mood, subtle brand color ${mainColor}`
}

function removeForbiddenTerms(value: string, forbiddenWords: string[]) {
  return forbiddenWords.reduce((text, word) => {
    if (!word) return text
    return text.replaceAll(word, '')
  }, value).replace(/\s{2,}/g, ' ').trim()
}
