import OpenAI from 'openai'

export interface LLMClient {
  generateJson<T>(stepName: string, prompt: string, fallback: () => T): Promise<T>
}

export class MockLLMClient implements LLMClient {
  async generateJson<T>(_stepName: string, _prompt: string, fallback: () => T): Promise<T> {
    return fallback()
  }
}

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async generateJson<T>(stepName: string, prompt: string, fallback: () => T): Promise<T> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 한국 인스타그램 카드뉴스 전문 카피라이터입니다. 요청된 JSON 형식으로만 응답하세요. 응답은 반드시 유효한 JSON이어야 합니다.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.warn(`[LLMClient] ${stepName}: empty response, using fallback`)
        return fallback()
      }

      return JSON.parse(content) as T
    } catch (error) {
      console.warn(`[LLMClient] ${stepName} failed, using fallback`, error)
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
