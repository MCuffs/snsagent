import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../actions'
import { dbService } from '../../../../../lib/db-service'
import { tokenEncryptor } from '../../../../../lib/instagram/client'
import { exchangeCodeForShortLivedToken, exchangeForLongLivedToken } from '../../../../../lib/meta/oauth'
import { fetchInstagramBusinessAccounts, getFirstInstagramBusinessAccount } from '../../../../../lib/meta/pages'

export const runtime = 'nodejs'

interface MetaOAuthState {
  nonce: string
  brandId: string
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const error = requestUrl.searchParams.get('error')
    if (error) {
      return NextResponse.redirect(new URL(`/instagram?error=${encodeURIComponent(error)}`, request.url))
    }

    const code = requestUrl.searchParams.get('code')
    const state = requestUrl.searchParams.get('state')
    if (!code || !state) {
      return NextResponse.redirect(new URL('/instagram?error=meta_callback_invalid', request.url))
    }

    const cookieStore = await cookies()
    const nonce = cookieStore.get('meta_oauth_nonce')?.value
    const parsedState = decodeState(state)
    if (!nonce || parsedState.nonce !== nonce) {
      return NextResponse.redirect(new URL('/instagram?error=meta_state_invalid', request.url))
    }
    cookieStore.delete('meta_oauth_nonce')

    const brand = await dbService.getBrand(parsedState.brandId)
    if (!brand || brand.userId !== user.id) {
      return NextResponse.redirect(new URL('/instagram?error=brand_forbidden', request.url))
    }

    const shortToken = await exchangeCodeForShortLivedToken(request, code)
    const longToken = await exchangeForLongLivedToken(shortToken.access_token)
    const accounts = await fetchInstagramBusinessAccounts(longToken.access_token)
    const selectedAccount = getFirstInstagramBusinessAccount(accounts)

    if (!selectedAccount) {
      return NextResponse.redirect(new URL('/instagram?error=no_instagram_business_account', request.url))
    }

    const expiresAt = longToken.expires_in
      ? new Date(Date.now() + longToken.expires_in * 1000)
      : null

    await dbService.saveInstagramOAuthAccount(user.id, brand.id, {
      instagramAccountId: selectedAccount.instagramAccountId,
      accessTokenEncrypted: tokenEncryptor.encrypt(longToken.access_token),
      facebookPageId: selectedAccount.facebookPageId,
      pageAccessTokenEncrypted: tokenEncryptor.encrypt(selectedAccount.pageAccessToken),
      tokenExpiresAt: expiresAt,
      username: selectedAccount.username,
      profilePictureUrl: selectedAccount.profilePictureUrl,
      connectionMethod: 'oauth',
    })

    return NextResponse.redirect(new URL('/instagram?connected=meta', request.url))
  } catch (error) {
    console.error('Meta OAuth callback failed:', error)
    return NextResponse.redirect(new URL('/instagram?error=meta_oauth_failed', request.url))
  }
}

function decodeState(value: string): MetaOAuthState {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as MetaOAuthState
}
