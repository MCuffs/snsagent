import { createHash } from 'crypto'
import prisma from '../../../lib/db'

type AiDiagnosticStatus = 'start' | 'success' | 'failure' | 'fallback'

interface AiDiagnosticEvent {
  status: AiDiagnosticStatus
  stepName: string
  provider: 'openai' | 'mock'
  userId?: string
  campaignId?: string
  brandId?: string
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
  metadata?: Record<string, unknown>
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
  void persistAiDiagnostic(event)
}

async function persistAiDiagnostic(event: AiDiagnosticEvent) {
  try {
    await prisma.aiGenerationLog.create({
      data: {
        userId: event.userId ?? null,
        campaignId: event.campaignId ?? null,
        brandId: event.brandId ?? null,
        stepName: event.stepName,
        provider: event.provider,
        status: event.status,
        model: event.model ?? null,
        baseURL: event.baseURL ?? null,
        keyFingerprint: event.keyFingerprint ?? null,
        promptTokens: event.promptTokens ?? null,
        completionTokens: event.completionTokens ?? null,
        totalTokens: event.totalTokens ?? null,
        errorStatus: event.errorStatus ?? null,
        errorCode: event.errorCode ?? null,
        errorType: event.errorType ?? null,
        errorMessage: event.errorMessage ?? null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/AiGenerationLog|does not exist|Unknown model|table/i.test(message)) {
      console.warn('[AI_DIAGNOSTIC] Failed to persist diagnostic event', error)
    }
  }
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
