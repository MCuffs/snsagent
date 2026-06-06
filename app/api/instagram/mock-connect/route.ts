import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { isInstagramMockMode } from '../../../../lib/env'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isInstagramMockMode()) {
      return NextResponse.json({ error: 'Mock mode is not enabled' }, { status: 400 })
    }

    const { brandId } = await request.json()
    
    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    }

    // Verify brand ownership
    const brands = await dbService.getBrands(user.id)
    const brand = brands.find(b => b.id === brandId)
    
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Create mock Instagram account with username for display
    const mockAccountId = `mock_${Date.now()}`
    const mockUsername = brand.name.replace(/\s+/g, '_').toLowerCase().slice(0, 20)
    
    const mockAccount = await dbService.saveInstagramOAuthAccount(
      user.id,
      brandId,
      {
        instagramAccountId: mockAccountId,
        accessTokenEncrypted: 'mock_access_token',
        facebookPageId: '',
        pageAccessTokenEncrypted: '',
        tokenExpiresAt: null,
        username: mockUsername,
        profilePictureUrl: null,
        connectionMethod: 'oauth',
      }
    )

    return NextResponse.json({
      success: true,
      account: mockAccount,
    })
  } catch (error) {
    console.error('Mock connect error:', error)
    return NextResponse.json(
      { error: 'Failed to create mock connection' },
      { status: 500 }
    )
  }
}
