'use server'

import { cookies } from 'next/headers'
import { dbService, User } from '../lib/db-service'
import { generateCarousel } from '../lib/ai/generateCarousel'
import { getImageProvider } from '../lib/ai/imageProvider'
import { validateInstagramConnection, schedulePost, tokenEncryptor } from '../lib/instagram/client'
import { checkBrandCountLimit, checkCampaignCreationLimit } from '../lib/limits'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
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
    return { success: false, error: '올바른 이메일 주소를 입력해주세요.' }
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

  return { success: true, user }
}

// Logout Action
export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete('instaagent_session_email')
  return { success: true }
}

// Change Plan Action (Mock Pricing Switcher)
export async function changeUserPlanAction(plan: string) {
  const user = await getSessionUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  await dbService.updateUserPlan(user.id, plan)
  
  // Clear layout cache
  await cookies() // dummy read to bypass Next.js server actions cache
  return { success: true }
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
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  // Limit check for new brand creation
  if (!brandId) {
    const limitCheck = await checkBrandCountLimit(user.id)
    if (!limitCheck.allowed) {
      return { 
        success: false, 
        error: `브랜드 생성 한도를 초과했습니다. 현재 요금제(${user.plan})의 브랜드 한도는 최대 ${limitCheck.limit}개입니다.` 
      }
    }
  }

  try {
    const brand = await dbService.saveBrand(user.id, brandId, data)
    return { success: true, brand }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, '브랜드 저장에 실패했습니다.') }
  }
}

// Instagram Integration Action
export async function saveInstagramAccountAction(brandId: string, accountId: string, accessToken: string) {
  const user = await getSessionUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  if (!accountId || !accessToken) {
    return { success: false, error: '계정 ID와 Access Token을 입력해 주세요.' }
  }

  // Validate connection
  const validation = await validateInstagramConnection(accountId, accessToken)
  if (!validation.success) {
    return { success: false, error: `인스타그램 계정 연동 실패: ${validation.error}` }
  }

  try {
    // Encrypt token
    const encryptedToken = tokenEncryptor.encrypt(accessToken)
    
    const account = await dbService.saveInstagramAccount(
      user.id,
      brandId,
      accountId,
      encryptedToken
    )
    
    return { success: true, account, username: validation.username }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, '계정 연동 저장 중 오류가 발생했습니다.') }
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
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  // Limit Check
  const limitCheck = await checkCampaignCreationLimit(user.id)
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `월간 카드뉴스 생성 한도를 초과했습니다. 이번 달 누적 생성 건수: ${limitCheck.current}/${limitCheck.limit}개 (${user.plan} 플랜)`
    }
  }

  const brand = await dbService.getBrand(brandId)
  if (!brand) return { success: false, error: '브랜드를 찾을 수 없습니다.' }

  try {
    // Step 1: AI Content Generation (Text logic)
    const carouselPlan = await generateCarousel(
      {
        name: brand.name,
        industry: brand.industry,
        targetAudience: brand.targetAudience,
        toneOfVoice: brand.toneOfVoice,
        mainColor: brand.mainColor,
        forbiddenWords: brand.forbiddenWords,
        ctaStyle: brand.ctaStyle,
      },
      data,
      data.slideCount
    )

    // Step 2: Parallel image generation for each slide using the selected provider
    const provider = getImageProvider()
    const slideWithImages = await Promise.all(
      carouselPlan.slides.map(async (slide) => {
        try {
          const imgResult = await provider.generateImage(slide.designPrompt)
          return {
            ...slide,
            imageUrl: imgResult.imageUrl,
          }
        } catch (imgErr) {
          console.error(`Failed to generate image for slide ${slide.slideNumber}:`, imgErr)
          return {
            ...slide,
            imageUrl: null, // Gracefully handle image generation failure
          }
        }
      })
    )

    // Step 3: Save campaign details and slides to DB
    const campaign = await dbService.createCampaign(
      user.id,
      brandId,
      {
        title: carouselPlan.title,
        productName: data.productName,
        productDescription: data.productDescription,
        keyBenefits: data.keyBenefits,
        objective: data.objective,
        slideCount: data.slideCount,
      },
      slideWithImages
    )

    // Step 4: Create a draft Post container ready for Caption Review & Scheduling
    // ScheduledAt defaults to tomorrow at the AI's recommended time
    const [recHours, recMinutes] = (carouselPlan.recommendedPostTime || '06:00 PM').split(/[:\s]/)
    const isPM = (carouselPlan.recommendedPostTime || '').toLowerCase().includes('pm')
    
    let hours = parseInt(recHours) || 18
    if (isPM && hours < 12) hours += 12
    if (!isPM && hours === 12) hours = 0
    const minutes = parseInt(recMinutes) || 0

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(hours, minutes, 0, 0)

    const post = await dbService.createPost(user.id, brandId, campaign.id, {
      caption: carouselPlan.caption,
      hashtags: carouselPlan.hashtags.join(', '),
      scheduledAt: tomorrow,
    })

    return { 
      success: true, 
      campaignId: campaign.id,
      postId: post.id 
    }
  } catch (err: unknown) {
    console.error('Campaign creation failed:', err)
    return { success: false, error: getErrorMessage(err, '카드뉴스 기획 생성에 실패했습니다.') }
  }
}

// Update slide copy content
export async function updateSlideAction(slideId: string, headline: string, body: string, imageUrl?: string | null) {
  try {
    const slide = await dbService.updateSlideContent(slideId, headline, body, imageUrl)
    return { success: true, slide }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, '슬라이드 수정에 실패했습니다.') }
  }
}

// Update post caption & hashtags
export async function updatePostDetailsAction(postId: string, caption: string, hashtags: string) {
  try {
    const post = await dbService.updatePostDetails(postId, caption, hashtags)
    return { success: true, post }
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, '피드 정보 수정에 실패했습니다.') }
  }
}

// Campaign & Post approval trigger (Human-in-the-loop)
export async function approveAndScheduleCampaignAction(
  campaignId: string,
  postId: string,
  postData: { caption: string; hashtags: string; scheduledAt: string }
) {
  const user = await getSessionUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  try {
    // 1. Fetch Instagram Account integration info
    const campaign = await dbService.getCampaign(campaignId)
    if (!campaign) return { success: false, error: '캠페인을 찾을 수 없습니다.' }

    const account = await dbService.getInstagramAccount(user.id, campaign.brandId)
    const isMock = process.env.INSTAGRAM_MOCK_MODE === 'true'

    if (!isMock && (!account || account.status !== 'CONNECTED')) {
      return { 
        success: false, 
        error: '인스타그램 연동 정보가 없습니다. [Instagram 설정] 메뉴에서 먼저 계정을 연동해 주세요.' 
      }
    }

    const accountId = account?.instagramAccountId || process.env.INSTAGRAM_ACCOUNT_ID || 'mock_account_id'
    const decryptedToken = account ? tokenEncryptor.decrypt(account.accessTokenEncrypted) : ''

    // Gather all slide images
    const imageUrls = campaign.slides
      .sort((a, b) => a.slideNumber - b.slideNumber)
      .map(s => s.imageUrl)
      .filter((url): url is string => !!url)

    if (imageUrls.length === 0) {
      return { success: false, error: '카드뉴스에 유효한 이미지가 없습니다.' }
    }

    // 2. Parse scheduled time
    const scheduledDate = new Date(postData.scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: '잘못된 예약 시간 형식입니다.' }
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
      return { success: false, error: `인스타그램 예약 업로드 실패: ${result.error}` }
    }

    // 5. Update status to scheduled or posted
    const targetStatus = scheduledDate.getTime() <= Date.now() + 60000 ? 'posted' : 'scheduled'
    
    await dbService.updatePostStatus(postId, targetStatus, result.mediaId)
    await dbService.updateCampaignStatus(campaignId, targetStatus)

    return { 
      success: true, 
      status: targetStatus,
      message: targetStatus === 'posted' ? '인스타그램에 즉시 업로드 완료!' : '예약이 승인되어 스케줄러에 등록되었습니다.'
    }
  } catch (err: unknown) {
    console.error('Approval flow error:', err)
    return { success: false, error: getErrorMessage(err, '승인 처리 도중 오류가 발생했습니다.') }
  }
}

// Regenerate campaign images using a specific style preset
export async function regenerateCampaignImagesAction(campaignId: string, styleName: string) {
  const user = await getSessionUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const campaign = await dbService.getCampaign(campaignId)
  if (!campaign) return { success: false, error: '캠페인을 찾을 수 없습니다.' }

  // Define style prompt prefixes
  const styleKeywords: Record<string, string> = {
    minimalist: 'minimalist clean Scandinavian design, soft pastel tones, high quality empty background',
    gradients: 'vibrant abstract glassmorphism fluid gradient colors, neon glowing shapes',
    cyberpunk: 'futuristic dark cyberpunk tech city design, neon blue and orange cyber lighting, high contrast',
    vector: 'flat 2D vector graphic illustration, cute simple shapes, modern illustration style',
    photo: 'hyperrealistic commercial brand photoshoot, premium studio lighting, soft shadows, photorealistic'
  }

  const keyword = styleKeywords[styleName] || styleKeywords.minimalist

  try {
    const provider = getImageProvider()
    const updatedSlides = await Promise.all(
      campaign.slides.map(async (slide) => {
        // Construct new design prompt with visual style override
        const finalPrompt = `${keyword}, representing: ${slide.designPrompt}`
        const imgResult = await provider.generateImage(finalPrompt)
        
        // Save to DB
        const updated = await dbService.updateSlideContent(slide.id, slide.headline, slide.body, imgResult.imageUrl)
        
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

    return { success: true, slides: updatedSlides.sort((a, b) => a.slideNumber - b.slideNumber) }
  } catch (err: unknown) {
    console.error('Failed to regenerate style images:', err)
    return { success: false, error: getErrorMessage(err, '이미지 스타일 일괄 재생성에 실패했습니다.') }
  }
}

// Manually trigger background scheduler (Simulator)
export async function triggerSchedulerAction() {
  const user = await getSessionUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  try {
    // Fetch all posts for the user
    const posts = await dbService.getPosts(user.id)
    
    // Filter scheduled posts (we process ALL scheduled posts for instant testing gratification)
    const scheduledPosts = posts.filter(p => p.status === 'scheduled')

    if (scheduledPosts.length === 0) {
      return { 
        success: true, 
        processedCount: 0, 
        message: '현재 발행 대기 중(scheduled)인 포스트가 없습니다. 카드뉴스를 승인하여 예약 상태로 먼저 만들어보세요.' 
      }
    }

    // Process each post (simulate publisher queue worker)
    for (const post of scheduledPosts) {
      const mockMediaId = `ig_media_${Math.floor(10000000 + Math.random() * 90000000)}`
      
      // Update DB post status to posted
      await dbService.updatePostStatus(post.id, 'posted', mockMediaId)
      
      // Update campaign status to posted
      await dbService.updateCampaignStatus(post.campaignId, 'posted')
    }

    return { 
      success: true, 
      processedCount: scheduledPosts.length, 
      message: `성공: 대기 중이던 ${scheduledPosts.length}개의 카드뉴스 포스트가 인스타그램에 가상 발행 완료(posted) 처리되었습니다.` 
    }
  } catch (err: unknown) {
    console.error('Scheduler manual execution failed:', err)
    return { success: false, error: getErrorMessage(err, '스케줄러 작동 중 실패했습니다.') }
  }
}

