import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { publishPostToInstagram } from '../../../../lib/instagram/publish'
import { isInstagramMockMode } from '../../../../lib/env'
import { unauthorizedJson, verifyBearerSecret } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handleCron(request)
}

export async function POST(request: NextRequest) {
  return handleCron(request)
}

async function handleCron(request: NextRequest) {
  // 1. Cron Secret Verification — always required
  const systemSecret = process.env.CRON_SECRET
  if (!systemSecret) {
    console.error('[Cron] CRON_SECRET env var is not set — refusing to run')
    return NextResponse.json(
      { success: false, error: 'Cron secret not configured on this server.' },
      { status: 500 }
    )
  }

  if (!verifyBearerSecret(request.headers.get('authorization'), systemSecret)) {
    return unauthorizedJson('Unauthorized. Invalid secret key.')
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
        // Real Meta API Publishing using shared utility
        try {
          const campaign = await dbService.getCampaign(post.campaignId)
          if (!campaign) {
            throw new Error('Campaign data not found.')
          }

          const result = await publishPostToInstagram({
            postId: post.id,
            campaignId: post.campaignId,
            campaign,
            account,
            caption: post.caption,
            hashtags: post.hashtags,
          })

          if (result.success) {
            processedCount++
            results.push({ postId: post.id, campaignTitle: campaign.title, status: 'posted' })
          } else {
            failuresCount++
            results.push({ postId: post.id, campaignTitle: campaign.title, status: 'failed', error: result.error })
          }
        } catch (err: unknown) {
          failuresCount++
          const errorMsg = err instanceof Error ? err.message : 'Unknown publishing error'
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
