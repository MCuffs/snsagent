import OpenAI from 'openai'
import {
  getOpenAIBaseURLHost,
  getOpenAIKeyFingerprint,
  logAiDiagnostic,
  normalizeModelName,
  readOpenAIError,
} from './diagnostics'

export interface LLMClient {
  generateJson<T>(stepName: string, prompt: string, fallback: () => T, options?: LLMRequestOptions): Promise<T>
}

export interface LLMRequestOptions {
  model?: string
  temperature?: number
  systemPrompt?: string
  diagnostics?: {
    userId?: string
    campaignId?: string
    brandId?: string
    metadata?: Record<string, unknown>
  }
}

export const DEFAULT_TEXT_MODEL = 'gpt-5.5'

export class MockLLMClient implements LLMClient {
  async generateJson<T>(stepName: string, _prompt: string, fallback: () => T): Promise<T> {
    logAiDiagnostic({
      status: 'fallback',
      stepName,
      provider: 'mock',
      model: 'mock',
    })
    return fallback()
  }
}

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI

  constructor() {
    const baseURL = process.env.OPENAI_BASE_URL || undefined
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(baseURL ? { baseURL } : {}) })
  }

  async generateJson<T>(stepName: string, prompt: string, fallback: () => T, options?: LLMRequestOptions): Promise<T> {
    const model = options?.model || getTextGenerationModel()
    const baseURL = getOpenAIBaseURLHost()
    const keyFingerprint = getOpenAIKeyFingerprint()
    logAiDiagnostic({
      status: 'start',
      stepName,
      provider: 'openai',
      model,
      baseURL,
      keyFingerprint,
      userId: options?.diagnostics?.userId,
      campaignId: options?.diagnostics?.campaignId,
      brandId: options?.diagnostics?.brandId,
      metadata: options?.diagnostics?.metadata,
    })

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: options?.systemPrompt ||
              '당신은 한국 인스타그램 카드뉴스 전문 카피라이터입니다. 요청된 JSON 형식으로만 응답하세요. 응답은 반드시 유효한 JSON이어야 합니다.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        ...(supportsCustomTemperature(model) ? { temperature: options?.temperature ?? 0.7 } : {}),
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.warn(`[LLMClient] ${stepName}: empty response, using fallback`)
        logAiDiagnostic({
          status: 'fallback',
          stepName,
          provider: 'openai',
          model,
          baseURL,
          keyFingerprint,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          errorMessage: 'empty response',
          userId: options?.diagnostics?.userId,
          campaignId: options?.diagnostics?.campaignId,
          brandId: options?.diagnostics?.brandId,
          metadata: options?.diagnostics?.metadata,
        })
        return fallback()
      }

      logAiDiagnostic({
        status: 'success',
        stepName,
        provider: 'openai',
        model,
        baseURL,
        keyFingerprint,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        userId: options?.diagnostics?.userId,
        campaignId: options?.diagnostics?.campaignId,
        brandId: options?.diagnostics?.brandId,
        metadata: options?.diagnostics?.metadata,
      })
      return JSON.parse(content) as T
    } catch (error) {
      console.warn(`[LLMClient] ${stepName} failed, using fallback`, error)
      logAiDiagnostic({
        status: 'failure',
        stepName,
        provider: 'openai',
        model,
        baseURL,
        keyFingerprint,
        userId: options?.diagnostics?.userId,
        campaignId: options?.diagnostics?.campaignId,
        brandId: options?.diagnostics?.brandId,
        metadata: options?.diagnostics?.metadata,
        ...readOpenAIError(error),
      })
      return fallback()
    }
  }
}

export function getLLMClient(): LLMClient {
  const key = process.env.OPENAI_API_KEY
  if (key && key.length > 10 && key !== 'your-openai-api-key-here') {
    return new OpenAILLMClient()
  }
  return new MockLLMClient()
}

export function getCopywritingModel() {
  return normalizeModelName(process.env.OPENAI_COPY_MODEL, getTextGenerationModel())
}

export function getTextGenerationModel() {
  return normalizeModelName(process.env.OPENAI_TEXT_MODEL, DEFAULT_TEXT_MODEL)
}

function supportsCustomTemperature(model: string) {
  return !/^(gpt-5|o\d)/.test(model)
}

export async function withJsonRetry<T>(
  stepName: string,
  operation: () => Promise<T>,
  retryCount = 1
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.warn(`[CarouselPipeline] ${stepName} failed on attempt ${attempt + 1}`, error)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${stepName} failed`)
}
