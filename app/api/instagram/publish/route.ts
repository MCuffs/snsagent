import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { isInstagramMockMode } from '../../../../lib/env'
import { publishPostToInstagram } from '../../../../lib/instagram/publish'

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
      if (isMock || !account || account.status !== 'CONNECTED') {
        // Mock mode: simulate success
        const mockMediaId = `ig_media_${Math.floor(10000000 + Math.random() * 90000000)}`
        await dbService.updatePostStatus(post.id, 'posted', mockMediaId)
        await dbService.updateCampaignStatus(campaignId, 'posted')
        return NextResponse.json({ success: true, mediaId: mockMediaId })
      }

      const result = await publishPostToInstagram({
        postId: post.id,
        campaignId,
        campaign,
        account,
        caption: caption || '',
        hashtags: hashtags || '',
      })

      if (result.success) {
        return NextResponse.json({ success: true, mediaId: result.mediaId })
      } else {
        return NextResponse.json({ error: result.error }, { status: 500 })
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
