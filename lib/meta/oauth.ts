import { getAppBaseUrl, getMetaAppId, getMetaAppSecret } from '../env'
import type { MetaTokenResponse } from './types'

const INSTAGRAM_AUTH_URL = 'https://www.instagram.com'
const INSTAGRAM_API_URL = 'https://api.instagram.com'
const INSTAGRAM_GRAPH_URL = 'https://graph.instagram.com'

export const META_INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
]

export function hasMetaOAuthConfig() {
  return Boolean(getMetaAppId() && getMetaAppSecret())
}

export function getMetaRedirectUri(request: Request) {
  return `${getAppBaseUrl(request)}/api/auth/meta/callback`
}

export function buildMetaOAuthUrl(params: { request: Request; state: string }) {
  const url = new URL('/oauth/authorize', INSTAGRAM_AUTH_URL)
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('redirect_uri', getMetaRedirectUri(params.request))
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', META_INSTAGRAM_SCOPES.join(','))
  url.searchParams.set('response_type', 'code')
  return url
}

export async function exchangeCodeForShortLivedToken(request: Request, code: string): Promise<MetaTokenResponse> {
  const url = new URL('/oauth/access_token', INSTAGRAM_API_URL)

  const body = new URLSearchParams({
    client_id: getMetaAppId(),
    client_secret: getMetaAppSecret(),
    grant_type: 'authorization_code',
    redirect_uri: getMetaRedirectUri(request),
    code,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await response.json() as Partial<MetaTokenResponse> & { error_message?: string }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_message || `Instagram 토큰 교환 실패 (HTTP ${response.status})`)
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
  const url = new URL('/access_token', INSTAGRAM_GRAPH_URL)
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('client_secret', getMetaAppSecret())
  url.searchParams.set('access_token', shortLivedToken)

  const response = await fetch(url)
  const data = await response.json() as Partial<MetaTokenResponse> & { error?: { message?: string } }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message || `Instagram 장기 토큰 교환 실패 (HTTP ${response.status})`)
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}
