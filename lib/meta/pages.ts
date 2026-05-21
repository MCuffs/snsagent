import { getMetaApiVersion } from '../env'
import type { InstagramOAuthAccount, MetaPage } from './types'

const META_GRAPH_BASE_URL = 'https://graph.facebook.com'

interface MetaPagesResponse {
  data?: MetaPage[]
  error?: {
    message?: string
  }
}

export async function fetchInstagramBusinessAccounts(userAccessToken: string): Promise<InstagramOAuthAccount[]> {
  const url = new URL(`/${getMetaApiVersion()}/me/accounts`, META_GRAPH_BASE_URL)
  url.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username,profile_picture_url}'
  )
  url.searchParams.set('access_token', userAccessToken)

  const response = await fetch(url)
  const data = await response.json() as MetaPagesResponse

  if (!response.ok) {
    throw new Error(data.error?.message || `Meta page request failed with HTTP ${response.status}`)
  }

  return (data.data || [])
    .filter(page => page.instagram_business_account?.id && page.access_token)
    .map(page => ({
      facebookPageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      instagramAccountId: page.instagram_business_account!.id,
      username: page.instagram_business_account?.username,
      profilePictureUrl: page.instagram_business_account?.profile_picture_url,
    }))
}

export function getFirstInstagramBusinessAccount(accounts: InstagramOAuthAccount[]) {
  return accounts[0] || null
}
