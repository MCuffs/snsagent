import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    }

    const posts = await dbService.getPosts(user.id)
    const filtered = posts.filter(p => p.brandId === brandId)

    const result = await Promise.all(
      filtered.map(async (post) => {
        const campaign = await dbService.getCampaign(post.campaignId)
        return {
          id: post.id,
          campaignId: post.campaignId,
          campaign: { title: campaign?.title || 'Unknown' },
          caption: post.caption,
          hashtags: post.hashtags,
          scheduledAt: post.scheduledAt instanceof Date
            ? post.scheduledAt.toISOString()
            : post.scheduledAt,
          status: post.status,
        }
      })
    )

    return NextResponse.json({
      posts: result.sort((a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      ),
    })
  } catch (error) {
    console.error('Error fetching scheduled posts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
