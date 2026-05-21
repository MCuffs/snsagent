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

export function getTokenEncryptionSecret() {
  const secret = readEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY') || readEnv('AUTH_SECRET')

  if (secret && secret !== 'replace-with-a-long-random-secret') {
    return secret
  }

  if (isProduction()) {
    throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY must be set to a strong secret in production.')
  }

  return 'instaagent-local-development-token-key'
}

export function isConfiguredOpenAIKey(apiKey: string | undefined) {
  if (!apiKey) return false
  const normalized = apiKey.trim()
  return normalized.length > 0 && normalized !== 'your-openai-api-key-here'
}
