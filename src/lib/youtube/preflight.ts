/**
 * Request-time checks for the YouTube shorts production pipeline.
 *
 * Without these, a missing API key only surfaces minutes into production
 * (stock search silently returns nothing → "사용 가능한 영상 소스가 없습니다" at 30%,
 * TTS throws at 31%), so every retry burns an LLM planning call and fails again.
 */

export function hasStockVideoProviderKey() {
  return Boolean(process.env.PEXELS_API_KEY || process.env.PIXABAY_API_KEY)
}

export function hasTtsProviderKey() {
  const key = process.env.OPENAI_API_KEY
  return Boolean(key && key.length >= 10)
}

export function checkYouTubeProductionPreflight(): { ok: true } | { ok: false; error: string } {
  if (!hasStockVideoProviderKey()) {
    return {
      ok: false,
      error: '영상 소스 검색 API가 준비되지 않았습니다. 관리자에게 PEXELS_API_KEY(또는 PIXABAY_API_KEY) 환경 변수 설정을 요청해 주세요.',
    }
  }
  if (!hasTtsProviderKey() && process.env.NODE_ENV === 'production') {
    return {
      ok: false,
      error: 'TTS 음성 생성 API가 준비되지 않았습니다. 관리자에게 OPENAI_API_KEY 환경 변수 설정을 요청해 주세요.',
    }
  }
  return { ok: true }
}
