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
  '카드뉴스', '카드', '뉴스', '정보', '관련', '대한', '그리고', '하지만', '그래서',
  '오늘', '다시', '정말', '그냥', '확인', '추천', '필요', '중요',
])

const GENERIC_FILLERS = [
  '생활 속 선택',
  '실제 생활',
  '반복되는 상황',
  '선택 이유',
  '핵심 기준',
  '중요한 건',
  '기준이 필요',
  '오래 기억',
  '맥락부터',
  '관점부터',
  '적용해보세요',
  '확인할 기준',
]

const OPEN_EXPECTATION_PATTERNS = [
  /이유는[, ]?[^.!?。！？]*$/u,
  /핵심은[, ]?[^.!?。！？]*$/u,
  /문제는[, ]?[^.!?。！？]*$/u,
  /결국[, ]?[^.!?。！？]*$/u,
  /따져보면[, ]?[^.!?。！？]*$/u,
  /보다\s*$/u,
]

export function evaluateSemanticCopy(params: {
  topic: string
  slides: SemanticSlideInput[]
}): SemanticCopyReport {
  const topicTokens = extractMeaningTokens(params.topic)
  const issues: SemanticIssue[] = []

  for (const slide of params.slides) {
    const combined = `${slide.headline} ${slide.body}`.trim()
    const body = slide.body.trim()
    const bodyTokens = extractMeaningTokens(body)
    const hasTopicAnchor = topicTokens.length === 0 || topicTokens.some(token => combined.includes(token))
    const isClosing = ['summary', 'save-cta', 'cta'].includes(slide.role)
    const minBodyLength = isClosing ? 58 : 78

    if (body.length < minBodyLength || bodyTokens.length < 5) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: `본문이 너무 짧습니다. ${isClosing ? '마무리 슬라이드도' : '각 슬라이드는'} 구체 정보가 담긴 2문장 이상이어야 합니다.`,
      })
    }

    if (!hasTopicAnchor && !isClosing) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 사용자의 핵심 주제와 직접 연결되지 않았습니다.',
      })
    }

    if (OPEN_EXPECTATION_PATTERNS.some(pattern => pattern.test(body))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 열린 생각이나 비교어에서 멈췄고 결론을 제공하지 않습니다.',
      })
    }

    const genericHits = GENERIC_FILLERS.filter(phrase => combined.includes(phrase))
    if (genericHits.length >= 1) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: `본문이 추상적인 표현(${genericHits.join(', ')})에 기대고 있습니다. 주제의 성분, 쓰임, 상황, 판단 포인트를 구체화해야 합니다.`,
      })
    }

    if (hasRepeatedNouns(body)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'warn',
        message: '본문 안에서 같은 명사가 반복됩니다. 다음 문장은 새 정보로 전개해야 합니다.',
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
  const subject = extractSubject(topic)
  const category = inferTopicCategory(topic)

  if (category === 'food') {
    switch (params.role) {
      case 'hook':
        return `${subject}는 익숙한 간식처럼 보이지만, 고소한 맛과 함께 식물성 지방·식감·포만감을 한 번에 주는 재료입니다. 그냥 좋다는 말보다 언제 어떻게 먹기 좋은지가 더 설득력 있게 다가옵니다.`
      case 'context':
      case 'problem':
        return `${subject}를 고를 때는 효능 문구만 보기보다 매일 먹기 쉬운 형태인지 먼저 봐야 합니다. 손이 자주 가는 간식, 샐러드 토핑, 아침 식사처럼 실제 섭취 장면이 분명할수록 꾸준함이 생깁니다.`
      case 'key-point':
      case 'detail':
      case 'stat':
        return `${subject}의 장점은 한 가지 성분보다 균형에 있습니다. 불포화지방산이 풍부한 견과류라는 점에 더해 씹는 식감과 고소함이 있어, 달거나 자극적인 간식 대신 두기 좋습니다.`
      case 'summary':
      case 'save-cta':
      case 'cta':
        return `${subject}를 기억할 때는 효능 하나보다 먹는 순간을 같이 떠올리면 좋습니다. 언제, 얼마나, 어떤 식사와 함께 둘지 정해두면 구매 후에도 자연스럽게 이어집니다.`
      default:
        return `${subject}는 설명보다 사용 장면이 분명할 때 설득력이 커집니다. 어떤 맛과 식감인지, 언제 먹기 좋은지, 어떤 습관을 대신할 수 있는지까지 함께 보여주세요.`
    }
  }

  switch (params.role) {
    case 'hook':
      return `${subject}를 추천하려면 좋은 제품이라는 말만으로는 부족합니다. 첫 장에서는 누가 어떤 상황에서 필요로 하는지부터 짚어야 다음 카드의 정보가 더 잘 읽힙니다.`
    case 'context':
    case 'problem':
      return `${subject}를 고민하는 사람은 보통 가격보다 사용 상황을 먼저 떠올립니다. 언제 쓰고, 무엇이 불편했고, 어떤 차이가 있으면 다시 찾게 되는지 구체적으로 보여줘야 합니다.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${subject}의 설득 포인트는 추상적인 장점이 아니라 눈에 보이는 디테일에서 나옵니다. 구성, 사용감, 관리 방식, 비교 기준 중 하나를 잡아 실제 판단에 도움이 되는 문장으로 풀어야 합니다.`
    case 'summary':
    case 'save-cta':
    case 'cta':
      return `${subject}를 다시 볼 때는 마음에 드는 표현보다 실제로 확인할 항목을 남겨두는 편이 좋습니다. 필요한 구성과 사용 장면을 떠올린 뒤 상세 정보를 비교해보세요.`
    default:
      return `${subject}는 한 줄 설명보다 구체적인 장면이 있을 때 이해가 빨라집니다. 독자가 바로 떠올릴 수 있는 상황과 판단 포인트를 함께 제시하세요.`
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

function extractSubject(topic: string) {
  return topic
    .replace(/추천|효능|장점|카드뉴스|콘텐츠|본문|소개|후킹/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || topic
}

function inferTopicCategory(topic: string) {
  if (/호두|견과|아몬드|캐슈|피스타치오|식품|간식|영양|건강|샐러드|아침|먹/.test(topic)) {
    return 'food'
  }
  return 'general'
}

function hasRepeatedNouns(body: string) {
  const tokens = extractMeaningTokens(body).filter(token => token.length >= 2)
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return Array.from(counts.values()).some(count => count >= 3)
}
