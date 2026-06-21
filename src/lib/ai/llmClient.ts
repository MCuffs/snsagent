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
export const DEFAULT_QWEN_MODEL = 'qwen3-235b-a22b'  // Qwen3 Max

// ── Mock client (no API key configured) ──────────────────────────

export class MockLLMClient implements LLMClient {
  async generateJson<T>(stepName: string, _prompt: string, fallback: () => T): Promise<T> {
    logAiDiagnostic({ status: 'fallback', stepName, provider: 'mock', model: 'mock' })
    return fallback()
  }
}

// ── GPT client (quality-critical: strategy, agent chat, web research) ─

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
      status: 'start', stepName, provider: 'openai', model, baseURL, keyFingerprint,
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
        logAiDiagnostic({
          status: 'fallback', stepName, provider: 'openai', model, baseURL, keyFingerprint,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          errorMessage: 'empty response',
          userId: options?.diagnostics?.userId,
          brandId: options?.diagnostics?.brandId,
        })
        return fallback()
      }

      logAiDiagnostic({
        status: 'success', stepName, provider: 'openai', model, baseURL, keyFingerprint,
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
      logAiDiagnostic({
        status: 'failure', stepName, provider: 'openai', model, baseURL, keyFingerprint,
        userId: options?.diagnostics?.userId,
        brandId: options?.diagnostics?.brandId,
        metadata: options?.diagnostics?.metadata,
        ...readOpenAIError(error),
      })
      return fallback()
    }
  }
}

// ── Qwen client (high-volume: copy, caption, classification) ─────

/**
 * Alibaba Cloud MaaS Qwen3 — OpenAI-compatible endpoint.
 * Used for: slide copy generation, caption, domain classification, brand intelligence.
 * Falls back to GPT automatically on failure or if not configured.
 */
export class QwenLLMClient implements LLMClient {
  private client: OpenAI
  private baseURL: string
  private keyPrefix: string

  constructor() {
    const apiKey = process.env.QWEN_API_KEY ?? ''
    this.baseURL = process.env.QWEN_BASE_URL ?? ''
    this.keyPrefix = apiKey.slice(0, 8)
    this.client = new OpenAI({ apiKey, baseURL: this.baseURL })
  }

  async generateJson<T>(stepName: string, prompt: string, fallback: () => T, options?: LLMRequestOptions): Promise<T> {
    const model = options?.model || getQwenModel()
    logAiDiagnostic({
      status: 'start', stepName, provider: 'qwen' as never, model,
      baseURL: this.baseURL, keyFingerprint: this.keyPrefix + '...',
      userId: options?.diagnostics?.userId,
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
        // enable_thinking: false must be at root level (not extra_body) per Alibaba MaaS API
        ...({ enable_thinking: false } as object),
        temperature: options?.temperature ?? 0.7,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        logAiDiagnostic({
          status: 'fallback', stepName, provider: 'qwen' as never, model,
          baseURL: this.baseURL, errorMessage: 'empty response',
        })
        // Graceful fallback to GPT
        return new OpenAILLMClient().generateJson(stepName, prompt, fallback, options)
      }

      logAiDiagnostic({
        status: 'success', stepName, provider: 'qwen' as never, model,
        baseURL: this.baseURL, keyFingerprint: this.keyPrefix + '...',
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        userId: options?.diagnostics?.userId,
        brandId: options?.diagnostics?.brandId,
        metadata: options?.diagnostics?.metadata,
      })

      // Qwen3 may wrap output in <think>...</think> — strip before parsing
      const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      return JSON.parse(cleaned) as T
    } catch (error) {
      logAiDiagnostic({
        status: 'failure', stepName, provider: 'qwen' as never, model,
        baseURL: this.baseURL, ...readOpenAIError(error),
      })
      // Graceful fallback to GPT
      return new OpenAILLMClient().generateJson(stepName, prompt, fallback, options)
    }
  }
}

// ── Client factory functions ──────────────────────────────────────

/** GPT — strategy, agent chat, web research (quality-critical) */
export function getLLMClient(): LLMClient {
  const key = process.env.OPENAI_API_KEY
  if (key && key.length > 10 && key !== 'your-openai-api-key-here') {
    return new OpenAILLMClient()
  }
  return new MockLLMClient()
}

/**
 * Qwen — slide copy, caption, domain classification, brand intelligence.
 * Falls back to GPT if QWEN_API_KEY / QWEN_BASE_URL not configured.
 */
export function getLightClient(): LLMClient {
  const qwenKey = process.env.QWEN_API_KEY
  const qwenBase = process.env.QWEN_BASE_URL
  if (qwenKey && qwenKey.length > 10 && qwenBase) {
    return new QwenLLMClient()
  }
  return getLLMClient()  // fall back to GPT
}

// ── Model helpers ─────────────────────────────────────────────────

export function getCopywritingModel() {
  return normalizeModelName(process.env.OPENAI_COPY_MODEL, getTextGenerationModel())
}

export function getTextGenerationModel() {
  return normalizeModelName(process.env.OPENAI_TEXT_MODEL, DEFAULT_TEXT_MODEL)
}

export function getQwenModel() {
  return process.env.QWEN_MODEL || DEFAULT_QWEN_MODEL
}

// gpt-5 / o-series don't accept temperature; qwen models do
export function supportsCustomTemperature(model: string) {
  return !/^(gpt-5|o\d)/.test(model)
}

export function temperatureOption(model: string, temperature: number) {
  return supportsCustomTemperature(model) ? { temperature } : {}
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
