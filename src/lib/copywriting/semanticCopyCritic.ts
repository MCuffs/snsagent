import { getDomainBannedTerms, getDomainProfileForText, type DomainProfile } from '../content/domainProfile'

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
  '핵심 정보와 실천 기준',
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
  /(?:더|다시|먼저|쓸|봐야|한 줄|보여야|붙여야|이미|다음|신발 밑창|한|바|게|정하|같게|쉽게|시야|많은지|는지|고르고|준비|판단)[.!?。！？]?$/u,
  /다음\s*장/u,
  /(?:은|는|이|가|을|를|의|와|과|에서|부터|까지|처럼|보다|만|도|거나|이나|려면|하면|해야)[.!?。！？]$/u,
]

const META_COPY_TOKENS = [
  'daily use scene',
  'mirror audience life',
  'one defining object',
  'imagePurpose',
  'guiding question',
  'STORY ONTOLOGY',
  'visualDirection',
  'LAYOUT PRIORITY',
  'recognizable daily situation',
]

export function evaluateSemanticCopy(params: {
  topic: string
  slides: SemanticSlideInput[]
  language?: 'ko' | 'en'
  domainProfile?: DomainProfile
}): SemanticCopyReport {
  const language = params.language === 'en' ? 'en' : 'ko'
  const topicTokens = extractMeaningTokens(params.topic, language)
  const domainProfile = params.domainProfile ?? getDomainProfileForText(params.topic)
  const domainBannedTerms = getDomainBannedTerms(domainProfile.domain)
  const issues: SemanticIssue[] = []
  const bodyCounts = new Map<string, number>()
  for (const slide of params.slides) {
    const normalizedBody = normalizeForComparison(slide.body)
    if (normalizedBody) bodyCounts.set(normalizedBody, (bodyCounts.get(normalizedBody) || 0) + 1)
  }

  for (const slide of params.slides) {
    const combined = `${slide.headline} ${slide.body}`.trim()
    const body = slide.body.trim()
    const bodyTokens = extractMeaningTokens(body, language)
    const hasTopicAnchor = topicTokens.length === 0 || topicTokens.some(token => combined.includes(token))
    const isClosing = ['summary', 'save-cta', 'cta'].includes(slide.role)
    const minBodyLength = isClosing ? 28 : 30
    const domainBannedHits = domainBannedTerms.filter(term => term && combined.includes(term))

    if (domainBannedHits.length > 0) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: `copy uses terms outside the ${domainProfile.label} domain: ${domainBannedHits.join(', ')}`,
      })
    }

    if (!isClosing && !hasDomainAnchor(combined, domainProfile.requiredCopyAnchors)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'warn',
        message: `copy should include a concrete ${domainProfile.label} anchor such as ${domainProfile.requiredCopyAnchors.slice(0, 4).join(', ')}`,
      })
    }

    if (body.length < minBodyLength || bodyTokens.length < 3) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: `본문이 너무 짧습니다. ${isClosing ? '마무리 슬라이드도' : '각 슬라이드는'} 구체 기준이 담긴 완성 문장이어야 합니다.`,
      })
    }

    if (META_COPY_TOKENS.some(token => combined.includes(token)) || /[A-Za-z]{3,}\s*은\(는\)/.test(combined)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문에 내부 기획 토큰이나 영어 메타 표현이 노출되었습니다.',
      })
    }

    if (!hasTopicAnchor && !isClosing) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 사용자의 핵심 주제와 직접 연결되지 않았습니다.',
      })
    }

    if (language === 'ko' && OPEN_EXPECTATION_PATTERNS.some(pattern => pattern.test(body))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 열린 생각이나 비교어에서 멈췄고 결론을 제공하지 않습니다.',
      })
    }

    if (language === 'ko' && INCOMPLETE_MEANING_PATTERNS.some(pattern => pattern.test(body))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 문장처럼 보이지만 실제 의미가 완성되지 않았습니다. 독자가 이해할 결론까지 다시 작성해야 합니다.',
      })
    }

    if (language === 'ko' && hasIncompleteFinalSentence(body)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문 마지막 문장이 자연스러운 한국어 종결형으로 끝나지 않습니다.',
      })
    }

    if (language === 'ko' && (hasBrokenKoreanParticle(body) || hasBrokenKoreanParticle(slide.headline) || hasDanglingKoreanParticle(body) || hasDanglingKoreanParticle(slide.headline))) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문에 "호두의의", "호두의를"처럼 잘못 결합된 조사가 있습니다. 주어를 자연스러운 명사로 바꿔 다시 작성해야 합니다.',
      })
    }

    if (language === 'ko' && startsWithDanglingKoreanParticle(body)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '본문이 조사나 연결어로 시작해 앞 문맥이 잘린 상태입니다. 주어가 있는 완전한 문장으로 다시 작성해야 합니다.',
      })
    }

    if (language === 'ko' && hasOffTopicSensationalAngle(combined, params.topic)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: '사용자 주제와 무관한 뉴스/자극적 앵글이 카피에 섞였습니다. 주제의 실제 적용 포인트만 남겨야 합니다.',
      })
    }

    const genericHits = language === 'en'
      ? EN_GENERIC_FILLERS.filter(phrase => combined.toLowerCase().includes(phrase))
      : GENERIC_FILLERS.filter(phrase => combined.includes(phrase))
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

    if (language === 'en' && hasIncompleteEnglishEnding(body)) {
      issues.push({
        slideNumber: slide.slideNumber,
        severity: 'block',
        message: 'Body copy ends with an incomplete English thought and needs a clear takeaway.',
      })
    }

    if (hasRepeatedNouns(body, language)) {
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

const EN_STOPWORDS = new Set([
  'card', 'news', 'carousel', 'content', 'about', 'with', 'that', 'this', 'from', 'into',
  'your', 'their', 'there', 'what', 'when', 'where', 'which', 'more', 'most', 'good',
  'great', 'important', 'benefit', 'benefits', 'guide', 'tips',
])

const EN_GENERIC_FILLERS = [
  'specific use case',
  'clear checking point',
  'more convincing',
  'worth remembering',
  'better choice',
  'important standard',
  'everyday choice',
  'key point',
  'practical value',
]

function extractMeaningTokens(value: string, language: 'ko' | 'en' = 'ko') {
  const stopwords = language === 'en' ? EN_STOPWORDS : STOPWORDS
  return Array.from(new Set(
    value
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length > 1 && !stopwords.has(token.toLowerCase()))
  )).slice(0, 12)
}

function hasDomainAnchor(value: string, anchors: string[]) {
  if (anchors.length === 0) return true
  return anchors.some(anchor => value.includes(anchor))
}

function hasRepeatedNouns(body: string, language: 'ko' | 'en' = 'ko') {
  const tokens = extractMeaningTokens(body, language).filter(token => token.length >= 2)
  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return Array.from(counts.values()).some(count => count >= 3)
}

function hasIncompleteEnglishEnding(value: string) {
  const normalized = value.trim()
  if (!normalized) return true
  if (!/[.!?]$/.test(normalized)) return true
  return /\b(and|or|but|because|with|for|to|from|than|that|which|when|where|while|by)\W*$/i.test(normalized)
}

function hasBrokenKoreanParticle(value: string) {
  return /[가-힣]{2,}의\s*(?:의|은|는|이|가|을|를|과|와)\b/u.test(value) ||
    /[가-힣]{2,}의의/u.test(value) ||
    /[가-힣]{2,}(?:은|는|이|가|을|를)(?:은|는|이|가|을|를)\b/u.test(value) ||
    /[가-힣]{2,}(?:이나|거나|부터|까지|보다|처럼)[.!?。！？]$/u.test(value.trim())
}

function hasDanglingKoreanParticle(value: string) {
  const normalized = value.trim()
  return /(?:그런데|하지만|그리고|또한|그래서|반면|다만|SNS에서|온라인에서)\s+\d*\.?\s*(?:은|는|이|가|을|를|도|만)\b/u.test(normalized) ||
    /\b\d+\.\s*(?:은|는|이|가|을|를|도|만)\b/u.test(normalized) ||
    /(?:^|[.!?。！？]\s*)(?:은|는|이|가|을|를|도|만)\s+\S+/u.test(normalized)
}

function startsWithDanglingKoreanParticle(value: string) {
  return /^(?:에서|에게서|으로|로|을|를|은|는|이|가|와|과|도|만|부터|까지|보다|처럼|의|에|에게|께|한테)\b/u.test(value.trim())
}

function hasOffTopicSensationalAngle(value: string, topic: string) {
  const topicText = topic.toLowerCase()
  const copy = value.toLowerCase()
  const isDietTopic = /식단|다이어트|건강|혈당|영양|단백질|탄수화물|채소|식사|음식/.test(topicText)
  if (!isDietTopic) return false
  return /폭격|무기|미사일|전쟁|우주|매스\s*드라이버|mass\s*driver|공격|테러/.test(copy)
}

function hasIncompleteFinalSentence(value: string) {
  const normalized = value.trim()
  if (!/[.!?。！？]$/u.test(normalized)) return false
  return !/(?:다|요|죠|세요|십시오|니다|습니다|것|점|중|전|후|필요|추천|체크|확인)[.!?。！？]$/u.test(normalized)
}

function normalizeForComparison(value: string) {
  return value
    .replace(/[.!?。！？\s]/g, '')
    .trim()
}
