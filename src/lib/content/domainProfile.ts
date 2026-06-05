import { getLLMClient, getTextGenerationModel } from '../ai/llmClient'

export type ContentDomain =
  | 'fashion'
  | 'food'
  | 'beauty'
  | 'living'
  | 'tech'
  | 'health'
  | 'news'
  | 'finance'
  | 'commerce'
  | 'education'
  | 'travel'
  | 'general'

export interface DomainProfile {
  domain: ContentDomain
  label: string
  searchAngles: string[]
  requiredCopyAnchors: string[]
  bannedCopyTerms: string[]
  cautionRules: string[]
  imageSubject: string
  imageScene: string
  imageExclusions: string[]
}

export interface DomainResolution {
  profile: DomainProfile
  method: 'rules' | 'ai' | 'fallback'
  confidence: number
  reason: string
  candidates: Array<{ domain: ContentDomain; score: number; reasons: string[] }>
}

const COMMON_BANNED = [
  '최고의',
  '무조건',
  '완벽한',
  '기적',
  '보장',
  '100%',
]

const PROFILES: Record<ContentDomain, DomainProfile> = {
  fashion: {
    domain: 'fashion',
    label: 'fashion and styling',
    searchAngles: ['silhouette', 'fit', 'material', 'graphic detail', 'layering', 'accessories', 'color palette', 'styling context'],
    requiredCopyAnchors: ['실루엣', '핏', '소재', '그래픽', '컬러', '레이어링', '액세서리', '신발', '코디', '착장'],
    bannedCopyTerms: ['섭취', '영양', '효능', '열량', '알레르기', '먹는 양', '보관법', '치료', '질병'],
    cautionRules: ['Do not describe food intake, nutrition, medical effects, or storage instructions unless the topic explicitly asks for them.'],
    imageSubject: 'visible fashion outfit, clothing silhouette, shoes, and accessories',
    imageScene: 'Korean streetwear or fashion editorial outfit scene with a visible model or mannequin, layered clothing, shoes, accessories, and natural city light',
    imageExclusions: ['empty room', 'generic interior still life', 'food', 'cosmetics-only scene', 'unrelated household objects'],
  },
  food: {
    domain: 'food',
    label: 'food and beverage',
    searchAngles: ['taste', 'texture', 'ingredient', 'serving context', 'storage', 'caution', 'comparison'],
    requiredCopyAnchors: ['맛', '식감', '향', '재료', '상황', '보관', '조합'],
    bannedCopyTerms: ['앱 기능', '워크플로우', '실루엣', '착장', '피부 개선', '질병 치료'],
    cautionRules: ['Nutrition and intake claims must be factual and modest. Do not imply disease treatment.'],
    imageSubject: 'real food or beverage with visible texture',
    imageScene: 'Korean table or cafe food scene showing the actual food texture, package or serving moment, with natural appetite-focused light',
    imageExclusions: ['fashion outfit', 'software interface', 'medical scene', 'empty office desk'],
  },
  beauty: {
    domain: 'beauty',
    label: 'beauty and skincare',
    searchAngles: ['skin concern', 'texture', 'ingredient', 'routine order', 'usage context', 'skin type'],
    requiredCopyAnchors: ['제형', '성분', '피부 타입', '사용 순서', '발림', '루틴'],
    bannedCopyTerms: ['질병 치료', '완치', '즉시 개선', '섭취량', '코디', '워크플로우'],
    cautionRules: ['Do not promise medical treatment or guaranteed skin improvement.'],
    imageSubject: 'beauty product texture, bottle, jar, or application moment',
    imageScene: 'Korean vanity, bathroom, or clean tabletop skincare scene showing product texture and realistic hand-use details',
    imageExclusions: ['food serving', 'street outfit as main subject', 'software interface', 'hospital scene'],
  },
  living: {
    domain: 'living',
    label: 'living and interior',
    searchAngles: ['room layout', 'storage', 'size', 'material', 'daily flow', 'before after'],
    requiredCopyAnchors: ['공간', '동선', '수납', '소재', '사이즈', '조명', '배치'],
    bannedCopyTerms: ['섭취', '효능', '피부 타입', '코디', '앱 기능'],
    cautionRules: ['Keep claims grounded in visible space usage, size, layout, material, or daily flow.'],
    imageSubject: 'room layout, furniture, storage, or home object in practical use',
    imageScene: 'Korean apartment interior scene showing furniture placement, storage details, room layout, and practical living flow',
    imageExclusions: ['food close-up', 'fashion model', 'software dashboard', 'medical clinic'],
  },
  tech: {
    domain: 'tech',
    label: 'tech and digital workflow',
    searchAngles: ['user problem', 'feature', 'workflow', 'integration', 'pricing', 'limitation', 'use case'],
    requiredCopyAnchors: ['문제', '기능', '워크플로우', '사용 장면', '한계', '도입 이유'],
    bannedCopyTerms: ['섭취', '맛', '식감', '피부 개선', '착장', '치료'],
    cautionRules: ['Do not invent market share, revenue, benchmark, or unsupported performance claims.'],
    imageSubject: 'device, app workflow, desk setup, or team using a digital tool',
    imageScene: 'Korean work desk or small team workflow scene with device, notes, and realistic digital work context, without readable UI text',
    imageExclusions: ['food plate', 'beauty product close-up', 'fashion outfit', 'medical treatment scene'],
  },
  health: {
    domain: 'health',
    label: 'health and wellness',
    searchAngles: ['routine', 'habit', 'caution', 'evidence', 'context', 'safe range'],
    requiredCopyAnchors: ['루틴', '습관', '주의점', '상황', '근거', '범위'],
    bannedCopyTerms: ['완치', '치료 보장', '즉시 효과', '무조건 낫는', '코디', '앱 기능'],
    cautionRules: ['Avoid disease-treatment claims. Present routines, cautions, and evidence boundaries.'],
    imageSubject: 'wellness routine, movement, supplement package, or calm daily health habit',
    imageScene: 'Korean home or studio wellness routine scene with natural daylight, movement cues, practical habit objects, and calm realism',
    imageExclusions: ['hospital diagnosis', 'before-after body transformation', 'fashion editorial', 'food-only close-up unless topic asks'],
  },
  news: {
    domain: 'news',
    label: 'news and trend',
    searchAngles: ['what happened', 'who is affected', 'why now', 'context', 'confirmed source', 'impact'],
    requiredCopyAnchors: ['무슨 일', '배경', '영향', '핵심 쟁점', '확인된 내용'],
    bannedCopyTerms: ['치료 효과', '섭취량', '완성된 룩', '피부 개선', '검증 없는 수치'],
    cautionRules: ['Use only confirmed facts. Do not infer personal identity, motive, or unsupported causality.'],
    imageSubject: 'symbolic news context, public space, documents, or device showing non-readable information flow',
    imageScene: 'Korean newsroom, office, public street, or document context that symbolizes the issue without readable text or identifiable private people',
    imageExclusions: ['fake celebrity portrait', 'readable newspaper headline', 'medical claim imagery', 'food glamour shot'],
  },
  finance: {
    domain: 'finance',
    label: 'finance and market analysis',
    searchAngles: ['confirmed data', 'period', 'market driver', 'risk factor', 'indicator', 'company disclosure', 'policy context'],
    requiredCopyAnchors: ['지표', '기간', '변동 요인', '리스크', '시장 반응', '확인할 데이터', '출처'],
    bannedCopyTerms: ['매수하세요', '팔아야 합니다', '확실히 오릅니다', '수익 보장', '안전한 투자', '급등 확정', '저점 매수', '고점 매도', '추천 종목', '무조건 수익'],
    cautionRules: [
      'Do not provide personalized investment advice or buy/sell recommendations.',
      'Do not predict guaranteed price direction, returns, lows, highs, or timing.',
      'Use only confirmed figures from source context and frame them as market explanation, not investment instruction.',
    ],
    imageSubject: 'financial documents, abstract chart shapes, calculator, laptop, or market data context without readable numbers',
    imageScene: 'Korean financial desk or newsroom analysis scene with non-readable chart-like shapes, documents, calculator, and restrained market-report atmosphere',
    imageExclusions: ['luxury lifestyle implying profit', 'readable stock ticker advice', 'fake trading screen with exact numbers', 'cash pile', 'celebratory investment scene'],
  },
  commerce: {
    domain: 'commerce',
    label: 'commerce and product',
    searchAngles: ['use case', 'differentiator', 'price fit', 'purchase trigger', 'comparison', 'limitation'],
    requiredCopyAnchors: ['사용 장면', '차별점', '구매 이유', '비교 기준', '가격감'],
    bannedCopyTerms: ['치료 보장', '섭취량', '검증 없는 1위', '완벽한 효과'],
    cautionRules: ['Do not invent discounts, rankings, reviews, or certification claims.'],
    imageSubject: 'actual product or believable product-use moment',
    imageScene: 'Korean product editorial scene showing the product in a concrete use moment, with material detail and purchase-relevant context',
    imageExclusions: ['empty aesthetic room', 'unrelated food', 'unrelated fashion outfit', 'software dashboard unless product is digital'],
  },
  education: {
    domain: 'education',
    label: 'education and learning',
    searchAngles: ['learner problem', 'level', 'method', 'practice', 'outcome boundary', 'next step'],
    requiredCopyAnchors: ['학습 단계', '방법', '연습', '수준', '다음 행동'],
    bannedCopyTerms: ['무조건 합격', '성적 보장', '섭취량', '피부 개선', '착장'],
    cautionRules: ['Do not guarantee scores, jobs, admissions, or certification outcomes.'],
    imageSubject: 'study desk, learning material, class moment, or focused practice scene',
    imageScene: 'Korean study desk or small class scene with notebooks, device, and focused learning traces, without readable private text',
    imageExclusions: ['food close-up', 'fashion model', 'beauty product', 'medical treatment'],
  },
  travel: {
    domain: 'travel',
    label: 'travel and local place',
    searchAngles: ['place mood', 'route', 'time', 'cost', 'reservation', 'nearby context'],
    requiredCopyAnchors: ['장소', '동선', '시간대', '예약', '분위기', '주변'],
    bannedCopyTerms: ['섭취량', '피부 개선', '앱 기능', '치료 효과'],
    cautionRules: ['Do not invent opening hours, prices, or reservation rules without source context.'],
    imageSubject: 'place, route, local street, hotel, cafe, or travel moment',
    imageScene: 'Korean local travel or place scene with route cues, natural weather, human-scale details, and a clear sense of destination',
    imageExclusions: ['generic office desk', 'medical clinic', 'software dashboard', 'unrelated product shelf'],
  },
  general: {
    domain: 'general',
    label: 'general information',
    searchAngles: ['definition', 'context', 'use case', 'comparison', 'caution', 'next step'],
    requiredCopyAnchors: ['정의', '상황', '비교', '주의점', '다음 행동'],
    bannedCopyTerms: [],
    cautionRules: ['Stay inside the user topic and do not borrow claims from unrelated domains.'],
    imageSubject: 'one tangible daily-life cue connected to the topic',
    imageScene: 'realistic Korean daily-life setting with one clear subject, a human usage trace, and natural available light',
    imageExclusions: ['unrelated food', 'unrelated product', 'random decorative object'],
  },
}

export function inferContentDomain(...values: Array<string | undefined | null>): ContentDomain {
  return scoreDomainCandidates({ topic: values.filter(Boolean).join(' ') }).domain
}

export function getDomainProfile(domain: ContentDomain): DomainProfile {
  return PROFILES[domain] || PROFILES.general
}

export function getDomainProfileForText(...values: Array<string | undefined | null>): DomainProfile {
  return getDomainProfile(inferContentDomain(...values))
}

export function getGenerationDomainProfile(params: {
  topic?: string | null
  category?: string | null
  brandIndustry?: string | null
  contentType?: string | null
  generationMode?: 'brand' | 'general' | null
}): DomainProfile {
  return getDomainProfile(resolveDomainByRules(params).profile.domain)
}

type DomainSignalConfig = {
  domain: Exclude<ContentDomain, 'general'>
  strong: string[]
  context: string[]
  negative?: string[]
}

const DOMAIN_SIGNAL_CONFIGS: DomainSignalConfig[] = [
  {
    domain: 'news',
    strong: ['current-affairs', '뉴스', '속보', '이슈', '선관위', '투표', '개표', '선거', '국정조사', '국조', '특검', '정치', '정책', '정부', '국회', '대통령', '장관', '사회', '사건', '사고', '논란', '쟁점', '여론', '재난', '법원', '검찰', '경찰', '판결', 'news', 'issue', 'breaking', 'policy', 'election', 'vote', 'politics', 'public issue'],
    context: ['배경', '영향', '발표', '조사', '브리핑', '의혹', '입장', '대응', '책임', '공방', '규제', '제도', '행정', '유권자', '공공', '후속', '현장', '확인된 내용'],
    negative: ['구매', '할인', '제품 후기', '제형', '성분', '레시피', '코디', '착장'],
  },
  {
    domain: 'finance',
    strong: ['금융', '투자', '주식', '증시', '시장', '경제', '금리', '환율', '코인', '가상자산', '비트코인', '부동산', '실적', '매출', '영업이익', '경제지표', '물가', '인플레이션', 'finance', 'stock', 'market', 'crypto', 'bitcoin', 'earnings', 'inflation'],
    context: ['지표', '기간', '변동', '리스크', '공시', '정책', '수익률', '가격', '거래량', '전망', '경기', '소비자물가', '환차익'],
    negative: ['피부', '제형', '레시피', '착장', '숙소'],
  },
  {
    domain: 'tech',
    strong: ['테크', 'AI', '인공지능', '앱', '소프트웨어', 'SaaS', '자동화', '플랫폼', '개발자', '알고리즘', '데이터', '클라우드', '보안', '스타트업', '챗GPT', 'tech', 'app', 'software', 'workflow'],
    context: ['디지털', '툴', '워크플로우', '기기', '노트북', '생산성', '업데이트', '기능', '연동', 'API', '서비스', '대시보드', '사용자 경험'],
    negative: ['투표', '선거', '국회', '정치', '식감', '피부 타입', '착장'],
  },
  {
    domain: 'beauty',
    strong: ['뷰티', '화장품', '스킨케어', '세럼', '크림', '토너', '앰플', '선크림', '립', '메이크업', '클렌저', '로션', '바디워시', '향수', 'beauty', 'skincare', 'cosmetic'],
    context: ['피부', '제형', '성분', '발림', '사용감', '루틴', '보습', '진정', '결', '톤', '향', '텍스처'],
    negative: ['섭취', '맛', '주가', '투표', '선거', '코디'],
  },
  {
    domain: 'food',
    strong: ['푸드', '식품', '음식', '간식', '맛집', '레시피', '커피', '카페', '디저트', '빵', '쿠키', '그래놀라', '호두', '아몬드', '견과', '식당', '메뉴', 'food', 'recipe', 'snack', 'coffee'],
    context: ['맛', '식감', '향', '재료', '조합', '보관', '섭취', '영양', '원재료', '칼로리', '단맛', '고소함'],
    negative: ['피부 개선', '투표', '선거', '앱 기능', '착장'],
  },
  {
    domain: 'health',
    strong: ['건강', '웰니스', '운동', '다이어트', '영양', '수면', '헬스', '보충제', '효능', '질환', '병원', '의료', 'health', 'wellness', 'fitness', 'nutrition'],
    context: ['루틴', '습관', '주의점', '근거', '범위', '섭취', '증상', '예방', '관리', '회복', '컨디션', '생활습관'],
    negative: ['패션', '코디', '주가', '투표', '앱 UI'],
  },
  {
    domain: 'fashion',
    strong: ['패션', '의류', '옷', '코디', '착장', '룩북', '스트릿', '실루엣', '레이어링', '액세서리', '스니커즈', '신발', '팬츠', '데님', '셔츠', '후디', 'fashion', 'lookbook', 'outfit', 'wear', 'shirt', 'hoodie', 'denim', 'sneakers'],
    context: ['핏', '소재', '컬러', '그래픽', '스타일링', '계절감', '무드', '사이즈', '매치', '룩'],
    negative: ['섭취', '영양', '치료', '주가', '투표'],
  },
  {
    domain: 'living',
    strong: ['리빙', '인테리어', '가구', '수납', '공간', '원룸', '조명', '침실', '주방', '욕실', '생활용품', '정리', 'living', 'interior', 'furniture', 'storage', 'home'],
    context: ['동선', '배치', '소재', '사이즈', '집', '공간감', '청소', '살림', '수납력', '분위기'],
    negative: ['섭취', '피부', '주식', '투표', '코디'],
  },
  {
    domain: 'education',
    strong: ['교육', '공부', '학습', '강의', '수업', '입시', '자격증', '커리어', '시험', '학생', '학교', 'education', 'study', 'course', 'learning'],
    context: ['학습 단계', '방법', '연습', '수준', '개념', '문제풀이', '커리큘럼', '스킬', '성장', '훈련'],
    negative: ['구매 후기', '피부', '식감', '주가', '투표'],
  },
  {
    domain: 'travel',
    strong: ['여행', '숙소', '호텔', '로컬', '장소', '코스', '데이트', '항공', '관광', '휴가', '맛집 투어', 'travel', 'hotel', 'trip', 'local'],
    context: ['동선', '시간대', '예약', '분위기', '주변', '교통', '체크인', '경로', '명소', '방문'],
    negative: ['주식', '피부 타입', '투표', '앱 기능'],
  },
  {
    domain: 'commerce',
    strong: ['제품', '출시', '브랜드', '커머스', '스토어', '구매', '할인', '상세페이지', '리뷰', '추천템', '신상품', '패키지', 'product', 'brand', 'store', 'commerce', 'review'],
    context: ['사용 장면', '차별점', '구매 이유', '비교 기준', '가격감', '배송', '교환', '반품', '쿠폰', '판매처'],
    negative: ['국정조사', '특검', '투표', '선거', '질병 치료'],
  },
]

const SIGNAL_WEIGHT = {
  strong: 5,
  context: 2,
  negative: -4,
} as const

const FIELD_WEIGHT = {
  topic: 1,
  category: 0.35,
  brandIndustry: 0.45,
} as const

const GENERAL_MODE_PROFILE_BOOSTS: Record<string, Partial<Record<ContentDomain, { score: number; reason: string }>>> = {
  'current-affairs': {
    news: { score: 6, reason: 'general current-affairs mode' },
  },
  information: {
    general: { score: 1.5, reason: 'general information mode' },
  },
  trends: {
    news: { score: 1.5, reason: 'general trends mode' },
  },
}

const MIN_RULE_SCORE = 6
const MIN_RULE_GAP = 4
const MIN_RULE_RATIO = 1.45

function matchKeyword(text: string, keyword: string) {
  const normalizedText = text.toLowerCase()
  const normalizedKeyword = keyword.toLowerCase()
  if (!normalizedKeyword.trim()) return false

  if (/^[a-z0-9+#.-]+(?:\s+[a-z0-9+#.-]+)*$/i.test(keyword)) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(normalizedText)
  }

  return normalizedText.includes(normalizedKeyword)
}

function getMatchedKeywords(text: string, keywords: string[]) {
  return keywords.filter(keyword => matchKeyword(text, keyword))
}

function getProfileCategory(...values: Array<string | undefined | null>) {
  const text = values.filter(Boolean).join(' ')
  if (/\bcurrent-affairs\b/i.test(text)) return 'current-affairs'
  if (/\binformation\b/i.test(text)) return 'information'
  if (/\btrends\b/i.test(text)) return 'trends'
  return null
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100
}

function hasTopicStrongSignal(candidate?: { reasons: string[] }) {
  return Boolean(candidate?.reasons.some(reason => reason.startsWith('topic strong:')))
}

function hasOnlyProfileSignals(candidate?: { reasons: string[] }) {
  if (!candidate?.reasons.length) return false
  return candidate.reasons.every(reason =>
    reason.startsWith('category strong:') ||
    reason.startsWith('category context:') ||
    reason.startsWith('brandIndustry strong:') ||
    reason.startsWith('brandIndustry context:') ||
    reason.includes('mode')
  )
}

function shouldTrustRuleCandidate(params: {
  top?: { domain: ContentDomain; score: number; reasons: string[] }
  second?: { domain: ContentDomain; score: number; reasons: string[] }
  generationMode?: 'brand' | 'general' | null
}) {
  const { top, second } = params
  if (!top || top.domain === 'general') return false

  const secondScore = second?.score || 0
  const gap = top.score - secondScore
  const ratio = secondScore > 0 ? top.score / secondScore : Number.POSITIVE_INFINITY
  const hasTopicSignal = hasTopicStrongSignal(top)

  if (top.score < MIN_RULE_SCORE) return false
  if (hasOnlyProfileSignals(top) && top.score < 10) return false

  const decisiveLead = gap >= MIN_RULE_GAP && ratio >= MIN_RULE_RATIO
  const uncontestedTopicSignal = hasTopicSignal && secondScore === 0 && top.score >= 5
  const currentAffairsNews = params.generationMode === 'general'
    && top.domain === 'news'
    && top.reasons.some(reason => reason.includes('current-affairs'))
    && gap >= 3

  return decisiveLead || uncontestedTopicSignal || currentAffairsNews
}

function scoreDomainCandidates(params: {
  topic?: string | null
  category?: string | null
  brandIndustry?: string | null
  generationMode?: 'brand' | 'general' | null
}) {
  const scoreMap = new Map<ContentDomain, { score: number; reasons: string[] }>()
  const fields = [
    { name: 'topic' as const, text: String(params.topic || ''), weight: FIELD_WEIGHT.topic },
    { name: 'category' as const, text: String(params.category || ''), weight: FIELD_WEIGHT.category },
    { name: 'brandIndustry' as const, text: String(params.brandIndustry || ''), weight: FIELD_WEIGHT.brandIndustry },
  ].filter(field => field.text.trim())

  const addScore = (domain: ContentDomain, score: number, reason: string) => {
    const current = scoreMap.get(domain) || { score: 0, reasons: [] }
    current.score += score
    current.reasons.push(reason)
    scoreMap.set(domain, current)
  }

  for (const config of DOMAIN_SIGNAL_CONFIGS) {
    for (const field of fields) {
      const strong = getMatchedKeywords(field.text, config.strong)
      if (strong.length) {
        const score = Math.min(strong.length * SIGNAL_WEIGHT.strong, 12) * field.weight
        addScore(config.domain, score, `${field.name} strong: ${strong.slice(0, 6).join(', ')}`)
      }

      const context = getMatchedKeywords(field.text, config.context)
      if (context.length) {
        const score = Math.min(context.length * SIGNAL_WEIGHT.context, 6) * field.weight
        addScore(config.domain, score, `${field.name} context: ${context.slice(0, 6).join(', ')}`)
      }

      const negative = getMatchedKeywords(field.text, config.negative || [])
      if (negative.length) {
        const score = Math.max(negative.length * SIGNAL_WEIGHT.negative, -8) * field.weight
        addScore(config.domain, score, `${field.name} negative: ${negative.slice(0, 6).join(', ')}`)
      }
    }
  }

  if (params.generationMode === 'general') {
    const profileCategory = getProfileCategory(params.category, params.brandIndustry)
    const boosts = profileCategory ? GENERAL_MODE_PROFILE_BOOSTS[profileCategory] : null
    if (boosts) {
      for (const [domain, boost] of Object.entries(boosts) as Array<[ContentDomain, { score: number; reason: string } | undefined]>) {
        if (!boost) continue
        addScore(domain, boost.score, boost.reason)
      }
    }
  }

  const candidates = ([...scoreMap.entries()] as Array<[ContentDomain, { score: number; reasons: string[] }]>)
    .map(([domain, data]) => ({ domain, score: roundScore(data.score), reasons: data.reasons }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)

  const top = candidates[0] || { domain: 'general' as ContentDomain, score: 0, reasons: ['no strong domain keyword'] }
  return { domain: top.domain, candidates }
}

export function resolveDomainByRules(params: {
  topic?: string | null
  category?: string | null
  brandIndustry?: string | null
  contentType?: string | null
  generationMode?: 'brand' | 'general' | null
}): DomainResolution {
  const scored = scoreDomainCandidates(params)
  const [top, second] = scored.candidates
  const score = top?.score || 0
  const gap = score - (second?.score || 0)
  const ratio = second?.score ? roundScore(score / second.score) : null
  const confident = shouldTrustRuleCandidate({
    top,
    second,
    generationMode: params.generationMode,
  })
  const domain = top?.domain || 'general'

  return {
    profile: getDomainProfile(confident ? domain : 'general'),
    method: confident ? 'rules' : 'fallback',
    confidence: confident
      ? Math.min(0.95, 0.58 + Math.min(score, 12) * 0.025 + Math.min(gap, 10) * 0.03)
      : Math.max(0.2, Math.min(0.62, score * 0.05)),
    reason: confident
      ? `rule match: ${(top?.reasons || []).join(', ')}`
      : `low-confidence rule match${top ? `: ${top.domain} score ${score}, gap ${roundScore(gap)}, ratio ${ratio || 'none'}` : ''}`,
    candidates: scored.candidates.slice(0, 4),
  }
}

export async function resolveGenerationDomainProfile(params: {
  topic?: string | null
  category?: string | null
  brandIndustry?: string | null
  contentType?: string | null
  generationMode?: 'brand' | 'general' | null
  userId?: string
  brandId?: string
}): Promise<DomainResolution> {
  const ruleResolution = resolveDomainByRules(params)
  if (ruleResolution.method === 'rules' && ruleResolution.confidence >= 0.72) {
    return ruleResolution
  }

  const client = getLLMClient()
  const allowedDomains: ContentDomain[] = [
    'fashion',
    'food',
    'beauty',
    'living',
    'tech',
    'health',
    'news',
    'finance',
    'commerce',
    'education',
    'travel',
    'general',
  ]
  const fallback = () => ({
    domain: ruleResolution.candidates[0]?.domain || ruleResolution.profile.domain,
    confidence: ruleResolution.confidence,
    reason: ruleResolution.reason,
    method: 'fallback' as const,
  })

  const result = await client.generateJson<{ domain?: ContentDomain; confidence?: number; reason?: string; method?: 'fallback' }>(
    'domain profile classification',
    [
      'Classify the content domain for a Korean Instagram carousel.',
      'Choose exactly one domain from this list:',
      allowedDomains.join(', '),
      '',
      `generationMode: ${params.generationMode || 'brand'}`,
      `topic: ${params.topic || ''}`,
      `category/profile: ${params.category || ''}`,
      `brandIndustry/profileIndustry: ${params.brandIndustry || ''}`,
      `contentType/context only: ${params.contentType || ''}`,
      `ruleCandidates: ${JSON.stringify(ruleResolution.candidates)}`,
      '',
      'Important:',
      '- current-affairs means news/public issues, not tech.',
      '- Do not classify as tech only because a word contains the letters "ai".',
      '- For politics, elections, government, public incidents, controversy, or policy, prefer news unless the topic is truly about software/AI/tools.',
      '- Return JSON only: {"domain":"news","confidence":0.92,"reason":"..."}',
    ].join('\n'),
    fallback,
    {
      model: getTextGenerationModel(),
      temperature: 0,
      systemPrompt: 'You classify content domains for a carousel generation pipeline. Return compact valid JSON only.',
      diagnostics: {
        userId: params.userId,
        brandId: params.brandId,
        metadata: {
          generationMode: params.generationMode,
          topic: params.topic,
          ruleMethod: ruleResolution.method,
          ruleConfidence: ruleResolution.confidence,
        },
      },
    }
  )

  const domain = result.domain && allowedDomains.includes(result.domain) ? result.domain : fallback().domain
  return {
    profile: getDomainProfile(domain),
    method: result.method === 'fallback'
      ? 'fallback'
      : (result.domain && allowedDomains.includes(result.domain) ? 'ai' : ruleResolution.method),
    confidence: typeof result.confidence === 'number'
      ? Math.max(0, Math.min(1, result.confidence))
      : ruleResolution.confidence,
    reason: result.reason || ruleResolution.reason,
    candidates: ruleResolution.candidates,
  }
}

export function getDomainBannedTerms(domain: ContentDomain): string[] {
  return [...COMMON_BANNED, ...getDomainProfile(domain).bannedCopyTerms]
}

export function formatDomainCopyGuidance(profile: DomainProfile): string {
  return [
    `[DOMAIN GUIDANCE: ${profile.label}]`,
    `Required copy anchors: ${profile.requiredCopyAnchors.join(', ')}`,
    `Search/content angles: ${profile.searchAngles.join(', ')}`,
    `Do not use unrelated terms: ${getDomainBannedTerms(profile.domain).join(', ')}`,
    ...profile.cautionRules,
  ].join('\n')
}

export function formatDomainVisualGuidance(profile: DomainProfile): string {
  return [
    `DOMAIN VISUAL MODE: ${profile.label}.`,
    `The generated image must center on ${profile.imageSubject}.`,
    `Use this scene family: ${profile.imageScene}.`,
    `Avoid: ${profile.imageExclusions.join(', ')}.`,
  ].join(' ')
}
