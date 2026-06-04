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

const DOMAIN_KEYWORDS: Array<{ domain: ContentDomain; pattern: RegExp }> = [
  { domain: 'fashion', pattern: /패션|의류|옷|코디|착장|룩북|스트릿|그래픽|실루엣|레이어링|액세서리|street|fashion|lookbook|outfit|wear|shirt|hoodie|pants|denim|sneakers|팬츠|데님|스니커즈|신발|비니|체인|무드/i },
  { domain: 'beauty', pattern: /뷰티|화장품|스킨케어|세럼|크림|토너|앰플|선크림|립|메이크업|피부|beauty|skincare|cosmetic/i },
  { domain: 'food', pattern: /푸드|식품|음식|간식|맛집|레시피|식감|맛|커피|카페|디저트|빵|쿠키|그래놀라|호두|아몬드|견과|food|recipe|snack|coffee/i },
  { domain: 'health', pattern: /건강|웰니스|운동|다이어트|영양|수면|루틴|헬스|보충제|효능|섭취|health|wellness|fitness|nutrition/i },
  { domain: 'living', pattern: /리빙|인테리어|가구|수납|공간|집|원룸|조명|침실|주방|욕실|living|interior|furniture|storage|home/i },
  { domain: 'tech', pattern: /테크|앱|ai|인공지능|툴|saas|소프트웨어|생산성|자동화|디지털|기기|노트북|tech|app|software|workflow/i },
  { domain: 'finance', pattern: /금융|투자|주식|증시|시장|경제|금리|환율|코인|가상자산|비트코인|부동산|실적|매출|영업이익|경제지표|물가|인플레이션|finance|stock|market|rate|exchange rate|crypto|bitcoin|earnings|inflation/i },
  { domain: 'news', pattern: /뉴스|이슈|속보|논란|정치|사회|사건|정책|트렌드|화제|커뮤니티|여론|news|issue|breaking|policy|trend/i },
  { domain: 'education', pattern: /교육|공부|학습|강의|수업|입시|자격증|커리어|education|study|course|learning/i },
  { domain: 'travel', pattern: /여행|숙소|호텔|로컬|장소|공간|코스|데이트|travel|hotel|trip|local/i },
  { domain: 'commerce', pattern: /제품|출시|브랜드|커머스|스토어|구매|할인|상세페이지|리뷰|추천템|product|brand|store|commerce|review/i },
]

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
  const text = values.filter(Boolean).join(' ').toLowerCase()
  for (const item of DOMAIN_KEYWORDS) {
    if (item.pattern.test(text)) return item.domain
  }
  return 'general'
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
}): DomainProfile {
  return getDomainProfileForText(
    params.topic,
    params.brandIndustry,
    params.category,
    params.contentType,
  )
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
