import { getAppBaseUrl, getMetaApiVersion, getMetaAppId, getMetaAppSecret } from '../env'
import type { MetaTokenResponse } from './types'

const META_AUTH_BASE_URL = 'https://www.facebook.com'
const META_GRAPH_BASE_URL = 'https://graph.facebook.com'

export const META_INSTAGRAM_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
]

export function hasMetaOAuthConfig() {
  return Boolean(getMetaAppId() && getMetaAppSecret())
}

export function getMetaRedirectUri(request: Request) {
  return `${getAppBaseUrl(request)}/api/auth/meta/callback`
}

export function buildMetaOAuthUrl(params: {
  request: Request
  state: string
}) {
  const url = new URL(`/${getMetaApiVersion()}/dialog/oauth`, META_AUTH_BASE_URL)
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('redirect_uri', getMetaRedirectUri(params.request))
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', META_INSTAGRAM_SCOPES.join(','))
  url.searchParams.set('response_type', 'code')
  return url
}

export async function exchangeCodeForShortLivedToken(request: Request, code: string) {
  const url = new URL(`/${getMetaApiVersion()}/oauth/access_token`, META_GRAPH_BASE_URL)
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('client_secret', getMetaAppSecret())
  url.searchParams.set('redirect_uri', getMetaRedirectUri(request))
  url.searchParams.set('code', code)

  return fetchMetaToken(url)
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const url = new URL(`/${getMetaApiVersion()}/oauth/access_token`, META_GRAPH_BASE_URL)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', getMetaAppId())
  url.searchParams.set('client_secret', getMetaAppSecret())
  url.searchParams.set('fb_exchange_token', shortLivedToken)

  return fetchMetaToken(url)
}

async function fetchMetaToken(url: URL): Promise<MetaTokenResponse> {
  const response = await fetch(url)
  const data = await response.json() as Partial<MetaTokenResponse> & { error?: { message?: string } }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message || `Meta token request failed with HTTP ${response.status}`)
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  }
}
