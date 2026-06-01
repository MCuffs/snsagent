export interface SemanticSlideInput {
  slideNumber: number
  role: string
  headline: string
  body: string
}

export interface SemanticIssue {
  slideNumber: number
  severity: 'block' | 'warn'
  message: string
}

export interface SemanticCopyReport {
  passed: boolean
  issues: SemanticIssue[]
}

const STOPWORDS = new Set([
  '카드뉴스', '카드', '뉴스', '대한', '대해', '관련', '정보', '만들어주세요', '만들어줘',
  '그리고', '하지만', '그래서', '이것', '저것', '오늘', '요즘', '다시', '정말', '그냥',
])

const ABSTRACT_FILLERS = [
  '특별한 가치',
  '더 나은 선택',
  '새로운 경험',
  '중요한 순간',
  '좋은 방법',
  '핵심입니다',
]

const OPEN_EXPECTATION_PATTERNS = [
  /이유는[, ]?[^.!?。！？]*$/u,
  /핵심은[, ]?[^.!?。！？]*$/u,
  /문제는[, ]?[^.!?。！？]*$/u,
  /결국[, ]?[^.!?。！？]*$/u,
  /왜냐하면[, ]?[^.!?。！？]*$/u,
  /보다\s+더\s*$/u,
]

export function evaluateSemanticCopy(params: {
  topic: string
  slides: SemanticSlideInput[]
}): SemanticCopyReport {
  const topicTokens = extractMeaningTokens(params.topic)
  const issues: SemanticIssue[] = []

  for (const slide of params.slides) {
    const combined = `${slide.headline} ${slide.body}`.trim()
    const bodyTokens = extractMeaningTokens(slide.body)
    const hasTopicAnchor = topicTokens.length === 0 || topicTokens.some(token => combined.includes(token))

    if (slide.body.trim().length < 24 || bodyTokens.length < 3) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 슬라이드 하나의 의미를 만들 만큼 충분한 정보를 담고 있지 않습니다.',
      })
    }

    if (!hasTopicAnchor && !['summary', 'save-cta', 'cta'].includes(slide.role)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 사용자의 핵심 주제와 의미적으로 연결되지 않습니다.',
      })
    }

    if (OPEN_EXPECTATION_PATTERNS.some(pattern => pattern.test(slide.body.trim()))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 긴장이나 질문을 열어두고 해석 또는 결론을 제공하지 않습니다.',
      })
    }

    if (ABSTRACT_FILLERS.some(phrase => combined.includes(phrase)) && bodyTokens.length < 6) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'warn',
        message: '본문이 추상적인 표현에 기대고 구체적인 관찰이나 의미 전개가 부족합니다.',
      })
    }
  }

  return {
    passed: !issues.some(issue => issue.severity === 'block'),
    issues,
  }
}

export function buildSemanticFallback(params: {
  topic: string
  role: string
  headline: string
}) {
  const topic = params.topic.replace(/\s+/g, ' ').trim() || params.headline
  switch (params.role) {
    case 'hook':
      return `${topic}은 단순한 정보보다 생활 속 선택과 연결될 때 더 오래 기억됩니다. 지금 필요한 관점부터 짚어보세요.`
    case 'context':
    case 'problem':
      return `${topic}을 이야기할 때 중요한 건 유행보다 실제 생활에서 반복되는 상황입니다. 왜 관심이 커지는지 맥락부터 살펴봐야 합니다.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${topic}의 핵심은 한 가지 장점만 보는 것이 아니라, 일상에서 어떻게 쓰이고 어떤 기준으로 선택할지 함께 보는 데 있습니다.`
    case 'summary':
    case 'save-cta':
    case 'cta':
      return `${topic}을 다시 볼 때는 핵심 기준을 저장해두고 자신의 생활에 맞는 방식으로 적용해보세요.`
    default:
      return `${topic}은 독자가 바로 이해할 수 있는 구체적인 맥락과 함께 전달될 때 더 설득력 있게 다가옵니다.`
  }
}

function extractMeaningTokens(value: string) {
  return Array.from(new Set(
    value
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 1 && !STOPWORDS.has(token))
  )).slice(0, 12)
}
