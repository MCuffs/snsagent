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

    const brands = await dbService.getBrands(user.id)
    if (!brands.find(b => b.id === brandId)) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const allCampaigns = await dbService.getCampaigns(user.id)
    const filtered = allCampaigns.filter(c => c.brandId === brandId)

    const result = await Promise.all(
      filtered.map(async (campaign) => {
        const [full, post] = await Promise.all([
          dbService.getCampaign(campaign.id),
          dbService.getPostByCampaign(user.id, campaign.id),
        ])
        const slides = full?.slides || []
        const firstImage = slides
          .sort((a, b) => a.slideNumber - b.slideNumber)[0]
          ?.imageUrl || null

        return {
          id: campaign.id,
          title: campaign.title,
          status: campaign.status,
          createdAt: campaign.createdAt instanceof Date
            ? campaign.createdAt.toISOString()
            : campaign.createdAt,
          thumbnail: firstImage,
          slideCount: slides.length || campaign.slideCount || 0,
          caption: post?.caption || '',
          hashtags: post?.hashtags || '',
        }
      })
    )

    return NextResponse.json({ campaigns: result })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
