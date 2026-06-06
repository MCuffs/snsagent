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

    const account = await dbService.getInstagramAccount(user.id, brandId)

    if (!account) {
      return NextResponse.json({ account: null })
    }

    return NextResponse.json({
      account: {
        id: account.id,
        instagramAccountId: account.instagramAccountId,
        username: account.username,
        status: account.status,
        profilePictureUrl: account.profilePictureUrl,
      },
    })
  } catch (error) {
    console.error('Error fetching Instagram account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    await dbService.disconnectInstagramAccount(user.id, brandId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting Instagram account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
