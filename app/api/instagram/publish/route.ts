import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { getAppBaseUrl, isInstagramMockMode } from '../../../../lib/env'
import { schedulePost, tokenEncryptor } from '../../../../lib/instagram/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, caption, hashtags } = body

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const campaign = await dbService.getCampaign(campaignId)
    if (!campaign || campaign.userId !== user.id) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const account = await dbService.getInstagramAccount(user.id, campaign.brandId)
    const isMock = isInstagramMockMode()

    if (!isMock && (!account || account.status !== 'CONNECTED')) {
      return NextResponse.json({ error: 'Instagram account not connected' }, { status: 400 })
    }

    const post = await dbService.createPost(user.id, campaign.brandId, campaignId, {
      caption: caption || '',
      hashtags: hashtags || '',
      scheduledAt: new Date(),
    })

    try {
      const accountId = account?.instagramAccountId || ''
      const decryptedToken = account ? tokenEncryptor.decrypt(account.accessTokenEncrypted) : ''
      const baseUrl = getAppBaseUrl()

      const imageUrls = campaign.slides
        .sort((a, b) => a.slideNumber - b.slideNumber)
        .map(s => {
          if (!s.imageUrl) return null
          if (s.imageUrl.startsWith('http://') || s.imageUrl.startsWith('https://')) return s.imageUrl
          return `${baseUrl}${s.imageUrl}`
        })
        .filter((url): url is string => !!url)

      if (imageUrls.length === 0) {
        await dbService.updatePostStatus(post.id, 'failed')
        return NextResponse.json({ error: 'No valid slide images' }, { status: 400 })
      }

      const result = await schedulePost(
        accountId,
        decryptedToken,
        imageUrls,
        `${caption || ''}\n\n${hashtags || ''}`.trim(),
        new Date()
      )

      if (result.success) {
        await dbService.updatePostStatus(post.id, 'posted', result.mediaId)
        await dbService.updateCampaignStatus(campaignId, 'posted')
        return NextResponse.json({ success: true, mediaId: result.mediaId })
      } else {
        await dbService.updatePostStatus(post.id, 'failed')
        return NextResponse.json({ error: result.error || 'Publish failed' }, { status: 500 })
      }
    } catch (error) {
      await dbService.updatePostStatus(post.id, 'failed')
      console.error('Publish error:', error)
      return NextResponse.json({ error: 'Failed to publish post' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error publishing post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
