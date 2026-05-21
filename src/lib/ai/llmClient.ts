export interface LLMClient {
  generateJson<T>(stepName: string, prompt: string, fallback: () => T): Promise<T>
}

export class MockLLMClient implements LLMClient {
  async generateJson<T>(_stepName: string, _prompt: string, fallback: () => T): Promise<T> {
    return fallback()
  }
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
