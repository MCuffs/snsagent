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
    const { campaignId, scheduledAt, caption, hashtags } = body

    if (!campaignId || !scheduledAt) {
      return NextResponse.json({ error: 'campaignId and scheduledAt are required' }, { status: 400 })
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

    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'Invalid scheduled time' }, { status: 400 })
    }

    const post = await dbService.createPost(user.id, campaign.brandId, campaignId, {
      caption: caption || '',
      hashtags: hashtags || '',
      scheduledAt: scheduledDate,
    })

    const isImmediate = scheduledDate.getTime() <= Date.now() + 60000

    if (isImmediate) {
      try {
        if (isMock || !account || account.status !== 'CONNECTED') {
          // Mock mode: simulate success
          const mockMediaId = `ig_media_${Math.floor(10000000 + Math.random() * 90000000)}`
          await dbService.updatePostStatus(post.id, 'posted', mockMediaId)
          await dbService.updateCampaignStatus(campaignId, 'posted')
          return NextResponse.json({ success: true, status: 'posted', mediaId: mockMediaId })
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
          return NextResponse.json({ success: true, status: 'posted', mediaId: result.mediaId })
        } else {
          return NextResponse.json({ error: result.error }, { status: 500 })
        }
      } catch (error) {
        await dbService.updatePostStatus(post.id, 'failed')
        console.error('Immediate publish error:', error)
        return NextResponse.json({ error: 'Failed to publish' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, status: 'scheduled', postId: post.id })
  } catch (error) {
    console.error('Error scheduling post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
