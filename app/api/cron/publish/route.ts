import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { schedulePost, tokenEncryptor } from '../../../../lib/instagram/client'
import { isInstagramMockMode } from '../../../../lib/env'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}

async function handleCron(request: NextRequest) {
  // 1. Cron Secret Verification
  const systemSecret = process.env.CRON_SECRET
  if (systemSecret) {
    const authHeader = request.headers.get('authorization')
    const querySecret = request.nextUrl.searchParams.get('secret')
    
    let providedSecret = ''
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedSecret = authHeader.substring(7)
    } else if (querySecret) {
      providedSecret = querySecret
    }

    if (providedSecret !== systemSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Invalid secret key.' },
        { status: 401 }
      )
    }
  }

  try {
    // 2. Fetch pending posts (scheduledAt <= now && status === 'scheduled')
    const pendingPosts = await dbService.getPendingScheduledPosts()
    
    if (pendingPosts.length === 0) {
      return NextResponse.json({
        success: true,
        processedCount: 0,
        message: 'No pending scheduled posts to publish at this time.'
      })
    }

    let processedCount = 0
    let failuresCount = 0
    const results: Array<{ postId: string; campaignTitle: string; status: 'posted' | 'failed'; error?: string }> = []

    // 3. Process each pending post
    for (const post of pendingPosts) {
      const isMock = isInstagramMockMode()
      const account = await dbService.getInstagramAccount(post.userId, post.brandId)

      if (!isMock && account && account.status === 'CONNECTED') {
        // Real Meta API Publishing
        try {
          const campaign = await dbService.getCampaign(post.campaignId)
          if (!campaign) {
            throw new Error('Campaign data not found.')
          }

          const imageUrls = campaign.slides
            .sort((a, b) => a.slideNumber - b.slideNumber)
            .map(s => s.imageUrl)
            .filter((url): url is string => !!url)

          if (imageUrls.length === 0) {
            throw new Error('No valid slide images found for this campaign.')
          }

          const decryptedToken = tokenEncryptor.decrypt(account.accessTokenEncrypted)
          const accountId = account.instagramAccountId

          // Publish immediately
          const publishResult = await schedulePost(
            accountId,
            decryptedToken,
            imageUrls,
            `${post.caption}\n\n${post.hashtags}`,
            new Date() // Immediate publish trigger
          )

          if (!publishResult.success) {
            throw new Error(publishResult.error || 'Instagram API publishing failed')
          }

          await dbService.updatePostStatus(post.id, 'posted', publishResult.mediaId)
          await dbService.updateCampaignStatus(post.campaignId, 'posted')
          processedCount++
          results.push({ postId: post.id, campaignTitle: campaign.title, status: 'posted' })
        } catch (err: unknown) {
          failuresCount++
          const errorMsg = err instanceof Error ? err.message : 'Unknown publishing error'
          await dbService.updatePostStatus(post.id, 'failed')
          await dbService.updateCampaignStatus(post.campaignId, 'failed')
          results.push({ postId: post.id, campaignTitle: post.campaign.title, status: 'failed', error: errorMsg })
        }
      } else {
        // Simulated / Mock Publishing Mode
        try {
          const mockMediaId = `ig_media_${Math.floor(10000000 + Math.random() * 90000000)}`
          await dbService.updatePostStatus(post.id, 'posted', mockMediaId)
          await dbService.updateCampaignStatus(post.campaignId, 'posted')
          processedCount++
          results.push({ postId: post.id, campaignTitle: post.campaign.title, status: 'posted' })
        } catch (err: unknown) {
          failuresCount++
          const errorMsg = err instanceof Error ? err.message : 'Unknown database error'
          results.push({ postId: post.id, campaignTitle: post.campaign.title, status: 'failed', error: errorMsg })
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount,
      failuresCount,
      details: results
    })
  } catch (error: unknown) {
    console.error('Background cron publisher failed:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
