import { dbService, type Campaign, type InstagramAccount } from '../db-service'
import { getAppBaseUrl } from '../env'
import { schedulePost, tokenEncryptor } from './client'

/**
 * Build absolute URLs for all slide images in a campaign
 */
export function buildSlideImageUrls(campaign: Campaign, baseUrl?: string): string[] {
  const resolvedBaseUrl = baseUrl || getAppBaseUrl()
  const slides = campaign.slides || []
  return slides
    .sort((a, b) => a.slideNumber - b.slideNumber)
    .map(s => {
      if (!s.imageUrl) return null
      if (s.imageUrl.startsWith('http://') || s.imageUrl.startsWith('https://')) {
        return s.imageUrl
      }
      return `${resolvedBaseUrl}${s.imageUrl}`
    })
    .filter((url): url is string => !!url)
}

/**
 * Publish a campaign to Instagram
 * 
 * @returns { success: true, mediaId: string } on success
 * @returns { success: false, error: string } on failure
 */
export async function publishCampaignToInstagram(params: {
  campaign: Campaign
  account: InstagramAccount
  caption?: string
  hashtags?: string
  baseUrl?: string
}): Promise<{ success: true; mediaId: string } | { success: false; error: string }> {
  const { campaign, account, caption = '', hashtags = '' } = params

  try {
    // Validate account is connected
    if (account.status !== 'CONNECTED') {
      return { success: false, error: 'Instagram account is not connected' }
    }

    // Build image URLs
    const imageUrls = buildSlideImageUrls(campaign, params.baseUrl)
    if (imageUrls.length === 0) {
      return { success: false, error: 'No valid slide images found for this campaign' }
    }

    // Decrypt access token
    const decryptedToken = tokenEncryptor.decrypt(account.accessTokenEncrypted)
    const accountId = account.instagramAccountId

    // Publish to Instagram
    const result = await schedulePost(
      accountId,
      decryptedToken,
      imageUrls,
      `${caption}\n\n${hashtags}`.trim(),
      new Date() // Immediate publish
    )

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to publish to Instagram' }
    }

    return { success: true, mediaId: result.mediaId! }
  } catch (error) {
    console.error('Instagram publish error:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during publishing' 
    }
  }
}

/**
 * Publish a post and update database status
 */
export async function publishPostToInstagram(params: {
  postId: string
  campaignId: string
  campaign: Campaign
  account: InstagramAccount
  caption?: string
  hashtags?: string
  baseUrl?: string
}): Promise<{ success: true; mediaId: string } | { success: false; error: string }> {
  const { postId, campaignId, campaign, account, caption, hashtags, baseUrl } = params

  const result = await publishCampaignToInstagram({
    campaign,
    account,
    caption,
    hashtags,
    baseUrl
  })

  if (result.success) {
    await dbService.updatePostStatus(postId, 'posted', result.mediaId)
    await dbService.updateCampaignStatus(campaignId, 'posted')
  } else {
    await dbService.updatePostStatus(postId, 'failed')
  }

  return result
}
