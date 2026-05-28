export function isLikelyDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Can't reach database server") ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('P1001')
  )
}

export function isLikelyAiConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('OPENAI_API_KEY') ||
    message.includes('API Key is missing') ||
    message.includes('not configured') ||
    message.includes('Incorrect API key') ||
    message.includes('invalid_api_key')
  )
}

export function getDatabaseMode() {
  if (process.env.DATABASE_MOCK_FALLBACK === 'true') return 'mock'
  if (process.env.DATABASE_URL) return 'postgres'
  return 'mock'
}

export function getGoogleOAuthSetupHint() {
  return [
    'GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 .env에 설정하세요.',
    'Google Cloud Console의 OAuth Client > Authorized redirect URIs에 http://localhost:3000/api/auth/google/callback을 추가하세요.',
    '환경변수를 바꾼 뒤 Next.js dev 서버를 재시작하세요.',
  ].join(' ')
}

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim())
}

export function getPayPalConfigStatus() {
  const missing = [
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'NEXT_PUBLIC_PAYPAL_CLIENT_ID',
    'NEXT_PUBLIC_PAYPAL_PLAN_LITE',
    'NEXT_PUBLIC_PAYPAL_PLAN_PRO',
    'NEXT_PUBLIC_PAYPAL_PLAN_UNLIMITED',
  ].filter(name => !hasEnv(name))

  return {
    ready: missing.length === 0,
    missing,
  }
}

export function getTossConfigStatus() {
  const missing = ['NEXT_PUBLIC_TOSS_CLIENT_KEY', 'TOSS_SECRET_KEY'].filter(name => !hasEnv(name))

  return {
    ready: missing.length === 0,
    missing,
  }
}

export function formatMissingConfigMessage(provider: string, missing: string[]) {
  return `${provider} 설정이 완료되지 않았습니다. 누락된 환경변수: ${missing.join(', ')}`
}

export function getUserFacingGenerationError(error: unknown) {
  if (isLikelyDatabaseConnectionError(error)) {
    return '생성 결과를 저장할 데이터베이스에 연결할 수 없습니다. DATABASE_URL과 서버 재시작 상태를 확인하세요.'
  }
  if (isLikelyAiConfigurationError(error)) {
    return 'AI 생성 설정이 완료되지 않았습니다. OPENAI_API_KEY 또는 이미지 공급자 설정을 확인하세요.'
  }

  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('fetch failed') || message.includes('ETIMEDOUT')) {
    return '외부 AI 또는 이미지 서비스 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
  }

  return '카드뉴스 생성 중 오류가 발생했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.'
}
