function readEnv(name: string) {
  return process.env[name]?.trim() || ''
}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function isTruthyEnv(name: string) {
  const value = readEnv(name).toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}

export function isInstagramMockMode() {
  return isTruthyEnv('INSTAGRAM_MOCK_MODE')
}

export function getInstagramAccountId() {
  return readEnv('INSTAGRAM_ACCOUNT_ID') || 'mock_account_id'
}

export function getInstagramAccessToken() {
  return readEnv('INSTAGRAM_ACCESS_TOKEN') || 'mock_access_token'
}

export function getMetaAppId() {
  return readEnv('META_APP_ID')
}

export function getMetaAppSecret() {
  return readEnv('META_APP_SECRET')
}

export function getMetaApiVersion() {
  return readEnv('META_API_VERSION') || 'v19.0'
}

export function getGoogleClientId() {
  return readEnv('GOOGLE_CLIENT_ID')
}

export function getGoogleClientSecret() {
  return readEnv('GOOGLE_CLIENT_SECRET')
}

export function getAppBaseUrl(request?: Request) {
  const configured = readEnv('NEXT_PUBLIC_APP_URL') || readEnv('APP_URL')
  if (configured) return configured.replace(/\/$/, '')
  if (request) return new URL(request.url).origin
  return 'http://localhost:3000'
}

export function getTokenEncryptionSecret() {
  const secret = readEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY') || readEnv('AUTH_SECRET')

  if (secret && secret !== 'replace-with-a-long-random-secret') {
    return secret
  }

  if (isProduction()) {
    throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY must be set to a strong secret in production.')
  }

  return 'shuffla-local-development-token-key'
}

export function isConfiguredOpenAIKey(apiKey: string | undefined) {
  if (!apiKey) return false
  const normalized = apiKey.trim()
  return normalized.length > 0 && normalized !== 'your-openai-api-key-here'
}

export function getGeminiApiKey() {
  return readEnv('GEMINI_API_KEY')
}

export function isConfiguredGeminiKey(apiKey: string | undefined) {
  if (!apiKey) return false
  const normalized = apiKey.trim()
  return normalized.length > 0 && normalized !== 'your-gemini-api-key-here'
}

export function getGroqApiKey() {
  return readEnv('GROQ_API_KEY')
}

export function isConfiguredGroqKey(apiKey: string | undefined) {
  if (!apiKey) return false
  const normalized = apiKey.trim()
  return normalized.length > 0 && normalized !== 'your-groq-api-key-here'
}

export function getPerplexityApiKey() {
  return readEnv('PERPLEXITY_API_KEY')
}

export function isConfiguredPerplexityKey(apiKey: string | undefined) {
  if (!apiKey) return false
  const normalized = apiKey.trim()
  return normalized.length > 0 && normalized !== 'your-perplexity-api-key-here'
}

export function getNaverClientId() {
  return readEnv('NAVER_CLIENT_ID')
}

export function getNaverClientSecret() {
  return readEnv('NAVER_CLIENT_SECRET')
}

export function isConfiguredNaverApi(clientId: string | undefined, clientSecret: string | undefined) {
  return !!(clientId && clientId.trim() && clientId !== 'your-naver-client-id-here'
    && clientSecret && clientSecret.trim() && clientSecret !== 'your-naver-client-secret-here')
}
