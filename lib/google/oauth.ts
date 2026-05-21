import { getAppBaseUrl, getGoogleClientId, getGoogleClientSecret } from '../env'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export interface GoogleUserInfo {
  sub: string
  email: string
  email_verified?: boolean
  name?: string
  picture?: string
}

export function hasGoogleOAuthConfig() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret())
}

export function getGoogleRedirectUri(request?: Request) {
  return `${getAppBaseUrl(request)}/api/auth/google/callback`
}

export function buildGoogleOAuthUrl(params: { request: Request; state: string }) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: getGoogleRedirectUri(params.request),
    response_type: 'code',
    scope: 'openid email profile',
    state: params.state,
    prompt: 'select_account',
  }).toString()
  return url
}

export async function exchangeGoogleCode(request: Request, code: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleRedirectUri(request),
      grant_type: 'authorization_code',
    }),
  })

  const data = await response.json().catch((): unknown => ({}))
  if (!response.ok) {
    throw new Error(readOAuthError(data, `Google token request failed with HTTP ${response.status}`))
  }

  return data as { access_token: string; id_token?: string; expires_in?: number; token_type?: string }
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json().catch((): unknown => ({}))
  if (!response.ok) {
    throw new Error(readOAuthError(data, `Google userinfo request failed with HTTP ${response.status}`))
  }

  const user = data as GoogleUserInfo
  if (!user.email) {
    throw new Error('Google account did not return an email address.')
  }
  if (user.email_verified === false) {
    throw new Error('Google email address is not verified.')
  }

  return user
}

function readOAuthError(data: unknown, fallback: string) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'error_description' in data &&
    typeof data.error_description === 'string'
  ) {
    return data.error_description
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    return data.error
  }
  return fallback
}
