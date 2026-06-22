import { getLLMClient, getLightClient, getTextGenerationModel, getQwenModel } from '../ai/llmClient'

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
  voiceRules: string[]
  headlineStyle: string[]
  bodyStyle: string[]
  ctaStyleHints: string[]
  exampleGoodCopy: Array<{ headline: string; body: string }>
  exampleBadCopy: Array<{ headline: string; body: string; reason: string }>
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
    voiceRules: [
      '착장과 스타일링 맥락을 구체적으로 묘사하고 감각적 형용사를 활용한다.',
      '"무조건 사야 해", "역대급 핏" 같은 과장형 문체를 피한다.',
      '트렌드 정보는 시즌·스타일링 맥락과 함께 제공해 독자가 바로 활용할 수 있게 한다.',
    ],
    headlineStyle: [
      '아이템명 + 스타일링 포인트를 결합한다.',
      '예: "오버핏 셔츠, 허리에서 완성되는 룩"',
      '막연한 "트렌디"보다 구체적인 아이템·핏·소재를 언급한다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 핏, 소재, 컬러, 레이어링 중 하나만 집중한다.',
      '"예쁜 옷" 대신 "루즈한 숄더라인이 어깨를 자연스럽게 커버"처럼 착용 효과를 구체화한다.',
      '코디 방법이나 계절 활용법을 실용적으로 제안한다.',
    ],
    ctaStyleHints: [
      '"저장해두고 코디할 때 참고해보세요"',
      '"이번 시즌 공략법 정리해뒀어요"',
      '"취향에 맞는 핏부터 확인해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '오버핏의 균형은 하의에서', body: '상체가 루즈할수록 하의는 슬림하게. 와이드 팬츠보다 테이퍼드나 스키니가 전체 비율을 잡아줍니다.' },
      { headline: '소재가 계절을 결정한다', body: '린넨은 여름, 울 혼방은 환절기. 같은 실루엣이라도 소재 선택으로 착용 시즌이 달라집니다.' },
    ],
    exampleBadCopy: [
      { headline: '무조건 사야 할 역대급 아이템', body: '입기만 해도 날씬해 보이고 누구에게나 완벽하게 어울립니다.', reason: '과장 표현, 검증 불가 효과 주장' },
    ],
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
    voiceRules: [
      '맛을 과장하기보다 식감, 향, 먹는 상황을 구체적으로 말한다.',
      '"무조건", "역대급", "인생템" 같은 과장형 바이럴 문체를 피한다.',
      '친근하지만 리뷰처럼 가볍게 흐르지 않고, 구매 판단에 도움이 되는 정보형 톤을 유지한다.',
    ],
    headlineStyle: [
      '짧은 감각어 + 구체적 상황을 결합한다.',
      '예: "아침에 먹기 편한 한 컵"',
      '질문형보다 판단 기준을 제시하는 문장을 우선한다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 맛, 식감, 보관, 조합 중 하나만 집중한다.',
      '추상적인 "좋아요" 대신 "덜 달고 고소한 마무리"처럼 감각을 구체화한다.',
      '건강/효능 표현은 "도움", "관리" 수준으로 낮추고 치료처럼 쓰지 않는다.',
    ],
    ctaStyleHints: [
      '"저장해두고 장볼 때 비교해보세요"',
      '"다음 구매 전에 원재료표를 한번 확인해보세요"',
      '"취향에 맞는 조합부터 골라보세요"',
    ],
    exampleGoodCopy: [
      { headline: '덜 달아서 오래 가는 맛', body: '첫맛은 고소하고 끝맛은 가볍습니다. 단맛이 오래 남지 않아 아침 대용이나 오후 간식으로 부담이 적습니다.' },
      { headline: '보관 기준부터 확인', body: '개봉 후에는 향과 식감이 빨리 달라질 수 있습니다. 먹는 속도에 맞춰 소용량을 고르는 편이 안전합니다.' },
    ],
    exampleBadCopy: [
      { headline: '무조건 사야 하는 간식', body: '먹기만 해도 건강해지고 다이어트에 바로 효과가 느껴집니다.', reason: '과장 표현과 검증되지 않은 건강/다이어트 효능 주장' },
    ],
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
    voiceRules: [
      '성분과 제형의 특성을 과학적으로 설명하되 의학적 효과를 단정하지 않는다.',
      '"기적", "즉시", "무조건 좋아진다" 같은 보장형 표현을 쓰지 않는다.',
      '피부 타입별 적합성과 사용 순서를 실용적으로 안내한다.',
    ],
    headlineStyle: [
      '피부 고민 + 솔루션 방향을 결합한다.',
      '예: "수분 부족한 피부, 토너부터 바꿨더니"',
      '성분명 + 역할을 명시하면 신뢰도가 높아진다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 성분, 제형, 사용 순서, 피부 타입 중 하나만 다룬다.',
      '"좋아요" 대신 "세라마이드가 피부 장벽을 강화해 수분 증발을 줄여줍니다"처럼 메커니즘을 설명한다.',
      '부작용 가능성이 있는 성분은 피부 타입 주의사항을 함께 언급한다.',
    ],
    ctaStyleHints: [
      '"피부 타입 먼저 확인하고 선택하세요"',
      '"성분표 순서대로 보는 법 저장해두세요"',
      '"이 루틴 순서 저장해두고 따라해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '나이아신아마이드, 농도가 핵심', body: '5% 이하에서는 미백, 그 이상에서는 자극이 생길 수 있습니다. 처음 쓴다면 2~3%부터 시작하는 게 안전합니다.' },
      { headline: '오일 클렌저, 사용 순서가 있다', body: '메이크업 위에 먼저 올려 마사지한 뒤 물로 유화시킵니다. 이 순서를 지켜야 모공 잔여물이 남지 않습니다.' },
    ],
    exampleBadCopy: [
      { headline: '3일 만에 피부가 달라진다', body: '이 세럼 하나로 모든 피부 트러블이 완치됩니다.', reason: '즉각 효과 보장과 의학적 치료 주장' },
    ],
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
    voiceRules: [
      '공간의 실용성과 동선 효율을 중심으로 설명한다.',
      '"감성적이다", "예쁘다"보다 "좁아 보이지 않는 이유", "동선이 줄어드는 배치"처럼 기능적 이유를 제시한다.',
      '사이즈와 소재 정보는 구체적 수치로 표현한다.',
    ],
    headlineStyle: [
      '공간 문제 + 해결 방향을 결합한다.',
      '예: "10평 원룸, 짐 느낌 없애는 배치법"',
      '비포·애프터 대비를 명시하면 효과적이다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 동선, 수납, 조명, 소재 중 하나만 다룬다.',
      '가구 배치는 cm 단위 기준이나 비율로 설명한다.',
      '실제로 적용할 수 있는 순서나 기준을 제시한다.',
    ],
    ctaStyleHints: [
      '"이 배치 기준 저장해두고 이사할 때 써보세요"',
      '"공간 타입별 정리법 모아뒀어요"',
      '"수납 고민되면 이것부터 확인하세요"',
    ],
    exampleGoodCopy: [
      { headline: '소파 위치가 공간을 결정한다', body: '벽에 붙이면 답답해 보이고, 10cm 띄우면 공간이 숨쉽니다. 조명 방향과 맞추면 더 넓어 보입니다.' },
      { headline: '수납 첫 번째 기준은 빈도', body: '매일 쓰는 것은 허리 높이, 가끔 쓰는 것은 위나 아래. 빈도로 위치를 정하면 동선이 반으로 줄어듭니다.' },
    ],
    exampleBadCopy: [
      { headline: '이 가구 하나로 집이 완벽해진다', body: '누구나 만족하고 모든 공간에 어울리는 인테리어 완성품입니다.', reason: '검증 불가 주장과 과장 표현' },
    ],
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
    voiceRules: [
      '기능 설명보다 실제 사용자 문제와 해결 장면을 중심으로 쓴다.',
      '기술 용어는 독자가 바로 이해할 수 있는 비유나 예시로 풀어낸다.',
      '"혁신적", "게임체인저" 같은 마케팅 용어보다 구체적 워크플로우 변화를 보여준다.',
    ],
    headlineStyle: [
      '해결되는 문제를 먼저 제시한다.',
      '예: "회의록 30분이 3분으로, AI 요약의 실제"',
      '기능명보다 사용자 이득을 중심에 둔다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 기능, 워크플로우, 한계, 비교 중 하나만 다룬다.',
      '실제 사용 시나리오를 1~2문장으로 구체화한다.',
      '한계나 조건도 솔직하게 언급하면 신뢰도가 올라간다.',
    ],
    ctaStyleHints: [
      '"이 워크플로우 저장해두고 내일 업무에 써보세요"',
      '"무료 플랜으로 먼저 테스트해보세요"',
      '"팀에 공유해서 같이 비교해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '회의 후 30분, 이제 없앨 수 있다', body: '녹음 파일을 올리면 요점·결정사항·할 일이 자동 정리됩니다. 회의 직후 팀에 바로 공유할 수 있습니다.' },
      { headline: 'AI 코드 리뷰, 어디까지 믿을 수 있나', body: '반복 패턴 오류는 잘 잡지만, 비즈니스 로직 오류는 아직 놓칩니다. 보조 도구로 활용하되 최종 판단은 개발자가 해야 합니다.' },
    ],
    exampleBadCopy: [
      { headline: '이 AI 툴 하나로 모든 업무가 해결된다', body: '사용만 해도 생산성이 10배 오르고 완벽한 결과물이 나옵니다.', reason: '검증 불가 수치와 과장 효과 주장' },
    ],
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
    voiceRules: [
      '루틴과 습관의 실천 방법을 구체적으로 제시하고 근거를 함께 언급한다.',
      '"무조건 건강해진다", "즉시 효과" 같은 보장형 표현을 쓰지 않는다.',
      '의학적 주장은 "연구에 따르면", "전문가 권장 범위" 수준으로 제한한다.',
    ],
    headlineStyle: [
      '건강 고민 상황 + 실천 가능한 기준을 결합한다.',
      '예: "수면 질이 낮다면, 먼저 확인할 3가지"',
      '극단적 변화보다 작은 실천 단위로 쓴다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 루틴, 주의점, 근거, 적용 범위 중 하나만 다룬다.',
      '수치는 출처가 있는 경우에만 쓰고, 없으면 "일반적으로", "전문가 권장"으로 대체한다.',
      '독자가 당장 실천할 수 있는 행동 단위로 끝맺는다.',
    ],
    ctaStyleHints: [
      '"이 루틴 저장해두고 내일부터 시작해보세요"',
      '"자신의 수면·운동 패턴과 비교해보세요"',
      '"주의사항 먼저 확인하고 적용하세요"',
    ],
    exampleGoodCopy: [
      { headline: '수면 전 30분이 수면 질을 바꾼다', body: '화면 빛 차단, 실온 18~20도, 일정한 취침 시간. 세 가지 중 하나만 바꿔도 수면 중 각성 횟수가 줄어드는 경향이 있습니다.' },
      { headline: '단백질, 얼마나 먹어야 충분한가', body: '체중 1kg당 0.8~1.2g이 일반 성인 권장 범위입니다. 운동 강도에 따라 달라지므로 활동량과 함께 계산하세요.' },
    ],
    exampleBadCopy: [
      { headline: '이것만 먹으면 만병통치', body: '이 보충제 하나로 모든 질병이 예방되고 즉시 건강이 회복됩니다.', reason: '치료 효과 보장과 검증되지 않은 의학 주장' },
    ],
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
    voiceRules: [
      '확인된 사실만 서술하고 개인 의도·동기를 추정하지 않는다.',
      '단정적 표현보다 "발표에 따르면", "보도에 의하면" 형식으로 출처를 명시한다.',
      '감정적 선동보다 맥락과 영향을 중립적으로 설명한다.',
    ],
    headlineStyle: [
      '핵심 사실 + 독자에게 미치는 영향을 결합한다.',
      '예: "금리 또 동결, 대출자에게 의미하는 것"',
      '"충격", "경악" 같은 선정성 단어보다 구체적 사실을 헤드라인에 쓴다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 사건, 배경, 영향, 쟁점 중 하나만 다룬다.',
      '확인된 수치와 기간을 명시하고 출처 없는 수치는 쓰지 않는다.',
      '독자가 이 정보로 무엇을 할 수 있는지 마지막에 제시한다.',
    ],
    ctaStyleHints: [
      '"이 이슈 흐름 저장해두고 경과를 지켜보세요"',
      '"관련 배경 내용 정리해뒀어요"',
      '"핵심 쟁점만 골라 저장해두세요"',
    ],
    exampleGoodCopy: [
      { headline: '금리 동결, 대출자에게 뭐가 달라지나', body: '기준금리가 3.5%로 유지됐습니다. 변동금리 대출자는 당장 이자 변동이 없지만, 인하 시점에 대한 불확실성은 여전합니다.' },
      { headline: '이 법안, 내년부터 뭐가 바뀌나', body: '시행 시점은 2026년 1월입니다. 소규모 사업자는 적용 유예 기간이 6개월 주어집니다. 세부 시행령은 아직 확정되지 않았습니다.' },
    ],
    exampleBadCopy: [
      { headline: '충격! 이 사건의 숨겨진 진실', body: '내부 관계자에 따르면 모두가 알고 있었고 의도적으로 숨겼을 가능성이 매우 높습니다.', reason: '확인되지 않은 추정과 선정적 표현' },
    ],
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
    voiceRules: [
      '투자 권유가 아니라 시장 상황을 해석하는 리포트 톤을 사용한다.',
      '"오른다", "사라", "수익 보장" 같은 방향성 단정을 금지한다.',
      '숫자는 출처 자료에 있는 경우에만 쓰고, 없으면 정성적 표현으로 대체한다.',
    ],
    headlineStyle: [
      '자극적인 전망보다 변화 요인 중심으로 쓴다.',
      '예: "금리보다 중요한 변수, 지금 뭘 보나"',
      '"지금 사야 할 종목" 같은 추천형 헤드라인을 금지한다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 지표, 기간, 리스크, 정책 변수 중 하나만 설명한다.',
      '독자가 투자 결정을 내리게 하기보다 확인해야 할 관점을 제공한다.',
      '확정적 예측 대신 "가능성", "부담", "변수" 같은 표현을 사용한다.',
    ],
    ctaStyleHints: [
      '"투자 판단 전 원문 지표 확인해보세요"',
      '"이 시장 변수 저장해두고 동향 지켜보세요"',
      '"리스크 요인 정리해뒀어요, 비교해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '금리 동결보다 중요한 변수', body: '이번 결정보다 다음 분기 고용 지표가 방향을 결정할 가능성이 큽니다. 현재 시장은 인하 시점보다 속도에 더 민감하게 반응하고 있습니다.' },
      { headline: '이 지표가 흔들리면 주의 신호', body: 'PMI가 50 아래로 내려가면 제조업 위축을 의미합니다. 지난달 기준 49.3으로 2개월 연속 하락 중입니다.' },
    ],
    exampleBadCopy: [
      { headline: '지금 당장 이 종목 사세요', body: '무조건 급등 확정이고 수익이 보장됩니다.', reason: '투자 권유와 수익 보장 주장' },
    ],
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
    voiceRules: [
      '제품의 실제 사용 장면과 구매 판단 기준을 구체적으로 제시한다.',
      '"1위", "최고" 같은 미검증 순위 표현을 쓰지 않는다.',
      '가격 정보는 출처가 있을 때만 쓰고, 없으면 "가격대", "가성비" 수준으로 표현한다.',
    ],
    headlineStyle: [
      '구매 전 고민 + 판단 기준을 결합한다.',
      '예: "비슷해 보이는 두 제품, 차이는 소재"',
      '제품명보다 사용 상황과 이득을 앞세운다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 사용 장면, 차별점, 가격감, 한계 중 하나만 다룬다.',
      '실제 사용자 시나리오로 설명하면 설득력이 높아진다.',
      '단점이나 적합하지 않은 경우도 솔직하게 언급해 신뢰를 높인다.',
    ],
    ctaStyleHints: [
      '"구매 전 체크리스트 저장해두세요"',
      '"비교 기준 정리해뒀어요"',
      '"내 상황에 맞는 옵션 먼저 확인해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '소재가 가격 차이를 만든다', body: '스테인리스와 알루미늄은 가격이 2배 이상 차이납니다. 야외 사용이 잦다면 내구성, 실내 전용이라면 알루미늄도 충분합니다.' },
      { headline: '이 제품이 맞지 않는 경우', body: '수납 공간이 좁거나 이동이 잦은 환경에서는 조립 시간이 부담이 될 수 있습니다. 사용 환경을 먼저 확인하세요.' },
    ],
    exampleBadCopy: [
      { headline: '국내 판매 1위 제품', body: '완벽한 품질로 모든 분들께 무조건 만족을 드립니다.', reason: '미검증 순위 주장과 과장 표현' },
    ],
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
    voiceRules: [
      '학습자의 현재 수준과 다음 단계를 명확하게 제시한다.',
      '"무조건 합격", "성적 보장" 같은 결과 보장 표현을 쓰지 않는다.',
      '개념 설명은 실제 예시나 연습 장면으로 구체화한다.',
    ],
    headlineStyle: [
      '학습 단계 + 실천 방법을 결합한다.',
      '예: "영어 말하기, 발음보다 먼저 잡아야 할 것"',
      '추상적인 "잘할 수 있다"보다 구체적인 방법론을 제시한다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 개념, 방법, 연습법, 주의점 중 하나만 다룬다.',
      '난이도와 선행 지식 조건을 명시한다.',
      '독자가 오늘 바로 실천할 수 있는 작은 행동 단위로 끝맺는다.',
    ],
    ctaStyleHints: [
      '"이 순서대로 연습하면 됩니다, 저장해두세요"',
      '"내 수준 먼저 확인하고 시작하세요"',
      '"오늘 딱 하나만 따라해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '영문법, 외우지 말고 이해하라', body: '시제는 "시간"이 아니라 "관점"입니다. 현재완료를 과거와 구별하는 핵심은 현재와의 연결성입니다. 예문 10개보다 이 원리 하나가 오래 남습니다.' },
      { headline: '코딩 공부, 이 순서가 효율적이다', body: '변수 → 조건문 → 반복문 → 함수 순서로 익히면 개념 연결이 자연스럽습니다. 프레임워크는 기초 문법 후에 배워도 늦지 않습니다.' },
    ],
    exampleBadCopy: [
      { headline: '이 강의 들으면 무조건 합격', body: '수강생 전원이 100% 원하는 결과를 얻었습니다.', reason: '결과 보장 주장과 검증 불가 통계' },
    ],
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
    voiceRules: [
      '장소의 분위기와 실제 이동 맥락을 구체적으로 묘사한다.',
      '영업 시간, 가격, 예약 방법은 출처가 있을 때만 언급한다.',
      '"인생 여행지", "무조건 가야 해" 같은 과장 표현보다 어떤 사람에게 맞는지 조건을 제시한다.',
    ],
    headlineStyle: [
      '장소 + 그 장소가 특별한 구체적 이유를 결합한다.',
      '예: "뚝섬, 한강 피크닉 최적 타이밍은 평일 오후"',
      '막연한 "아름다운"보다 시간대·계절·상황을 명시한다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 동선, 시간대, 예약, 주변 정보 중 하나만 다룬다.',
      '거리나 이동 시간은 구체적으로 표현한다.',
      '혼자/둘/가족 등 여행 형태에 따른 적합성도 언급한다.',
    ],
    ctaStyleHints: [
      '"이 동선 저장해두고 여행 전날 확인하세요"',
      '"예약 필요한 곳 따로 정리해뒀어요"',
      '"계절별 추천 시간대 저장해두세요"',
    ],
    exampleGoodCopy: [
      { headline: '제주 동쪽, 오전에 가야 하는 이유', body: '성산 일출봉 주변은 오전 9시 이후 주차가 어렵습니다. 오전 8시 이전 도착하면 인파 없이 돌아볼 수 있습니다.' },
      { headline: '경복궁 야간 관람, 예약이 핵심', body: '야간 개장은 사전 예매제로 운영됩니다. 티켓은 보통 2~3주 전에 마감되므로 여행 날짜 확정 직후 예약하는 것이 안전합니다.' },
    ],
    exampleBadCopy: [
      { headline: '무조건 가야 할 인생 여행지', body: '누구에게나 완벽하고 실망 없는 최고의 여행 코스입니다.', reason: '과장 표현과 검증 불가 주장' },
    ],
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
    voiceRules: [
      '주제에 맞는 구체적인 정보와 실천 기준을 제시한다.',
      '지나치게 넓은 일반론보다 독자가 바로 활용할 수 있는 맥락을 제공한다.',
      '출처가 있는 정보는 출처를 밝히고, 없으면 "일반적으로", "통상적으로"로 표현한다.',
    ],
    headlineStyle: [
      '핵심 정보 + 독자에게 필요한 이유를 결합한다.',
      '질문형 또는 판단 기준 제시형 모두 가능하다.',
      '추상적인 키워드보다 구체적인 상황을 헤드라인에 담는다.',
    ],
    bodyStyle: [
      '한 슬라이드에는 하나의 개념이나 실천 방법만 다룬다.',
      '독자가 다음에 무엇을 할 수 있는지 행동 단위로 끝맺는다.',
      '주의사항이 있다면 짧게 언급해 균형을 잡는다.',
    ],
    ctaStyleHints: [
      '"저장해두고 필요할 때 꺼내보세요"',
      '"이 기준으로 비교해보세요"',
      '"오늘 하나만 실천해보세요"',
    ],
    exampleGoodCopy: [
      { headline: '모르면 손해보는 기준 하나', body: '대부분 이 부분을 넘기고 시작합니다. 처음 확인하는 데 2분이면 되고, 나중에 되돌리는 시간보다 훨씬 짧습니다.' },
    ],
    exampleBadCopy: [
      { headline: '모든 사람에게 완벽한 방법', body: '누구에게나 무조건 효과가 있고 실패 없이 결과가 나옵니다.', reason: '검증 불가 보편 주장' },
    ],
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

// English copy anchors per domain. `requiredCopyAnchors` on the profile is Korean, so the
// semantic critic's anchor check never matches English copy without these. Keep terms
// distinctive (not generic words like "use"/"data") so the gate stays meaningful.
const REQUIRED_COPY_ANCHORS_EN: Record<ContentDomain, string[]> = {
  fashion: ['silhouette', 'layering', 'accessories', 'fabric', 'styling', 'outfit'],
  food: ['texture', 'flavor', 'ingredient', 'pairing', 'recipe', 'aroma'],
  beauty: ['formula', 'ingredient', 'routine', 'texture', 'application'],
  living: ['layout', 'storage', 'lighting', 'arrangement', 'material'],
  tech: ['workflow', 'feature', 'integration', 'limitation', 'setup'],
  health: ['routine', 'habit', 'evidence', 'symptom', 'dosage'],
  news: ['background', 'impact', 'context', 'reaction', 'source'],
  finance: ['metric', 'volatility', 'risk', 'valuation', 'return'],
  commerce: ['comparison', 'benefit', 'difference', 'pricing', 'scenario'],
  education: ['method', 'practice', 'mistake', 'exercise', 'level'],
  travel: ['itinerary', 'booking', 'neighborhood', 'season', 'route'],
  general: ['definition', 'example', 'comparison', 'criteria', 'context'],
}

/** Returns language-appropriate required copy anchors for a domain. */
export function getRequiredCopyAnchors(profile: DomainProfile, language: 'ko' | 'en' = 'ko'): string[] {
  return language === 'en' ? (REQUIRED_COPY_ANCHORS_EN[profile.domain] || REQUIRED_COPY_ANCHORS_EN.general) : profile.requiredCopyAnchors
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

  const client = getLightClient()
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
      model: getQwenModel(),
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
  const goodExamples = profile.exampleGoodCopy.slice(0, 2)
    .map(ex => `  ✓ 헤드라인: "${ex.headline}" / 본문: "${ex.body}"`)
    .join('\n')
  const badExamples = profile.exampleBadCopy.slice(0, 1)
    .map(ex => `  ✗ 헤드라인: "${ex.headline}" / 본문: "${ex.body}" (이유: ${ex.reason})`)
    .join('\n')

  return [
    `[DOMAIN GUIDANCE: ${profile.label}]`,
    `Required copy anchors: ${profile.requiredCopyAnchors.join(', ')}`,
    `Search/content angles: ${profile.searchAngles.join(', ')}`,
    `Do not use unrelated terms: ${getDomainBannedTerms(profile.domain).join(', ')}`,
    ...profile.cautionRules,
    '',
    '말투 규칙:',
    ...profile.voiceRules.map(r => `  - ${r}`),
    '',
    '헤드라인 작성 기준:',
    ...profile.headlineStyle.map(r => `  - ${r}`),
    '',
    '본문 작성 기준:',
    ...profile.bodyStyle.map(r => `  - ${r}`),
    '',
    `CTA 힌트: ${profile.ctaStyleHints.join(' / ')}`,
    '',
    '좋은 카피 예시:',
    goodExamples,
    '',
    '피해야 할 카피 예시:',
    badExamples,
  ].filter(line => line !== undefined).join('\n')
}

export function formatDomainVisualGuidance(profile: DomainProfile): string {
  return [
    `DOMAIN VISUAL MODE: ${profile.label}.`,
    `The generated image must center on ${profile.imageSubject}.`,
    `Use this scene family: ${profile.imageScene}.`,
    `Avoid: ${profile.imageExclusions.join(', ')}.`,
  ].join(' ')
}

