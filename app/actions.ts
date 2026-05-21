'use server'

import { cookies } from 'next/headers'
import { dbService, User } from '../lib/db-service'
import { validateInstagramConnection, schedulePost, tokenEncryptor } from '../lib/instagram/client'
import { checkBrandCountLimit, checkCampaignCreationLimit } from '../lib/limits'
import { getInstagramAccessToken, getInstagramAccountId, isInstagramMockMode, getAppBaseUrl, isConfiguredOpenAIKey } from '../lib/env'
import { OpenAI } from 'openai'
import { isSubscriptionPlan } from '../lib/limits-types'
import { generateCarouselCampaign } from '../src/lib/carousel/pipeline'
import { getPipelineImageProvider } from '../src/lib/ai/providers'
import { LAYOUT_DEFINITIONS, type LayoutType } from '../src/lib/layout/layoutTypes'
import { generateOverlay } from '../src/lib/layout/overlayEngine'
import { renderMediaCard } from '../src/lib/layout/renderer'
import { planTypography } from '../src/lib/layout/typographyEngine'

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

// Helper to get authenticated user from session cookies
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const email = cookieStore.get('instaagent_session_email')?.value
  if (!email) return null
  
  try {
    return await dbService.getOrCreateUser(email)
  } catch (e) {
    console.error('Failed to get session user:', e)
    return null
  }
}

// User Mock Login Action
export async function loginAction(email: string, name?: string) {
  if (!email || !email.includes('@')) {
    return failed('올바른 이메일 주소를 입력해주세요.')
  }

  const user = await dbService.getOrCreateUser(email, name)
  const cookieStore = await cookies()
  
  // Set session cookie for 30 days
  cookieStore.set('instaagent_session_email', email, {
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  })

  return { success: true as const, user }
}

// Logout Action
export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('instaagent_session_email')
  return { success: true as const }
}

// Change Plan Action (Mock Pricing Switcher)
export async function changeUserPlanAction(plan: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!isSubscriptionPlan(plan)) {
    return failed('지원하지 않는 요금제입니다.')
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
    if (brandId) {
      const existingBrand = await dbService.getBrand(brandId)
      if (!existingBrand) return failed('브랜드를 찾을 수 없습니다.')
      if (existingBrand.userId !== user.id) return forbidden()
    }

    const brand = await dbService.saveBrand(user.id, brandId, data)
    return { success: true as const, brand }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '브랜드 저장에 실패했습니다.'))
  }
}

// Instagram Integration Action
export async function saveInstagramAccountAction(brandId: string, accountId: string, accessToken: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const normalizedAccountId = accountId || (isInstagramMockMode() ? getInstagramAccountId() : '')
  const normalizedAccessToken = accessToken || (isInstagramMockMode() ? getInstagramAccessToken() : '')

  if (!normalizedAccountId || !normalizedAccessToken) {
    return failed('계정 ID와 Access Token을 입력해 주세요.')
  }

  const brand = await dbService.getBrand(brandId)
  if (!brand) return failed('브랜드를 찾을 수 없습니다.')
  if (brand.userId !== user.id) return forbidden()

  // Validate connection
  const validation = await validateInstagramConnection(normalizedAccountId, normalizedAccessToken)
  if (!validation.success) {
    return failed(`인스타그램 계정 연동 실패: ${validation.error}`)
  }

  try {
    // Encrypt token
    const encryptedToken = tokenEncryptor.encrypt(normalizedAccessToken)
    
    const account = await dbService.saveInstagramAccount(
      user.id,
      brandId,
      normalizedAccountId,
      encryptedToken
    )
    
    return { success: true as const, account, username: validation.username }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '계정 연동 저장 중 오류가 발생했습니다.'))
  }
}

export async function quickConnectInstagramAction(brandId: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  const brand = await dbService.getBrand(brandId)
  if (!brand) return failed('브랜드를 찾을 수 없습니다.')
  if (brand.userId !== user.id) return forbidden()

  if (!isInstagramMockMode()) {
    return failed('빠른 연동은 로컬 시뮬레이션 모드에서만 사용할 수 있습니다. 운영 환경에서는 Meta API 정보를 직접 입력해 주세요.')
  }

  const accountId = getInstagramAccountId()
  const accessToken = getInstagramAccessToken()
  const validation = await validateInstagramConnection(accountId, accessToken)

  if (!validation.success) {
    return failed(`인스타그램 빠른 연동 실패: ${validation.error}`)
  }

  try {
    const encryptedToken = tokenEncryptor.encrypt(accessToken)
    const account = await dbService.saveInstagramAccount(
      user.id,
      brandId,
      accountId,
      encryptedToken
    )

    return { success: true as const, account, username: validation.username }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '빠른 연동 저장 중 오류가 발생했습니다.'))
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

export async function rerenderMediaSlideAction(slideId: string, headline: string, body: string) {
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
      headline,
      body,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      layout,
    })
    const overlay = generateOverlay(layout.overlayStyle)
    const background = await getPipelineImageProvider().generateImage(existingSlide.designPrompt, {
      size: '1024x1024',
      productImageUrls: [],
    })

    const imageUrl = await renderMediaCard({
      id: `media-card-rerender-${Date.now()}-${existingSlide.slideNumber}`,
      layout,
      typography,
      overlay,
      category: existingSlide.campaign.keyBenefits || '카드뉴스',
      headline,
      body,
      backgroundImageUrl: background.imageUrl,
      source,
      pageNumber: existingSlide.slideNumber,
      totalPages: existingSlide.campaign.slideCount,
    })

    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
    return { success: true as const, slide }
  } catch (err: unknown) {
    return failed(getErrorMessage(err, '슬라이드 재렌더링에 실패했습니다.'))
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
        const overlay = generateOverlay(layout.overlayStyle)
        const finalPrompt = `${keyword}, ${slide.designPrompt}`
        const imgResult = await provider.generateImage(finalPrompt)
        
        const finalImageUrl = await renderMediaCard({
          id: `media-card-style-${Date.now()}-${slide.slideNumber}`,
          layout,
          typography,
          overlay,
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

    return { success: true as const, slides: updatedSlides.sort((a, b) => a.slideNumber - b.slideNumber) }
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

function cleanHtmlText(html: string): string {
  // Remove script, style, svg, header, footer, nav tags and their contents
  let text = html.replace(/<(script|style|svg|noscript|header|footer|nav)[^>]*>([\s\S]*?)<\/\1>/gi, '')
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()
  // Limit character size to optimize token usage
  return text.substring(0, 5000)
}

function removeMarkdownBold(text: string): string {
  if (!text) return ''
  return text.replace(/\*\*/g, '')
}

function extractSmartStoreShopId(urlStr: string): string | null {
  try {
    const parsedUrl = new URL(urlStr)
    const hostname = parsedUrl.hostname
    if (hostname.includes('smartstore.naver.com')) {
      const pathname = parsedUrl.pathname // e.g. "/hu100"
      const segments = pathname.split('/').filter(Boolean)
      if (segments.length > 0) {
        return segments[0]
      }
    }
  } catch {
    const match = urlStr.match(/smartstore\.naver\.com\/([^/?#]+)/)
    if (match) return match[1]
  }
  return null
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

## 3. SNS 인스타그램 추천 전략
* **콘텐츠 포커스**:
  1. **웰빙 정보성 콘텐츠**: 면역력을 지키는 생활 습관, 친환경 제품 고르는 법 등 유용한 상식을 가독성 높은 카드뉴스로 연재.
  2. **일상 공감 & 휴식**: 힐링 감성을 담은 릴스 및 자연 친화적 피드 비주얼 구축.
* **사용 지양 용어 (금칙어)**: \`만병통치약, 기적의 효과, 최저가, 100% 완치\` (의료법상 허위/과대광고 소지가 있거나 신뢰를 저해하는 극단적 표현 배제)
* **피드 전환율 상승을 위한 CTA**: \`오늘의 건강 혜택 프로필 링크에서 확인하기\`
`
    return { brandProfile, markdownReport }
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

## 3. SNS 인스타그램 추천 전략
* **콘텐츠 포커스**:
  1. **실제 사용 후기**: 고객의 리얼 포토리뷰를 활용한 소셜 프루프(Social Proof) 카드뉴스 제작.
  2. **혜택 안내**: 알림받기 동의 쿠폰, 포인트 적립 이벤트 등 스마트스토어 연동 혜택 적극 홍보.
* **사용 지양 용어 (금칙어)**: \`최저가, 100% 보장, 광고, 실패없는\` (지나치게 상업적이거나 어뷰징 요소가 느껴지는 문구 제외)
* **피드 전환율 상승을 위한 CTA**: \`스토어에서 단독 혜택 만나보기\`
`
    return { brandProfile, markdownReport }
  }
}

export async function analyzeBrandWebsiteAction(url: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!url || !url.startsWith('http')) {
    return failed('올바른 URL 형식(http:// 또는 https://)을 입력해 주세요.')
  }

  let targetUrl = url
  const isSmartStore = url.includes('smartstore.naver.com')
  if (isSmartStore && !url.includes('m.smartstore.naver.com')) {
    targetUrl = url.replace('smartstore.naver.com', 'm.smartstore.naver.com')
  }

  const shopId = isSmartStore ? extractSmartStoreShopId(targetUrl) : null

  try {
    console.log(`Scraping URL: ${targetUrl}`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout

    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    }

    if (isSmartStore) {
      headers['User-Agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
      headers['Referer'] = 'https://m.search.naver.com/'
    } else {
      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`웹사이트를 불러오지 못했습니다. (HTTP ${response.status})`)
    }

    const html = await response.text()
    const cleanedText = cleanHtmlText(html)

    if (cleanedText.length < 50) {
      throw new Error('웹사이트에서 텍스트 정보를 충분히 추출할 수 없습니다. 빈 페이지이거나 차단되었을 수 있습니다.')
    }

    const apiKey = process.env.OPENAI_API_KEY
    const useRealAI = isConfiguredOpenAIKey(apiKey)

    if (useRealAI) {
      const openai = new OpenAI({ apiKey })
      const prompt = `
You are an expert brand consultant and digital marketer.
Analyze the following text content scraped from a user's store or brand website, and extract/infer the brand profile fields.
Also, write a professional brand analysis report in Markdown format.

[Scraped Website Content]
${cleanedText}

[Requirements]
1. Identify the brand's name, core products/items, target audience, tone of voice, a recommended primary brand color (HEX code), any words to avoid (forbidden words), and a default Call-to-Action (CTA) style for Instagram.
2. The primary brand color must be a high-quality hex color code (e.g. '#B94718', '#2D3748', etc.) that represents the brand's aesthetic.
3. Recommend 2-4 forbidden words that are overused or spammy in this brand's industry.
4. The tone of voice must match one of these pre-defined options or a custom short variant:
   - "친근하고 명확한 톤" (Friendly and clear)
   - "전문적이고 신뢰감 있는 톤" (Professional and trustworthy)
   - "젊고 경쾌한 톤" (Young and cheerful)
   - "고급스럽고 차분한 톤" (Premium and calm)
5. The industry must fit one of: '온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS'.
6. Write a brand identity report in Markdown (under "markdownReport"). Keep it professional, informative, and written in Korean (한국어). The report should outline the Brand Identity, Key Strengths, and SNS content strategy suggestions.
7. CRITICAL: Do NOT use markdown bold syntax like '**' or '***' anywhere in the "markdownReport". Write section items in plain text, e.g. use "브랜드명: 값" instead of "**브랜드명**: 값".

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "name": "Brand Name (Korean/English)",
  "industry": "One of the 6 industries listed above",
  "targetAudience": "Target customers description (e.g. 2030 여성 직장인)",
  "toneOfVoice": "One of the 4 tones listed above",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "word1, word2, word3",
  "ctaStyle": "A short call-to-action recommendation (e.g. 프로필 링크에서 만나보기)",
  "markdownReport": "# 🏷️ 브랜드 분석 및 구도 기획서\\n\\n## 1. 브랜드 정체성\\n브랜드명: 휴100\\n업종: 온라인 스토어\\n\\n## 2. SNS 콘텐츠 전략\\n..."
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
            name: parsed.name || '알 수 없음',
            industry: parsed.industry || '온라인 스토어',
            targetAudience: parsed.targetAudience || '대중 고객',
            toneOfVoice: parsed.toneOfVoice || '친근하고 명확한 톤',
            mainColor: parsed.mainColor || '#b94718',
            forbiddenWords: parsed.forbiddenWords || '',
            ctaStyle: parsed.ctaStyle || '프로필 링크에서 확인하기'
          },
          markdownReport: removeMarkdownBold(parsed.markdownReport || '# 분석 실패\n\nAI 분석 결과를 불러오지 못했습니다.')
        }
      } else {
        throw new Error('AI 분석 실패: 응답이 비어있습니다.')
      }

    } else {
      console.log('Using Mock Brand Website Analyzer (OpenAI key not configured)')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulation delay

      if (isSmartStore && shopId) {
        const result = getNaverSmartstoreFallback(shopId, targetUrl)
        return {
          success: true as const,
          brandProfile: result.brandProfile,
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
          ctaStyle: '프로필 링크에서 무료로 시작하기'
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
* 권장 톤앤매너: ${mockProfile.toneOfVoice} (일관된 인스타그램 브랜딩에 도움을 줍니다)

## 3. SNS 인스타그램 추천 전략
* 콘텐츠 포커스:
  1. 정보성 콘텐츠 위주로 전문성과 신뢰도를 확보합니다.
  2. 고객 피드백과 비포/애프터(혹은 후기)를 가공해 캐러셀 카드뉴스로 발행합니다.
* 사용 지양 용어 (금칙어): \`${mockProfile.forbiddenWords}\` (인스타그램 가이드라인 준수 및 브랜드 신뢰 유지를 위해 사용을 삼가세요)
* 피드 전환율 상승을 위한 CTA: \`${mockProfile.ctaStyle}\`
`

      return {
        success: true as const,
        brandProfile: mockProfile,
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

Based on this information, infer/predict a highly relevant brand profile and write a professional brand identity & Instagram marketing strategy report in Markdown.

[Requirements]
1. Since we couldn't scrape, predict the brand profile values based on the shop ID "${shopId}". For "hu100", match it to a Wellness/Healthy food/Eco-friendly curated lifestyle store. For other IDs, generate a plausible modern online store profile.
2. The tone of voice must match one of: "친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤".
3. The industry must fit '온라인 스토어'.
4. Write a beautiful brand identity and Instagram marketing report in Markdown (under "markdownReport") in Korean.
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
                ctaStyle: parsed.ctaStyle || '프로필 링크에서 확인하기'
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
        brandProfile: localResult.brandProfile,
        markdownReport: removeMarkdownBold(localResult.markdownReport)
      }
    }

    return failed(err instanceof Error ? err.message : '웹사이트를 분석하는 중 알 수 없는 오류가 발생했습니다.')
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
    const brand = await dbService.getBrand(brandId)
    if (!brand) return failed('브랜드를 찾을 수 없습니다.')
    if (brand.userId !== user.id) return forbidden()

    const apiKey = process.env.OPENAI_API_KEY
    const useRealAI = isConfiguredOpenAIKey(apiKey)

    if (useRealAI) {
      const openai = new OpenAI({ apiKey })
      const prompt = `
You are an expert AI Marketing Planner.
Based on the following brand profile and a raw topic/idea for an Instagram carousel campaign, generate optimized configuration values and slide content for the campaign.

[Brand Profile]
- Brand Name: ${brand.name}
- Industry: ${brand.industry}
- Target Audience: ${brand.targetAudience}
- Tone of Voice: ${brand.toneOfVoice}
- Main Color: ${brand.mainColor}
- Forbidden Words: ${brand.forbiddenWords || 'None'}
- CTA Style: ${brand.ctaStyle || 'None'}

[Campaign Topic/Idea]
${topic}

[Requirements]
1. Select the most matching option for each field:
   - "contentType": One of ['신상품 홍보', '베스트셀러 추천', '고객 리얼 리뷰', '브랜드 스토리', '세일/이벤트 안내', '꿀팁/큐레이션']
   - "category": One of ['패션/의류', '뷰티/화장품', '리빙/인테리어', '푸드/식품', '디지털/가전', '라이프스타일', '반려동물', '기타']
   - "tone": One of ['감성적이고 따뜻하게', '시크하고 고급스럽게', '톡톡 튀고 트렌디하게', '정보가 쏙쏙 들어오게', '신뢰감 있고 전문적이게']
   - "slideCount": Recommended total number of slides (Must be exactly one of [5, 7, 10])
2. Generate:
   - "title": A catchy, click-worthy Instagram headline (under 25 chars, no emoji, no markdown bold).
   - "keyContent": Detailed copy for each slide. Write one line (or a bullet point) per slide. The number of lines/points must match "slideCount". Each line should contain the headline and sub-content for that slide, separated by a dash or newline. Do not include markdown bold syntax (**). E.g., "- 슬라이드 1 헤드라인: 본문내용\n- 슬라이드 2 헤드라인: 본문내용"
   - "visualHint": A premium prompt description for background image generation (e.g. DALL-E 3). It should describe a clean, non-cluttered, high contrast background scene matching the brand's mainColor (${brand.mainColor}) and tone. (e.g., "monochrome clean minimalist studio setup with soft shadow, brand color highlights")
   - "source": Recommended brand label/watermark (e.g. brand website, or Instagram handle, or simply "${brand.name}")
3. CRITICAL: Do NOT use markdown bold syntax (** or ***) anywhere in the text. Keep all text plain and clean.

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
        const parsed = JSON.parse(rawJson)
        return {
          success: true as const,
          recommendation: {
            contentType: parsed.contentType || '신상품 홍보',
            category: parsed.category || '기타',
            tone: parsed.tone || '감성적이고 따뜻하게',
            title: removeMarkdownBold(parsed.title || `[${brand.name}] ${topic}`),
            keyContent: removeMarkdownBold(parsed.keyContent || `- 핵심가치 소개: ${topic} 관련 브랜드 스토리\n- 주요 특징 안내: 스토어만의 강점`),
            visualHint: parsed.visualHint || `minimalist design matching brand color ${brand.mainColor}`,
            source: parsed.source || brand.name,
            slideCount: Number(parsed.slideCount) || 7
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

      // Default values
      let contentType = '신상품 홍보'
      let category = '라이프스타일'
      let tone = '감성적이고 따뜻하게'
      let title = `[${brand.name}] 올여름 신제품 라인업 공개`
      let keyContent = `- 신제품 출시 소식: 드디어 공개되는 브랜드 뉴 컬렉션\n- 특별한 디테일: 오직 우리 고객만을 위한 섬세한 가공\n- 소장 가치 가득: 일상에 특별함을 한 스푼 얹어줄 아이템\n- 한정 수량 안내: 서둘러 구매해야 할 소장 가치 제품\n- 런칭 기념 특별 혜택: 오직 지금만 드리는 기간 한정 선물`
      let visualHint = `minimalist clean studio setup with soft shadow, accentuating brand color ${brand.mainColor}`
      const slideCount = 5

      // Matching based on topic and industry
      if (lowerTopic.includes('세일') || lowerTopic.includes('할인') || lowerTopic.includes('이벤트') || lowerTopic.includes('쿠폰')) {
        contentType = '세일/이벤트 안내'
        title = `🚨 [단독] ${brand.name} 특별 시즌 세일 EVENT`
        keyContent = `- 시즌 오프 세일: 역대급 혜택으로 만나는 시그니처 아이템\n- 최대 할인율 안내: 놓칠 수 없는 파격적인 찬스\n- 베스트 아이템 추천: MD가 엄선한 실패 없는 쇼핑 리스트\n- 추가 쿠폰 혜택: 카카오 채널 추가 시 즉시 사용 가능\n- 구매 방법 가이드: 프로필 링크 클릭 후 구매처로 이동`
      } else if (lowerTopic.includes('리뷰') || lowerTopic.includes('후기') || lowerTopic.includes('추천') || lowerTopic.includes('베스트')) {
        contentType = '고객 리얼 리뷰'
        title = `⭐️ 실제 구매 고객이 입증한 ${brand.name} 찐 후기`
        keyContent = `- 리얼 구매 후기: 사용해 본 분들이 극찬하는 실제 피드백\n- 솔직한 만족도: 피부 자극이 없고 하루 종일 아늑한 사용감\n- 재구매율 1위의 비결: 까다로운 검수로 신뢰를 담은 품질\n- 적극 추천 한마디: 삶의 질이 수직 상승했다는 감동의 메시지\n- 한정 혜택 겟하기: 지금 프로필 링크를 통해 할인 혜택 받기`
      } else if (lowerTopic.includes('꿀팁') || lowerTopic.includes('정보') || lowerTopic.includes('방법') || lowerTopic.includes('큐레이션')) {
        contentType = '꿀팁/큐레이션'
        title = `💡 알아두면 삶의 질 올라가는 3가지 생활 꿀팁`
        keyContent = `- 유용한 정보 공유: 일상에서 바로 활용 가능한 실전 가이드\n- 핵심 팁 첫 번째: 제품을 더 오랫동안 깨끗하게 유지하는 노하우\n- 핵심 팁 두 번째: 200% 활용해 실용성을 극대화하는 매칭 방법\n- 핵심 팁 세 번째: 브랜드가 권장하는 올바른 사용 주기 관리\n- 더 많은 정보 찾기: ${brand.name} 계정 팔로우하고 꿀팁 받아보기`
      }

      // Category matching by Industry
      if (lowerIndustry.includes('온라인') || lowerIndustry.includes('스토어') || lowerIndustry.includes('셀렉')) {
        category = lowerTopic.includes('원피스') || lowerTopic.includes('의류') || lowerTopic.includes('패션') ? '패션/의류' : '라이프스타일'
      } else if (lowerIndustry.includes('뷰티') || lowerIndustry.includes('화장') || lowerIndustry.includes('헤어') || lowerIndustry.includes('에스테틱')) {
        category = '뷰티/화장품'
        tone = '시크하고 고급스럽게'
        if (contentType === '신상품 홍보') {
          title = `✨ 맑고 투명하게 빛나는 피부 비결, 신제품 런칭`
          keyContent = `- 신제품 런칭: 피부 속부터 은은하게 차오르는 광채 솔루션\n- 고농축 유기농 성분: 지친 피부에 깊은 영양과 수분 공급\n- 저자극 안심 포뮬러: 예민한 피부도 편안하게 바르는 데일리 케어\n- 임상 시험 완료: 단 일주일 사용으로 느껴지는 맑은 변화\n- 단독 예약 판매: 지금 선주문 시 풍성한 샘플 추가 증정`
        }
      } else if (lowerIndustry.includes('카페') || lowerIndustry.includes('푸드') || lowerIndustry.includes('식품') || lowerIndustry.includes('커피')) {
        category = '푸드/식품'
        tone = '톡톡 튀고 트렌디하게'
        if (contentType === '신상품 홍보') {
          title = `☕️ [신메뉴] 입안 가득 퍼지는 달콤 쌉싸름한 힐링`
          keyContent = `- 새로운 메뉴 출시: 신선함과 달콤함의 조화로운 밸런스\n- 엄선된 최고급 원재료: 로컬 농가에서 직송한 유기농 재료 사용\n- 바리스타 추천 페어링: 디저트와 함께 즐기면 풍미가 두 배\n- 건강한 대체당 활용: 칼로리 부담 없이 가볍게 즐기는 시간\n- 신메뉴 런칭 이벤트: 구매 인증샷 업로드 시 드립백 증정`
        }
      } else if (lowerIndustry.includes('피트니스') || lowerIndustry.includes('헬스') || lowerIndustry.includes('운동')) {
        category = '라이프스타일'
        tone = '정보가 쏙쏙 들어오게'
        if (contentType === '신상품 홍보') {
          title = `💪 단 10분 투자로 굽은 등 펴는 기적의 루틴`
          keyContent = `- 현대인 필수 스트레칭: 거북목과 굽은 어깨 완화를 위한 홈트\n- 첫 번째 동작: 폼롤러를 활용해 굳어있는 흉추 풀어주기\n- 두 번째 동작: 벽을 짚고 가슴 근육 시원하게 스트레칭하기\n- 세 번째 동작: 등 근육 활성화를 위한 날개뼈 모으기 루틴\n- 체계적인 체형 교정: 더 자세한 1:1 진단은 센터로 문의하기`
        }
      } else if (lowerIndustry.includes('it') || lowerIndustry.includes('saas') || lowerIndustry.includes('소프트웨어')) {
        category = '디지털/가전'
        tone = '신뢰감 있고 전문적이게'
      }

      // Add visual hint based on category & color
      if (category === '패션/의류') {
        visualHint = `monochrome minimalist Scandinavian fashion aesthetic background with fabric texture, subtle accent of ${brand.mainColor}`
      } else if (category === '뷰티/화장품') {
        visualHint = `luxury high-end cosmetics photography background, clean glossy marble surface, gentle water ripple shadows, brand color ${brand.mainColor} hints`
      } else if (category === '푸드/식품') {
        visualHint = `warm cozy organic food studio background with neutral tones, rustic wood details, accentuating color ${brand.mainColor}`
      } else {
        visualHint = `clean minimalist geometric abstract background with soft studio lighting, showcasing brand color ${brand.mainColor} highlighting`
      }

      // Custom adjustments based on user input
      if (lowerTopic.includes('원피스') || lowerTopic.includes('리넨')) {
        category = '패션/의류'
        tone = '감성적이고 따뜻하게'
        title = `올여름 필수템, 핏 예쁘고 아늑한 리넨 원피스`
        keyContent = `- 편안한 내추럴 무드: 100% 천연 리넨이 주는 기분 좋은 감촉\n- 체형 커버 실루엣: 군더더기 없이 일자로 툭 떨어지는 우아한 피팅\n- 뛰어난 통기성: 무더운 한여름에도 땀 흡수가 빨라 하루 종일 쾌적\n- 다양한 컬러 라인업: 내 마음에 드는 내추럴 컬러 초이스\n- 런칭 특별가 혜택: 오늘만 단독 할인 제공, 프로필 링크 참조`
      } else if (lowerTopic.includes('건강식품') || lowerTopic.includes('웰빙') || lowerTopic.includes('영양제')) {
        category = '푸드/식품'
        tone = '신뢰감 있고 전문적이게'
        title = `지친 직장인 피로 회복을 돕는 건강 웰빙템`
        keyContent = `- 매일 활력 충전: 피로와 스트레스에 지친 현대인을 위한 솔루션\n- 엄선한 원료: 합성 보존료를 완전히 제외한 프리미엄 자연 유래 성분\n- 하루 한 포의 습관: 언제 어디서나 간편하게 섭취 가능한 포장 형태\n- 믿을 수 있는 제조 공정: HACCP 인증 마크로 더욱 안심하고 섭취\n- 스토어 알림 혜택: 첫 구매 쿠폰 받고 즉시 건강 챙기기`
      }

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

