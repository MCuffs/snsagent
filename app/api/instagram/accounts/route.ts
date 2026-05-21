import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { tokenEncryptor } from '../../../../lib/instagram/client'
import { fetchInstagramBusinessAccounts } from '../../../../lib/meta/pages'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const brands = await dbService.getBrands(user.id)
    const account = brands[0]
      ? await dbService.getInstagramAccount(user.id, brands[0].id)
      : null

    if (!account?.accessTokenEncrypted) {
      return NextResponse.json({ accounts: [] })
    }

    const accessToken = tokenEncryptor.decrypt(account.accessTokenEncrypted)
    const accounts = await fetchInstagramBusinessAccounts(accessToken)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Failed to fetch Instagram accounts:', error)
    return NextResponse.json({ error: 'Instagram 계정 목록을 가져오지 못했습니다.' }, { status: 500 })
  }
}
