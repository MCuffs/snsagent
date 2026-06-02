import { createHash } from 'crypto'

type AiDiagnosticStatus = 'start' | 'success' | 'failure' | 'fallback'

interface AiDiagnosticEvent {
  status: AiDiagnosticStatus
  stepName: string
  provider: 'openai' | 'mock'
  model?: string
  baseURL?: string
  keyFingerprint?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  errorStatus?: number
  errorCode?: string
  errorType?: string
  errorMessage?: string
}

export function normalizeModelName(value: string | undefined, fallback: string) {
  const cleaned = value
    ?.trim()
    .replace(/\\r|\\n/g, '')
    .trim()
  return cleaned || fallback
}

export function getOpenAIKeyFingerprint(apiKey = process.env.OPENAI_API_KEY) {
  const key = apiKey?.trim()
  if (!key || key === 'your-openai-api-key-here') return undefined
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

export function getOpenAIBaseURLHost(baseURL = process.env.OPENAI_BASE_URL) {
  if (!baseURL?.trim()) return 'api.openai.com'
  try {
    return new URL(baseURL).host
  } catch {
    return 'custom-invalid-url'
  }
}

export function logAiDiagnostic(event: AiDiagnosticEvent) {
  const safeEvent = {
    timestamp: new Date().toISOString(),
    ...event,
  }
  console.log(`[AI_DIAGNOSTIC] ${JSON.stringify(safeEvent)}`)
}

export function readOpenAIError(error: unknown) {
  const err = error as {
    status?: number
    code?: string
    type?: string
    message?: string
    error?: { code?: string; type?: string; message?: string }
  }
  return {
    errorStatus: err.status,
    errorCode: err.code || err.error?.code,
    errorType: err.type || err.error?.type,
    errorMessage: err.message || err.error?.message || String(error),
  }
}
