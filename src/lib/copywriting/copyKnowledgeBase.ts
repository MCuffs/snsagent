import type { LLMClient } from '../ai/llmClient'
import type {
  BrandProfile,
  CampaignInput,
  ContentStrategy,
  HookCandidate,
  HookType,
  SlideRole,
  StrategyType,
} from '../carousel/types'

// ─── Hook Patterns ────────────────────────────────────────────────────────────

export type HookPatternId =
  | 'before_after_reversal'
  | 'secret_reveal'
  | 'mistake_callout'
  | 'number_teaser'
  | 'identity_mirror'
  | 'comparison_aha'
  | 'urgency_scarcity'
  | 'pain_empathy'
  | 'stat_shock'
  | 'question_loop'
  | 'social_echo'
  | 'authority_transfer'
  | 'sensory_scene'
  | 'fomo_list'
  | 'challenge_norm'

export type EmotionalIntent =
  | 'fomo'
  | 'curiosity'
  | 'empathy'
  | 'aspiration'
  | 'relief'
  | 'belonging'
  | 'validation'
  | 'disgust'

export interface HookPattern {
  id: HookPatternId
  label: string
  templateKr: string
  hookType: HookType
  emotionalTrigger: EmotionalIntent
  examplePhrases: string[]
  scoreWeight: number
}

export interface EmotionalIntentProfile {
  intent: EmotionalIntent
  koreanTriggerPhrases: string[]
  avoidPhrases: string[]
  compatibleSlideRoles: SlideRole[]
  toneDescriptor: string
}

// ─── Persona ──────────────────────────────────────────────────────────────────

export type PersonaId =
  | 'practical_saver'
  | 'trend_curator'
  | 'informed_professional'
  | 'lifestyle_aspirant'
  | 'community_sharer'

export interface PersonaProfile {
  id: PersonaId
  label: string
  ageRange: string
  coreMotivation: string
  contentConsumptionStyle: string
  preferredHookPatterns: HookPatternId[]
  preferredNarrativeArc: NarrativeArcId
  copyToneHints: string[]
  triggerWords: string[]
  avoidWords: string[]
}

// ─── Narrative Arcs ───────────────────────────────────────────────────────────

export type NarrativeArcId =
  | 'problem_twist_solution'
  | 'checklist_save'
  | 'before_after_proof'
  | 'belief_challenge'
  | 'mini_story_cta'

export interface NarrativeArc {
  id: NarrativeArcId
  label: string
  slideRoleSequence: SlideRole[]
  transitionLogic: string[]
  compatibleStrategies: StrategyType[]
  optimalSlideCount: number
  narrativeTension: 'builds' | 'resolves_early' | 'constant'
}

// ─── Industry Tone ────────────────────────────────────────────────────────────

export type IndustryCategory =
  | 'beauty_skincare'
  | 'food_beverage'
  | 'fashion_lifestyle'
  | 'health_wellness'
  | 'tech_digital'
  | 'education_content'

export interface IndustryToneRule {
  industry: IndustryCategory
  toneDescriptor: string
  preferredPatterns: HookPatternId[]
  avoidPatterns: HookPatternId[]
  additionalBannedPhrases: string[]
  copyPersonality: string
  ctaStyle: string
}

// ─── Reference Pattern ────────────────────────────────────────────────────────

export interface IngestedReferencePattern {
  sourceType: 'url' | 'image_url'
  analyzedAt: string
  headlineStyle: string
  emotionalTrigger: EmotionalIntent
  detectedHookPattern: HookPatternId
  slideRole: SlideRole
  layoutType: string
  copyTone: string
  extractedPatternNotes: string
}

// ─── Knowledge Context ────────────────────────────────────────────────────────

export interface CopyKnowledgeContext {
  selectedHookPatterns: HookPattern[]
  personaProfile: PersonaProfile
  narrativeArc: NarrativeArc
  emotionalIntentProfile: EmotionalIntentProfile
  industryToneRule: IndustryToneRule | null
  referencePatterns: IngestedReferencePattern[]
  resolvedBannedPhrases: string[]
  editorialCluster: EditorialStyleCluster | null
}

// ─── Data: Hook Patterns ──────────────────────────────────────────────────────

const HOOK_PATTERNS: HookPattern[] = [
  {
    id: 'before_after_reversal',
    label: '전후 반전',
    templateKr: '{{product}} 쓰기 전엔 몰랐어요',
    hookType: 'curiosity',
    emotionalTrigger: 'fomo',
    examplePhrases: ['선크림 바르기 전엔 몰랐어요', '에스프레소 머신 전엔 몰랐어요'],
    scoreWeight: 9,
  },
  {
    id: 'secret_reveal',
    label: '비밀 공개',
    templateKr: '아무도 안 알려주는 {{topic}}',
    hookType: 'curiosity',
    emotionalTrigger: 'curiosity',
    examplePhrases: ['아무도 안 알려주는 헬스 루틴', '아무도 안 알려주는 스킨케어 순서'],
    scoreWeight: 8,
  },
  {
    id: 'mistake_callout',
    label: '실수 지적',
    templateKr: '이 실수, 지금도 하고 있죠?',
    hookType: 'pain_point',
    emotionalTrigger: 'empathy',
    examplePhrases: ['이 실수 아직도 하고 있죠?', '이 습관 아직도 있으신가요?'],
    scoreWeight: 9,
  },
  {
    id: 'number_teaser',
    label: '숫자 티저',
    templateKr: '딱 {{N}}가지만 바꿨더니',
    hookType: 'benefit',
    emotionalTrigger: 'aspiration',
    examplePhrases: ['딱 3가지만 바꿨더니', '딱 2주만 해봤더니'],
    scoreWeight: 8,
  },
  {
    id: 'identity_mirror',
    label: '정체성 거울',
    templateKr: '{{trait}}이신 분들 꼭 보세요',
    hookType: 'pain_point',
    emotionalTrigger: 'belonging',
    examplePhrases: ['피부 고민 있으신 분들 꼭 보세요', '커피 매일 마시는 분들'],
    scoreWeight: 7,
  },
  {
    id: 'comparison_aha',
    label: '비교 반전',
    templateKr: '비슷해 보여도 이게 다릅니다',
    hookType: 'comparison',
    emotionalTrigger: 'curiosity',
    examplePhrases: ['비슷해 보여도 성분이 다릅니다', '같은 가격, 이게 다릅니다'],
    scoreWeight: 8,
  },
  {
    id: 'urgency_scarcity',
    label: '긴박감',
    templateKr: '지금 아니면 {{loss}}',
    hookType: 'urgency',
    emotionalTrigger: 'fomo',
    examplePhrases: ['지금 아니면 올해 못 써요', '지금 아니면 재고 없어요'],
    scoreWeight: 6,
  },
  {
    id: 'pain_empathy',
    label: '고통 공감',
    templateKr: '이 불편함, 공감되시나요?',
    hookType: 'pain_point',
    emotionalTrigger: 'empathy',
    examplePhrases: ['이 답답함 공감되시나요?', '이 피로감 느껴본 적 있나요?'],
    scoreWeight: 8,
  },
  {
    id: 'stat_shock',
    label: '통계 충격',
    templateKr: '10명 중 {{N}}명이 모르는',
    hookType: 'social_proof',
    emotionalTrigger: 'curiosity',
    examplePhrases: ['10명 중 7명이 모르는 사실', '셋 중 둘은 이걸 놓칩니다'],
    scoreWeight: 7,
  },
  {
    id: 'question_loop',
    label: '질문 루프',
    templateKr: '혹시 이거 알고 계셨나요?',
    hookType: 'curiosity',
    emotionalTrigger: 'curiosity',
    examplePhrases: ['혹시 이거 쓰고 계셨나요?', '혹시 이 차이 알고 있었나요?'],
    scoreWeight: 7,
  },
  {
    id: 'social_echo',
    label: '소셜 에코',
    templateKr: '요즘 다들 {{action}}한대요',
    hookType: 'social_proof',
    emotionalTrigger: 'belonging',
    examplePhrases: ['요즘 다들 이거 쓴대요', '요즘 다들 이렇게 한대요'],
    scoreWeight: 7,
  },
  {
    id: 'authority_transfer',
    label: '권위 이전',
    templateKr: '{{professional}}들이 추천하는 이유',
    hookType: 'social_proof',
    emotionalTrigger: 'validation',
    examplePhrases: ['전문가들이 추천하는 이유', '바리스타들이 고르는 기준'],
    scoreWeight: 7,
  },
  {
    id: 'sensory_scene',
    label: '감각 장면',
    templateKr: '이 느낌 아시는 분?',
    hookType: 'curiosity',
    emotionalTrigger: 'empathy',
    examplePhrases: ['이 향 아시는 분?', '이 식감 아시는 분?'],
    scoreWeight: 8,
  },
  {
    id: 'fomo_list',
    label: 'FOMO 목록',
    templateKr: '저장 안 하면 후회하는 {{N}}가지',
    hookType: 'curiosity',
    emotionalTrigger: 'fomo',
    examplePhrases: ['저장 안 하면 후회하는 3가지', '나중에 꼭 필요한 5가지'],
    scoreWeight: 8,
  },
  {
    id: 'challenge_norm',
    label: '상식 반박',
    templateKr: '당연하다고 생각했는데 아니었어요',
    hookType: 'comparison',
    emotionalTrigger: 'curiosity',
    examplePhrases: ['당연한 줄 알았는데 아니었어요', '다 그런 줄 알았는데요'],
    scoreWeight: 8,
  },
]

// ─── Data: Emotional Intent Profiles ─────────────────────────────────────────

const EMOTIONAL_INTENT_PROFILES: EmotionalIntentProfile[] = [
  {
    intent: 'fomo',
    koreanTriggerPhrases: ['지금 아니면', '놓치면', '이때 아니면', '한정', '마지막'],
    avoidPhrases: ['이번 시즌 핫 트렌드', '특별한 가치', '지금 바로 만나보세요'],
    compatibleSlideRoles: ['hook', 'offer', 'cta'],
    toneDescriptor: '짧고 건조하게, 과장 없이',
  },
  {
    intent: 'curiosity',
    koreanTriggerPhrases: ['몰랐어요', '이유가 있어요', '사실은', '알고 보면', '비밀이 있어요'],
    avoidPhrases: ['혁신적인', '새로운 차원의', '스마트한 선택'],
    compatibleSlideRoles: ['hook', 'cause', 'common_mistake', 'benefit_or_proof'],
    toneDescriptor: '미끄러지듯 자연스럽게, 결론은 뒤에',
  },
  {
    intent: 'empathy',
    koreanTriggerPhrases: ['공감되시나요', '겪어보셨나요', '느껴본 적', '저도 그랬어요', '맞죠'],
    avoidPhrases: ['완벽한', '최고의 경험', '당신만을 위한'],
    compatibleSlideRoles: ['hook', 'problem', 'cause'],
    toneDescriptor: '친구처럼, 설명보다 공감',
  },
  {
    intent: 'aspiration',
    koreanTriggerPhrases: ['바뀌었어요', '달라졌어요', '이렇게 됐어요', '가능해요', '됩니다'],
    avoidPhrases: ['독특한 디자인', '더 많은 팁 확인', '오늘부터 시작하세요'],
    compatibleSlideRoles: ['product_solution', 'feature', 'benefit_or_proof'],
    toneDescriptor: '가능성을 보여주되 과장 없이',
  },
  {
    intent: 'belonging',
    koreanTriggerPhrases: ['다들', '요즘', '많이들', '알고 있는', '쓰는 분들'],
    avoidPhrases: ['여러분의 일상', '함께하는 특별한'],
    compatibleSlideRoles: ['hook', 'benefit_or_proof', 'cta'],
    toneDescriptor: '가볍게 언급하듯, 자랑하지 말고',
  },
  {
    intent: 'validation',
    koreanTriggerPhrases: ['역시', '맞았어요', '이래서', '그게 맞다고', '근거가 있어요'],
    avoidPhrases: ['혁신적인 솔루션', '더 나은 미래'],
    compatibleSlideRoles: ['proof', 'benefit_or_proof', 'cta'],
    toneDescriptor: '근거 먼저, 주장은 뒤에',
  },
  {
    intent: 'relief',
    koreanTriggerPhrases: ['이제는', '드디어', '걱정 없어요', '해결됐어요', '편해졌어요'],
    avoidPhrases: ['완벽한 선택', '최고의 경험'],
    compatibleSlideRoles: ['product_solution', 'offer', 'cta'],
    toneDescriptor: '부담 없이, 안도감으로 마무리',
  },
  {
    intent: 'disgust',
    koreanTriggerPhrases: ['그건 별로', '사실 이게 문제', '아직도', '이게 맞나요', '이상하지 않나요'],
    avoidPhrases: ['최고의', '완벽한', '혁신적인'],
    compatibleSlideRoles: ['problem', 'common_mistake', 'cause'],
    toneDescriptor: '냉소적으로 짧게, 독자가 고개 끄덕이게',
  },
]

// ─── Data: Persona Profiles ───────────────────────────────────────────────────

const PERSONA_PROFILES: PersonaProfile[] = [
  {
    id: 'practical_saver',
    label: '실용파 세이버',
    ageRange: '30-38',
    coreMotivation: '시간과 돈 아끼기, 합리적 선택',
    contentConsumptionStyle: '빠르게 훑고 저장, 나중에 비교',
    preferredHookPatterns: ['number_teaser', 'comparison_aha', 'mistake_callout'],
    preferredNarrativeArc: 'problem_twist_solution',
    copyToneHints: ['짧고 건조하게', '숫자 활용', '근거 먼저'],
    triggerWords: ['가성비', '실용적', '바로 쓰는', '솔직히', '딱 필요한'],
    avoidWords: ['감성적인', '무드', '특별한 가치', '프리미엄 라이프'],
  },
  {
    id: 'trend_curator',
    label: '트렌드 큐레이터',
    ageRange: '21-28',
    coreMotivation: '나만 아는 것 공유, 심미 충족',
    contentConsumptionStyle: '저장 후 스토리 공유, DM 전달',
    preferredHookPatterns: ['sensory_scene', 'before_after_reversal', 'fomo_list'],
    preferredNarrativeArc: 'mini_story_cta',
    copyToneHints: ['감성적 단어 한두 개', '장면 묘사', '짧은 문장'],
    triggerWords: ['요즘', '찐으로', '이건 진짜', '감성', '느낌 알죠'],
    avoidWords: ['효과적인', '기능적으로', '최고의 성능', '혁신적인'],
  },
  {
    id: 'informed_professional',
    label: '정보 탐색 직장인',
    ageRange: '28-42',
    coreMotivation: '정확한 정보로 빠른 결정',
    contentConsumptionStyle: '천천히 읽고 저장, 링크 클릭',
    preferredHookPatterns: ['stat_shock', 'authority_transfer', 'question_loop'],
    preferredNarrativeArc: 'belief_challenge',
    copyToneHints: ['근거 먼저', '수치 활용', '결론 명확하게'],
    triggerWords: ['근거', '실제로', '정리하면', '핵심은', '알고보면'],
    avoidWords: ['놀라운', '혁신적인', '완벽한', '이번 시즌 핫 트렌드'],
  },
  {
    id: 'lifestyle_aspirant',
    label: '라이프스타일 추구자',
    ageRange: '25-35',
    coreMotivation: '더 나은 버전의 나',
    contentConsumptionStyle: '팔로우 후 계속 참고',
    preferredHookPatterns: ['identity_mirror', 'before_after_reversal', 'social_echo'],
    preferredNarrativeArc: 'before_after_proof',
    copyToneHints: ['변화를 장면으로', '주인공은 독자', '과장 없이 가능성 보여주기'],
    triggerWords: ['바뀌었어요', '습관', '달라지는', '매일', '루틴'],
    avoidWords: ['독특한 디자인', '특별한 가치', '최고의 선택'],
  },
  {
    id: 'community_sharer',
    label: '커뮤니티 전파자',
    ageRange: '22-40',
    coreMotivation: '정보 나눔, 인정받기',
    contentConsumptionStyle: '저장 + 공유 + 댓글, CTA 반응률 높음',
    preferredHookPatterns: ['fomo_list', 'social_echo', 'stat_shock'],
    preferredNarrativeArc: 'checklist_save',
    copyToneHints: ['공유하고 싶은 정보 밀도', '목록 형식 선호', 'CTA는 자연스럽게'],
    triggerWords: ['저장해두세요', '공유해요', '몰랐죠', '다들'],
    avoidWords: ['구매하세요', '지금 바로', '혁신적인'],
  },
]

// ─── Data: Narrative Arcs ─────────────────────────────────────────────────────

const NARRATIVE_ARCS: NarrativeArc[] = [
  {
    id: 'problem_twist_solution',
    label: '문제→반전→해결',
    slideRoleSequence: ['hook', 'problem', 'product_solution', 'benefit_or_proof', 'cta'],
    transitionLogic: [
      '문제를 제기하는 강렬한 첫 문장 — 다음 슬라이드가 궁금하게 끝낼 것',
      '공감되는 상황 묘사 — 왜인지 원인이 궁금하게 복선 남길 것',
      '반전: 예상과 다른 해결 방법을 간결하게 — 근거가 뒤따른다는 암시',
      '구체적 근거나 결과 — 수치가 없으면 사용 장면으로',
      'CTA: 부드럽게 행동 유도, 압박 없이',
    ],
    compatibleStrategies: ['problem_solution', 'benefit_focused'],
    optimalSlideCount: 5,
    narrativeTension: 'builds',
  },
  {
    id: 'checklist_save',
    label: '체크리스트→저장',
    slideRoleSequence: ['hook', 'problem', 'feature_1', 'feature_2', 'feature', 'offer', 'cta'],
    transitionLogic: [
      '몇 가지 알려줄 것인지 숫자로 예고 — 저장 욕구 자극',
      '이 목록이 필요한 이유 한 문장',
      '항목 1: 짧고 구체적으로',
      '항목 2: 앞 항목과 중복 없이',
      '항목 3: 가장 임팩트 있는 항목을 마지막에',
      '전체 요약 또는 보너스 팁',
      '저장 유도 CTA',
    ],
    compatibleStrategies: ['checklist', 'review_style'],
    optimalSlideCount: 7,
    narrativeTension: 'constant',
  },
  {
    id: 'before_after_proof',
    label: '이전→이후→근거',
    slideRoleSequence: ['hook', 'problem', 'common_mistake', 'product_solution', 'proof', 'cta'],
    transitionLogic: [
      '이전 상태: 독자가 지금 있는 곳',
      '고통의 정점: 가장 공감되는 불편함',
      '흔한 실수: 잘못된 해결책을 먼저 언급',
      '이후 상태: 전환점, 짧고 선명하게',
      '근거: 왜 이게 작동하는지 한 줄',
      'CTA: 지금 확인하면 된다는 안도감',
    ],
    compatibleStrategies: ['storytelling', 'review_style'],
    optimalSlideCount: 6,
    narrativeTension: 'resolves_early',
  },
  {
    id: 'belief_challenge',
    label: '상식→반박→새 기준',
    slideRoleSequence: ['hook', 'problem', 'cause', 'common_mistake', 'product_solution', 'proof', 'cta'],
    transitionLogic: [
      '당연하다고 여겼던 것에 의문 제기',
      '그 믿음이 초래하는 문제',
      '왜 그 믿음이 생겼는지 원인',
      '대부분이 선택하는 잘못된 방법',
      '새로운 기준: 브랜드가 제시하는 올바른 방법',
      '근거: 새 기준이 맞다는 증거',
      'CTA: 새 기준으로 살펴보기',
    ],
    compatibleStrategies: ['comparison', 'storytelling'],
    optimalSlideCount: 7,
    narrativeTension: 'builds',
  },
  {
    id: 'mini_story_cta',
    label: '장면→공감→해결→CTA',
    slideRoleSequence: ['hook', 'problem', 'product_solution', 'feature', 'cta'],
    transitionLogic: [
      '구체적 장면으로 시작 — 독자가 그 장면 속에 있게',
      '그 장면의 불편함 또는 욕구',
      '전환점: 짧고 긍정적으로',
      '실제 사용 모습 한 장면',
      'CTA: 자연스럽게',
    ],
    compatibleStrategies: ['benefit_focused', 'seasonal', 'discount'],
    optimalSlideCount: 5,
    narrativeTension: 'resolves_early',
  },
]

// ─── Data: Industry Tone Rules ────────────────────────────────────────────────

const INDUSTRY_TONE_RULES: IndustryToneRule[] = [
  {
    industry: 'beauty_skincare',
    toneDescriptor: '친근하고 솔직한 친구의 추천, 성분 언급 시 간결하게',
    preferredPatterns: ['before_after_reversal', 'sensory_scene', 'mistake_callout'],
    avoidPatterns: ['urgency_scarcity'],
    additionalBannedPhrases: ['피부 고민 해결', '즉각적인 효과', '촉촉한 수분', '피부 트러블'],
    copyPersonality: '공감하는 친구처럼, 설명은 짧게',
    ctaStyle: '저장해두고 성분 비교해보세요',
  },
  {
    industry: 'food_beverage',
    toneDescriptor: '식감·향 묘사 감각적, 짧고 군침 도는 표현',
    preferredPatterns: ['sensory_scene', 'social_echo', 'before_after_reversal'],
    avoidPatterns: ['stat_shock', 'authority_transfer'],
    additionalBannedPhrases: ['건강한 선택', '최고의 맛', '영양가 풍부한', '맛있는 한 끼'],
    copyPersonality: '먹고 싶어지게, 수식어는 최소로',
    ctaStyle: '한 번만 먹어보면 알아요',
  },
  {
    industry: 'fashion_lifestyle',
    toneDescriptor: '무드 중심, 스타일링 팁처럼 담백하게',
    preferredPatterns: ['identity_mirror', 'sensory_scene', 'fomo_list'],
    avoidPatterns: ['stat_shock', 'authority_transfer'],
    additionalBannedPhrases: ['트렌디한 스타일', '완성된 룩', '독특한 디자인', '패션 아이템'],
    copyPersonality: '간결하게, 스타일은 보여주고 설명하지 말기',
    ctaStyle: '저장해두고 코디에 써보세요',
  },
  {
    industry: 'health_wellness',
    toneDescriptor: '과장 없이 사실 기반, 공감 후 근거 제시',
    preferredPatterns: ['question_loop', 'stat_shock', 'challenge_norm'],
    avoidPatterns: ['urgency_scarcity'],
    additionalBannedPhrases: ['놀라운 효과', '즉시 개선', '전문가 추천', '건강 관리'],
    copyPersonality: '신뢰할 수 있게, 주장보다 사실',
    ctaStyle: '더 궁금하면 프로필 링크 확인',
  },
  {
    industry: 'tech_digital',
    toneDescriptor: '간결하고 스마트, 기능보다 사용 장면 중심',
    preferredPatterns: ['number_teaser', 'comparison_aha', 'stat_shock'],
    avoidPatterns: ['sensory_scene', 'social_echo'],
    additionalBannedPhrases: ['스마트한 솔루션', '혁신적인 기술', 'AI 기반', '디지털 혁신'],
    copyPersonality: '쉽게 설명하되 전문적으로',
    ctaStyle: '지금 써보고 차이 느껴보세요',
  },
  {
    industry: 'education_content',
    toneDescriptor: '쉽고 명확하게, 저장 가치를 강조',
    preferredPatterns: ['fomo_list', 'question_loop', 'mistake_callout'],
    avoidPatterns: ['urgency_scarcity'],
    additionalBannedPhrases: ['쉽게 배우는', '누구나 할 수 있는', '더 많은 팁 확인', '성장하는'],
    copyPersonality: '친절하게, 핵심만 전달',
    ctaStyle: '저장해두고 나중에 확인하세요',
  },
]

// ─── Editorial Style Clusters (from KB v2) ────────────────────────────────────

export type EditorialClusterId =
  | 'personal_finance_confession'
  | 'essay_closing_slide'
  | 'ai_breaking_collab'
  | 'money_result_brag'
  | 'career_turning_point'
  | 'market_cap_headline'
  | 'rescue_breaking_news'
  | 'long_explainer_photo'
  | 'finance_product_briefing'
  | 'social_issue_statement'

export interface EditorialStyleCluster {
  id: EditorialClusterId
  name: string
  copyFormula: string
  emotions: string[]
  bestFor: string[]
  sampleHeadlineTones: string[]
  layoutRecommendation: string
  visualCues: string[]
}

export const EDITORIAL_CLUSTERS: EditorialStyleCluster[] = [
  {
    id: 'personal_finance_confession',
    name: '개인 금융 고백형',
    copyFormula: '{실패/손실/경험}도 {정당화/회복}되는 시기, 우리는 {행동}을 시작했다',
    emotions: ['불안', '청춘', '회복', '도전'],
    bestFor: ['금융', '투자', '자기계발', '커뮤니티', '교육'],
    sampleHeadlineTones: ['고백형 선언', '나이/시기 기준점', '손실을 자산으로 재해석'],
    layoutRecommendation: 'dark-editorial',
    visualCues: ['dark background', 'financial numbers', 'red/blue contrast', 'large white declaration'],
  },
  {
    id: 'essay_closing_slide',
    name: '에세이형 마무리',
    copyFormula: '{짧은 선언}. {현재 상황} 속에서 {우리/당신}은 {의미 있는 행동}을 하고 있다.',
    emotions: ['위로', '응원', '성찰', '잔잔함'],
    bestFor: ['브랜드 스토리', '커뮤니티', '마지막 슬라이드', '감성 상품'],
    sampleHeadlineTones: ['독백형', '편지형', '짧은 선언 후 부드러운 전개'],
    layoutRecommendation: 'magazine',
    visualCues: ['window', 'grain texture', 'centered paragraph', 'small brand signature'],
  },
  {
    id: 'ai_breaking_collab',
    name: 'AI 트렌드 속보형',
    copyFormula: '오늘부터 {entityA} X {entityB}',
    emotions: ['충격', '궁금증', '기대감', '트렌드'],
    bestFor: ['AI 뉴스', '기술', '스타트업', 'B2B SaaS', '업계 동향'],
    sampleHeadlineTones: ['사건성 선언', '협업/공개/시작 중심', '짧고 큰 임팩트'],
    layoutRecommendation: 'breaking-news',
    visualCues: ['two executives', 'AI TREND label', 'large lower-left headline', 'badge'],
  },
  {
    id: 'money_result_brag',
    name: '숫자 성과 자랑형',
    copyFormula: '{method}로 {amount} 벌었다 / 줄였다 / 늘렸다',
    emotions: ['탐욕', '궁금증', '신뢰', 'FOMO'],
    bestFor: ['AI 자동화', '비즈니스', '투자', '부업', '마케팅 사례'],
    sampleHeadlineTones: ['수치 중심', '결과 선언', '매출/비용 절감 전후'],
    layoutRecommendation: 'dark-editorial',
    visualCues: ['money close-up', 'large numeric copy', 'dark gradient'],
  },
  {
    id: 'career_turning_point',
    name: '커리어 전환 서사형',
    copyFormula: '나를 {desired_state}로 이끈 결정적 한 수',
    emotions: ['동기부여', '희망', '증명', '성장'],
    bestFor: ['교육', '부트캠프', '커리어', '취업', '자격증'],
    sampleHeadlineTones: ['개인 서사형', '전환점 중심', '결정적 순간 강조'],
    layoutRecommendation: 'cinematic-headline',
    visualCues: ['person standing', 'career institution background', 'large white text'],
  },
  {
    id: 'market_cap_headline',
    name: '시장 규모 선언형',
    copyFormula: '{entity}이/가 {market_value}를 넘었다. 이제 {meaning}',
    emotions: ['권위', '충격', '거시감', '미래감'],
    bestFor: ['경제', '주식', 'AI 반도체', '산업 분석', 'B2B 리포트'],
    sampleHeadlineTones: ['숫자 선언', '의미 해석', '판이 바뀌는 신호'],
    layoutRecommendation: 'stat-highlight',
    visualCues: ['stock board', 'market chart', 'cyan highlight', 'crowd silhouette'],
  },
  {
    id: 'rescue_breaking_news',
    name: '긴급 구조/사건형',
    copyFormula: '"{quote}" {who} 위해 {action}한 {subject}',
    emotions: ['감동', '긴박감', '휴머니즘', '충격'],
    bestFor: ['뉴스', '사건', '사회', '브랜드 스토리', 'CSR'],
    sampleHeadlineTones: ['직접 인용', '드라마틱 서사', '인간미 강조'],
    layoutRecommendation: 'breaking-news',
    visualCues: ['emergency vehicles', 'quoted headline', 'news logo', 'bottom-left massive text'],
  },
  {
    id: 'long_explainer_photo',
    name: '롱폼 설명형',
    copyFormula: '{문제 상황} + {핵심 수치} + {왜 중요한지} + {해결 방향}',
    emotions: ['이해', '문제의식', '전문성'],
    bestFor: ['B2B', '기술 설명', '정책', '사회 문제', '리포트'],
    sampleHeadlineTones: ['문제 제기', '수치 해석', '리포트형'],
    layoutRecommendation: 'community-style',
    visualCues: ['yellow headline box', 'photojournalistic background', 'highlighted keywords'],
  },
  {
    id: 'finance_product_briefing',
    name: '금융 상품 브리핑형',
    copyFormula: '{icon} {핵심 발표}. 오늘 {entity}가 {what}을 공개했어요.',
    emotions: ['정보성', '신뢰', '뉴스감'],
    bestFor: ['금융', '신제품', '업데이트', 'B2B', 'SaaS 출시'],
    sampleHeadlineTones: ['뉴스형 구어체', '발표 현장감', '간결한 브리핑'],
    layoutRecommendation: 'dark-editorial',
    visualCues: ['conference background', 'speaker podium', 'center text'],
  },
  {
    id: 'social_issue_statement',
    name: '사회 이슈 선언형',
    copyFormula: '{problem}이/가 생각보다 심각합니다',
    emotions: ['문제의식', '불안', '관심'],
    bestFor: ['정책', '공공', '사회문제', 'B2B 문제제기'],
    sampleHeadlineTones: ['사실 선언', '문제 직격', '현장감'],
    layoutRecommendation: 'dark-editorial',
    visualCues: ['realistic street/building', 'large simple headline', 'news editorial'],
  },
]

// ─── CTA Pattern Library ──────────────────────────────────────────────────────

export const CTA_PATTERNS = {
  soft: ['저장해두세요', '나중에 다시 보려고 저장', '비교하기 전에 체크', '필요할 때 꺼내보세요'],
  commerce: ['스토어에서 자세히 보기', '오늘 옵션 확인하기', '후기 먼저 확인하기'],
  community: ['저장 + 공유해요', '이거 알면 주변에 알려주세요', '댓글로 알려주세요'],
  editorial: ['저장해두고 나중에 꺼내보세요', '오늘 하나만 기억하세요', '이 기준으로 다시 보면'],
  avoid: ['지금 바로 구매하세요!!!', '놓치지 마세요!!!', '클릭하세요'],
}

// ─── System-wide banned phrases ───────────────────────────────────────────────

export const SYSTEM_BANNED_PHRASES = [
  '이번 시즌 핫 트렌드',
  '특별한 가치',
  '독특한 디자인',
  '더 많은 팁 확인',
  '더 많은 스타일 팁',
  '여러분의 일상',
  '함께하는 특별한',
  '새로운 차원의',
  '혁신적인',
  '최고의',
  '완벽한',
  '고객에게 특별한',
  '독특한 패턴',
  '스마트스토어 기준으로',
]

// ─── Accessors ────────────────────────────────────────────────────────────────

export function getHookPatterns(): HookPattern[] {
  return HOOK_PATTERNS
}

export function getPersonaProfiles(): PersonaProfile[] {
  return PERSONA_PROFILES
}

export function getNarrativeArcs(): NarrativeArc[] {
  return NARRATIVE_ARCS
}

export function getIndustryToneRules(): IndustryToneRule[] {
  return INDUSTRY_TONE_RULES
}

export function getEmotionalIntentProfiles(): EmotionalIntentProfile[] {
  return EMOTIONAL_INTENT_PROFILES
}

// ─── Industry Detection ───────────────────────────────────────────────────────

const INDUSTRY_KEYWORD_MAP: Record<IndustryCategory, string[]> = {
  beauty_skincare: ['뷰티', '스킨케어', '화장품', '피부', '코스메틱', '메이크업', 'beauty', 'skincare', 'cosmetic'],
  food_beverage: ['식품', '음료', '카페', '음식', '요리', '베이커리', '커피', '식당', 'food', 'beverage'],
  fashion_lifestyle: ['패션', '의류', '라이프스타일', '액세서리', '인테리어', '홈', 'fashion', 'lifestyle'],
  health_wellness: ['건강', '헬스', '웰니스', '피트니스', '영양', '운동', '보건', 'health', 'wellness', 'fitness'],
  tech_digital: ['IT', '기술', '앱', '소프트웨어', '디지털', '전자', 'tech', 'digital', 'software', 'app'],
  education_content: ['교육', '학습', '강의', '콘텐츠', '미디어', '출판', 'education', 'content', 'learning'],
}

function detectIndustry(industryText: string): IndustryCategory | null {
  const lower = industryText.toLowerCase()
  for (const [category, keywords] of Object.entries(INDUSTRY_KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return category as IndustryCategory
    }
  }
  return null
}

// ─── Context Builder ──────────────────────────────────────────────────────────

export function buildCopyKnowledgeContext(params: {
  brand: BrandProfile
  input: CampaignInput
  strategy: ContentStrategy
  selectedHook?: HookCandidate
  personaOverride?: PersonaId
  referencePatterns?: IngestedReferencePattern[]
}): CopyKnowledgeContext {
  const { brand, input, strategy, selectedHook, personaOverride, referencePatterns = [] } = params

  // 1. Detect industry
  const detectedIndustry = detectIndustry(brand.industry)
  const industryToneRule = detectedIndustry
    ? INDUSTRY_TONE_RULES.find(r => r.industry === detectedIndustry) ?? null
    : null

  // 2. Infer persona
  const personaProfile = personaOverride
    ? (PERSONA_PROFILES.find(p => p.id === personaOverride) ?? inferPersonaFromBrand(brand, input))
    : inferPersonaFromBrand(brand, input)

  // 3. Select narrative arc
  const narrativeArc = selectArcForStrategy(strategy, personaProfile)

  // 4. Select hook patterns (top 3)
  const selectedHookPatterns = selectHookPatterns(selectedHook, strategy, industryToneRule, personaProfile)

  // 5. Pick emotional intent profile matching the top hook pattern
  const primaryPattern = selectedHookPatterns[0]
  const emotionalIntentProfile =
    EMOTIONAL_INTENT_PROFILES.find(p => p.intent === primaryPattern?.emotionalTrigger) ??
    EMOTIONAL_INTENT_PROFILES.find(p => p.intent === 'curiosity')!

  // 6. Merge banned phrases
  const brandForbidden = brand.forbiddenWords
    ? brand.forbiddenWords.split(',').map(w => w.trim()).filter(Boolean)
    : []
  const industryBanned = industryToneRule?.additionalBannedPhrases ?? []
  const resolvedBannedPhrases = Array.from(
    new Set([...SYSTEM_BANNED_PHRASES, ...industryBanned, ...brandForbidden])
  )

  // 7. Select editorial cluster
  const editorialCluster = selectEditorialCluster(brand, input, strategy, narrativeArc)

  return {
    selectedHookPatterns,
    personaProfile,
    narrativeArc,
    emotionalIntentProfile,
    industryToneRule,
    referencePatterns,
    resolvedBannedPhrases,
    editorialCluster,
  }
}

function inferPersonaFromBrand(brand: BrandProfile, input: CampaignInput): PersonaProfile {
  const audience = (brand.targetAudience ?? '').toLowerCase()
  const objective = (input.objective ?? '').toLowerCase()
  const industry = (brand.industry ?? '').toLowerCase()
  const tone = (brand.toneOfVoice ?? '').toLowerCase()

  const scores: Record<PersonaId, number> = {
    practical_saver: 0,
    trend_curator: 0,
    informed_professional: 0,
    lifestyle_aspirant: 0,
    community_sharer: 0,
  }

  if (/30대|육아|맘|주부|가성비|실용/.test(audience)) scores.practical_saver += 3
  if (/20대|학생|감성|무드/.test(audience)) scores.trend_curator += 3
  if (/직장|전문|b2b|정보|비즈니스/.test(audience + objective)) scores.informed_professional += 3
  if (/라이프|자기개발|성장|루틴/.test(audience + objective)) scores.lifestyle_aspirant += 3
  if (/커뮤니티|sns|인플루언서|공유/.test(industry + audience)) scores.community_sharer += 3

  if (/감성|무드/.test(tone)) scores.trend_curator += 1
  if (/전문|신뢰|정확/.test(tone)) scores.informed_professional += 1

  const sorted = (Object.entries(scores) as [PersonaId, number][]).sort((a, b) => b[1] - a[1])
  const topId = sorted[0][0]

  return PERSONA_PROFILES.find(p => p.id === topId) ?? PERSONA_PROFILES[0]
}

function selectArcForStrategy(strategy: ContentStrategy, persona: PersonaProfile): NarrativeArc {
  const strategyType = strategy.strategyType
  const slideCount = strategy.recommendedSlideCount

  // Direct strategy mappings
  if (strategyType === 'problem_solution') {
    return NARRATIVE_ARCS.find(a => a.id === 'problem_twist_solution')!
  }
  if (strategyType === 'checklist') {
    return NARRATIVE_ARCS.find(a => a.id === 'checklist_save')!
  }
  if (strategyType === 'comparison') {
    return NARRATIVE_ARCS.find(a => a.id === 'belief_challenge')!
  }
  if (strategyType === 'storytelling' || strategyType === 'review_style') {
    // Use slide count to pick between two arcs
    if (slideCount >= 6) {
      return NARRATIVE_ARCS.find(a => a.id === 'before_after_proof')!
    }
    return NARRATIVE_ARCS.find(a => a.id === 'mini_story_cta')!
  }
  if (strategyType === 'benefit_focused' || strategyType === 'seasonal' || strategyType === 'discount') {
    return NARRATIVE_ARCS.find(a => a.id === 'mini_story_cta')!
  }

  // Fall back to persona preference
  return NARRATIVE_ARCS.find(a => a.id === persona.preferredNarrativeArc) ??
    NARRATIVE_ARCS.find(a => a.id === 'problem_twist_solution')!
}

function selectHookPatterns(
  selectedHook: HookCandidate | undefined,
  strategy: ContentStrategy,
  industryToneRule: IndustryToneRule | null,
  persona: PersonaProfile
): HookPattern[] {
  const preferredIds = new Set<HookPatternId>([
    ...persona.preferredHookPatterns,
    ...(industryToneRule?.preferredPatterns ?? []),
  ])
  const avoidIds = new Set<HookPatternId>(industryToneRule?.avoidPatterns ?? [])

  // Score patterns
  const scored = HOOK_PATTERNS
    .filter(p => !avoidIds.has(p.id))
    .map(p => {
      let score = p.scoreWeight
      if (preferredIds.has(p.id)) score += 3
      if (selectedHook && p.hookType === selectedHook.type) score += 2
      // Strategy alignment
      if (strategy.strategyType === 'comparison' && p.hookType === 'comparison') score += 2
      if (strategy.strategyType === 'review_style' && p.hookType === 'social_proof') score += 2
      if (strategy.strategyType === 'benefit_focused' && p.hookType === 'benefit') score += 2
      if (strategy.strategyType === 'problem_solution' && p.hookType === 'pain_point') score += 2
      return { pattern: p, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 3).map(s => s.pattern)
}

function selectEditorialCluster(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy,
  arc: NarrativeArc
): EditorialStyleCluster | null {
  const industry = (brand.industry ?? '').toLowerCase()
  const objective = (input.objective ?? '').toLowerCase()
  const productDesc = (input.productDescription ?? '').toLowerCase()
  const tone = (brand.toneOfVoice ?? '').toLowerCase()
  const strategyType = strategy.strategyType

  const scores: Partial<Record<EditorialClusterId, number>> = {}

  const add = (id: EditorialClusterId, n: number) => {
    scores[id] = (scores[id] ?? 0) + n
  }

  // 숫자/수치 중심 콘텐츠 → 숫자 성과형 또는 시장규모 선언형
  if (/\d+%|\d+만|\d+억|수치|성과|매출|절감/.test(productDesc + objective)) {
    add('money_result_brag', 3)
    add('market_cap_headline', 2)
  }
  // AI/기술/스타트업 업종
  if (/ai|기술|스타트업|saas|b2b|소프트웨어|앱|플랫폼/.test(industry + objective)) {
    add('ai_breaking_collab', 3)
    add('finance_product_briefing', 2)
  }
  // 금융/투자/재테크
  if (/금융|투자|재테크|주식|부동산|절약|절세/.test(industry + objective + productDesc)) {
    add('personal_finance_confession', 3)
    add('market_cap_headline', 2)
  }
  // 커리어/교육/자기계발
  if (/교육|취업|커리어|부트캠프|자격증|성장|자기계발/.test(industry + objective)) {
    add('career_turning_point', 3)
  }
  // 사회이슈/정책/공공
  if (/사회|정책|공공|환경|이슈|문제/.test(industry + objective)) {
    add('social_issue_statement', 3)
    add('rescue_breaking_news', 1)
  }
  // B2B/리포트/분석
  if (/b2b|리포트|분석|업계|동향|백서/.test(industry + objective)) {
    add('long_explainer_photo', 3)
    add('finance_product_briefing', 2)
  }
  // 브랜드 스토리 / 감성 / 라이프스타일
  if (/브랜드|스토리|감성|라이프|뷰티|패션|음식|여행/.test(industry + tone)) {
    add('essay_closing_slide', 3)
  }
  // narrative arc 보정: before_after 계열은 confession형과 잘 맞음
  if (arc.id === 'before_after_proof') add('personal_finance_confession', 2)
  if (arc.id === 'mini_story_cta') add('essay_closing_slide', 2)
  if (arc.id === 'belief_challenge') add('social_issue_statement', 2)
  // strategy 보정
  if (strategyType === 'review_style') add('money_result_brag', 2)
  if (strategyType === 'storytelling') add('career_turning_point', 2)
  if (strategyType === 'comparison') add('long_explainer_photo', 2)

  const sorted = (Object.entries(scores) as [EditorialClusterId, number][]).sort((a, b) => b[1] - a[1])
  if (!sorted.length || sorted[0][1] < 2) return null

  return EDITORIAL_CLUSTERS.find(c => c.id === sorted[0][0]) ?? null
}

export function formatKnowledgeContextForPrompt(ctx: CopyKnowledgeContext): string {
  const primaryPattern = ctx.selectedHookPatterns[0]
  const bannedSample = ctx.resolvedBannedPhrases.slice(0, 6).join(', ')
  const toneHints = ctx.personaProfile.copyToneHints.slice(0, 2).join(', ')

  const lines: string[] = [
    '[카피 인텔리전스]',
  ]

  if (primaryPattern) {
    lines.push(`훅 패턴: ${primaryPattern.id} — 템플릿 "${primaryPattern.templateKr}" / 감성: ${primaryPattern.emotionalTrigger}`)
  }

  lines.push(`페르소나: ${ctx.personaProfile.id} — ${ctx.personaProfile.coreMotivation}. ${toneHints}`)
  lines.push(`서사 구조: ${ctx.narrativeArc.id} — ${ctx.narrativeArc.label}. 각 슬라이드는 다음을 궁금하게 끝낼 것`)

  if (ctx.industryToneRule) {
    lines.push(`업종 어조(${ctx.industryToneRule.industry}): ${ctx.industryToneRule.copyPersonality}. CTA: ${ctx.industryToneRule.ctaStyle}`)
  }

  if (ctx.editorialCluster) {
    lines.push(`에디토리얼 스타일: ${ctx.editorialCluster.name} — 공식 "${ctx.editorialCluster.copyFormula}" / 헤드라인 톤: ${ctx.editorialCluster.sampleHeadlineTones.slice(0, 2).join(', ')}`)
  }

  lines.push(`추가 금지: ${bannedSample}`)

  const result = lines.join('\n')
  // Hard cap at 650 chars (editorial cluster adds ~150 chars)
  return result.length > 650 ? result.slice(0, 647) + '...' : result
}

// ─── Reference Ingestion ──────────────────────────────────────────────────────

export async function ingestReferencePattern(
  source: { type: 'url' | 'image_url'; value: string },
  client: LLMClient,
  model: string
): Promise<IngestedReferencePattern> {
  const fallback = (): IngestedReferencePattern => ({
    sourceType: source.type,
    analyzedAt: new Date().toISOString(),
    headlineStyle: '짧은 의문문',
    emotionalTrigger: 'curiosity',
    detectedHookPattern: 'question_loop',
    slideRole: 'hook',
    layoutType: '텍스트 중앙 배치',
    copyTone: '간결하고 직접적',
    extractedPatternNotes: '패턴 분석 실패 — 기본값 적용',
  })

  const hookPatternIds = HOOK_PATTERNS.map(p => p.id).join('|')
  const slideRoles = ['hook', 'problem', 'cause', 'common_mistake', 'product_solution', 'feature', 'feature_1', 'feature_2', 'benefit_or_proof', 'proof', 'offer', 'cta'].join('|')
  const emotionalIntents = ['fomo', 'curiosity', 'empathy', 'aspiration', 'relief', 'belonging', 'validation', 'disgust'].join('|')

  const prompt = `다음 참조 콘텐츠를 분석하고 카피 패턴 메타데이터만 추출하세요.
원문 텍스트를 복사하지 마세요. 패턴, 구조, 감성만 기술하세요.

[source: ${source.type}]
${source.value}

다음 JSON 형식으로 응답:
{
  "headlineStyle": "패턴 설명 (예: 짧은 의문문 + 숫자)",
  "emotionalTrigger": "${emotionalIntents} 중 하나",
  "detectedHookPattern": "${hookPatternIds} 중 하나",
  "slideRole": "${slideRoles} 중 하나",
  "layoutType": "텍스트 위치·비율 특성",
  "copyTone": "건조하고 직접적 / 감성적 / 정보 밀도 높음 등",
  "extractedPatternNotes": "패턴 관찰 메모 (원문 없이, 50자 이내)"
}`

  const result = await client.generateJson<{
    headlineStyle: string
    emotionalTrigger: string
    detectedHookPattern: string
    slideRole: string
    layoutType: string
    copyTone: string
    extractedPatternNotes: string
  }>(
    'reference pattern ingestion',
    prompt,
    fallback,
    { model, temperature: 0.2, systemPrompt: '당신은 인스타그램 카드뉴스 패턴 분석가입니다. 원문 텍스트를 절대 복사하지 말고 카피 패턴, 감성 트리거, 훅 유형, 레이아웃 특성만 메타데이터로 추출하세요. 유효한 JSON으로만 응답하세요.' }
  )

  if (!result || typeof result.headlineStyle !== 'string') return fallback()

  return {
    sourceType: source.type,
    analyzedAt: new Date().toISOString(),
    headlineStyle: result.headlineStyle || fallback().headlineStyle,
    emotionalTrigger: (result.emotionalTrigger as EmotionalIntent) || 'curiosity',
    detectedHookPattern: (result.detectedHookPattern as HookPatternId) || 'question_loop',
    slideRole: (result.slideRole as SlideRole) || 'hook',
    layoutType: result.layoutType || fallback().layoutType,
    copyTone: result.copyTone || fallback().copyTone,
    extractedPatternNotes: result.extractedPatternNotes || fallback().extractedPatternNotes,
  }
}
