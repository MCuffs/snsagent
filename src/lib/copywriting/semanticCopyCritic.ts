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
  '효능', '효과', '섭취', '가이드', '올바른',
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
  '구체적인 사용 장면',
  '확인 포인트',
  '설득력이 살아납니다',
  '자료로 말할 땐',
  '효능 하나보다',
  '균형에 있습니다',
  '좋다는 말보다',
  '먹는 방식이 분명',
  '설명할 때는',
  '가이드는',
  '실천 기준',
  '상세 정보를 비교',
]

const OPEN_EXPECTATION_PATTERNS = [
  /이유는[, ]?[^.!?。！？]*$/u,
  /핵심은[, ]?[^.!?。！？]*$/u,
  /문제는[, ]?[^.!?。！？]*$/u,
  /결국[, ]?[^.!?。！？]*$/u,
  /따져보면[, ]?[^.!?。！？]*$/u,
  /보다\s*$/u,
]

const INCOMPLETE_MEANING_PATTERNS = [
  /(?:함께 있는|함께 봐야|대신 분명한|살피는|많이 먹는|한 번에|커지는지|이어지는지)[.!?。！？]?$/u,
  /(?:식물성 지방|불포화지방산|오메가 계열 지방)[^.!?。！？]{0,30}(?:함께 있는|함께 봐야)[.!?。！？]?$/u,
  /(?:아침 요거트|샐러드|오후 간식)[^.!?。！？]{0,30}$/u,
]

export function evaluateSemanticCopy(params: {
  topic: string
  slides: SemanticSlideInput[]
}): SemanticCopyReport {
  const topicTokens = extractMeaningTokens(params.topic)
  const issues: SemanticIssue[] = []
  const bodyCounts = new Map<string, number>()
  for (const slide of params.slides) {
    const normalizedBody = normalizeForComparison(slide.body)
    if (normalizedBody) bodyCounts.set(normalizedBody, (bodyCounts.get(normalizedBody) || 0) + 1)
  }

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

    if (INCOMPLETE_MEANING_PATTERNS.some(pattern => pattern.test(body))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 문장처럼 보이지만 실제 의미가 완성되지 않았습니다. 독자가 이해할 결론까지 다시 작성해야 합니다.',
      })
    }

    if (hasBrokenKoreanParticle(body) || hasBrokenKoreanParticle(slide.headline)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문에 "호두의의", "호두의를"처럼 잘못 결합된 조사가 있습니다. 주어를 자연스러운 명사로 바꿔 다시 작성해야 합니다.',
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

    const normalizedBody = normalizeForComparison(body)
    if (normalizedBody && (bodyCounts.get(normalizedBody) || 0) >= 2) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '다른 슬라이드와 본문이 중복됩니다. 각 슬라이드는 새 정보를 제공해야 합니다.',
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
        return `${subject}는 식물성 지방, 고소한 풍미, 씹는 식감을 함께 가진 견과입니다. 첫 장에서는 포만감과 간식 대체 효과가 어떤 식사 선택에 연결되는지 보여줍니다.`
      case 'context':
      case 'problem':
        return `${subject}는 아침 요거트, 샐러드 토핑, 오후 간식처럼 반복 가능한 장면에 넣기 좋습니다. 먹는 시간을 정해두면 달거나 자극적인 간식 대신 선택하기 쉽습니다.`
      case 'key-point':
      case 'detail':
      case 'stat':
        return `${subject}에는 불포화지방산과 식이섬유가 들어 있어 포만감을 주는 간식으로 활용할 수 있습니다. 다만 열량이 높은 편이라 한 번에 많이 먹기보다 소량을 정해두는 편이 좋습니다.`
      case 'summary':
      case 'save-cta':
      case 'cta':
        return `${subject}를 오래 챙기려면 하루 섭취량, 함께 곁들일 식사, 보관법을 함께 정리해야 합니다. 산패를 막도록 밀봉해두고 요거트나 샐러드에 소량씩 더하면 루틴으로 이어집니다.`
      default:
        return `${subject}는 맛과 식감, 먹기 좋은 시간대, 대신 줄이고 싶은 간식까지 함께 제시할 때 이해가 빨라집니다. 독자가 바로 따라 할 수 있도록 양과 보관법까지 넣어야 합니다.`
    }
  }

  switch (params.role) {
    case 'hook':
      return `${subject}는 좋은 제품이라는 말만으로 설득되지 않습니다. 첫 장에서는 누가 어떤 상황에서 필요로 하는지 보여줘 다음 카드의 판단 기준으로 연결해야 합니다.`
    case 'context':
    case 'problem':
      return `${subject}를 고민하는 사람은 보통 가격보다 사용 상황을 먼저 떠올립니다. 언제 쓰고, 무엇이 불편했고, 어떤 차이가 있으면 다시 찾게 되는지 구체적으로 보여줘야 합니다.`
    case 'key-point':
    case 'detail':
    case 'stat':
      return `${subject}의 설득 포인트는 눈에 보이는 디테일에서 나옵니다. 구성, 사용감, 관리 방식, 비교 기준 중 하나를 잡아 실제 판단에 도움이 되는 문장으로 풀어야 합니다.`
    case 'summary':
    case 'save-cta':
    case 'cta':
      return `${subject}를 다시 볼 때는 실제로 확인할 항목을 남겨두는 편이 좋습니다. 필요한 구성과 사용 상황을 떠올린 뒤 가격, 관리 방식, 구매 조건을 함께 비교해보세요.`
    default:
      return `${subject}는 한 줄 설명보다 실제 사용 상황이 있을 때 이해가 빨라집니다. 독자가 바로 떠올릴 수 있는 맥락과 판단 기준을 함께 제시하세요.`
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
  const normalized = topic.replace(/\s+/g, ' ').trim()
  const knownFood = normalized.match(/호두|아몬드|캐슈|피스타치오|견과|견과류|요거트|샐러드/u)
  if (knownFood?.[0]) return knownFood[0]

  const beforePossessive = normalized.match(/^([가-힣A-Za-z0-9]{2,})의\s*(?:효능|효과|장점|특징|섭취|활용|추천)/u)
  if (beforePossessive?.[1]) return beforePossessive[1]

  const cleaned = normalized
    .replace(/효능\s*과|효과\s*와|장점\s*과|특징\s*과/g, ' ')
    .replace(/추천|효능|효과|장점|특징|카드뉴스|콘텐츠|본문|소개|후킹|올바른|섭취|가이드|건강|균형|실천/g, ' ')
    .replace(/\b(?:과|와|및)\b/g, ' ')
    .replace(/의\s*(?:과|와)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const firstToken = cleaned.replace(/의$/u, '').trim().split(/\s+/)[0]
  return firstToken || normalized.replace(/의$/u, '').trim() || normalized
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

function hasBrokenKoreanParticle(value: string) {
  return /[가-힣]{2,}의\s*(?:의|은|는|이|가|을|를|과|와)\b/u.test(value)
}

function normalizeForComparison(value: string) {
  return value
    .replace(/[.!?。！？\s]/g, '')
    .trim()
}
