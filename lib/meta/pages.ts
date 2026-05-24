import type { InstagramLoginAccount } from './types'

const INSTAGRAM_GRAPH_URL = 'https://graph.instagram.com'

export async function fetchInstagramLoginAccount(userAccessToken: string): Promise<InstagramLoginAccount> {
  const url = new URL('/me', INSTAGRAM_GRAPH_URL)
  url.searchParams.set('fields', 'id,username,account_type,profile_picture_url')
  url.searchParams.set('access_token', userAccessToken)

  const response = await fetch(url)
  const data = await response.json() as {
    id?: string
    username?: string
    account_type?: string
    profile_picture_url?: string
    error?: { message?: string }
  }

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || `Instagram 계정 정보를 가져오는 데 실패했습니다. (HTTP ${response.status})`)
  }

  if (data.account_type === 'PERSONAL') {
    throw new Error('no_instagram_business_account')
  }

  return {
    instagramAccountId: data.id,
    username: data.username,
    profilePictureUrl: data.profile_picture_url,
    accountType: data.account_type,
  }
}
