const PARTICLES_REGEX = /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도|만|하고|이랑|랑|에게|한테|이며|고|며|면|서|니까)$/;

/**
 * 헤드라인 텍스트 내에서 강조할 어절/키워드를 지능적으로 검출하거나 분류하는 엔진입니다.
 */
export interface EmphasisToken {
  text: string
  isEmphasis: boolean
}

export function detectEmphasis(headline: string, userEmphasisWords?: string[]): EmphasisToken[] {
  const normalized = headline.trim().replace(/\s+/g, ' ')
  if (!normalized) return []

  const targetWords = userEmphasisWords?.length 
    ? userEmphasisWords 
    : extractDefaultEmphasisWords(normalized)

  const words = normalized.split(' ')
  return words.map(word => {
    // 순수 단어만 비교하기 위해 조사 제거 및 따옴표 제거 후 검증
    const cleanWord = word.replace(PARTICLES_REGEX, '').replace(/['"“”‘’]/g, '').trim()
    const hasMatch = targetWords.some(target => cleanWord.includes(target) || target.includes(cleanWord))
    
    // 따옴표로 묶인 어절은 무조건 강조
    const isQuoted = /^['"“‘].*['"”’]$/.test(word) || word.startsWith('“') || word.endsWith('”')

    return {
      text: word,
      isEmphasis: hasMatch || isQuoted,
    }
  })
}

/**
 * 제목 내부에서 강조할 최우선 순위 단어들을 추출합니다.
 * 1. 따옴표 내부 단어
 * 2. 숫자 및 백분율 기호
 * 3. 2글자 이상의 핵심 명사
 */
function extractDefaultEmphasisWords(text: string): string[] {
  // 1. 따옴표 매칭 추출
  const quoteMatch = text.match(/['"“‘]([^'"“”‘’]+)['"”’]/)
  if (quoteMatch && quoteMatch[1]) {
    return [quoteMatch[1]]
  }

  // 2. 백분율 및 숫자 검출
  const words = text
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2)

  const numericWords = words.filter(w => /[\d%]/.test(w) || w.endsWith('%') || w.includes('억') || w.includes('만') || w.includes('배'))
  if (numericWords.length) {
    return numericWords.slice(0, 2)
  }

  // 3. 조사를 뗀 단어 중 가장 긴 어절 우선
  const cleanWords = words
    .map(w => w.replace(PARTICLES_REGEX, ''))
    .filter(w => w.length >= 2)
    .sort((a, b) => b.length - a.length)

  return cleanWords.slice(0, 2)
}
