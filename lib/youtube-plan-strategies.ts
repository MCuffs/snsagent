import type { ShortsClassifierResult } from './youtube-shorts-templates/types'

export const PLAN_STRATEGY_KEYS = [
  'curiosity_reveal',
  'breaking_context',
  'before_after',
  'countdown',
  'myth_fact',
  'scene_analysis',
  'conflict_resolution',
  'comment_reaction',
  'rapid_facts',
  'story_arc',
] as const

export type PlanStrategyKey = (typeof PLAN_STRATEGY_KEYS)[number]

export interface YouTubePlanStrategy {
  key: PlanStrategyKey
  name: string
  contentTypes: ShortsClassifierResult['contentType'][]
  tones: ShortsClassifierResult['tone'][]
  hookPattern: string
  endingPattern: string
  sceneRoles: string[]
  targetSceneCount: number
  narrationStyle: string
  pacing: 'accelerating' | 'balanced' | 'fast' | 'cinematic'
}

export const YOUTUBE_PLAN_STRATEGIES: YouTubePlanStrategy[] = [
  {
    key: 'curiosity_reveal',
    name: '호기심 공개',
    contentTypes: ['knowledge', 'entertainment', 'default'],
    tones: ['informative', 'dramatic', 'neutral'],
    hookPattern: '답을 숨긴 강한 질문',
    endingPattern: '마지막 장면에서 핵심 답 공개',
    sceneRoles: ['question_hook', 'unexpected_clue', 'context', 'second_clue', 'reveal', 'takeaway', 'cta'],
    targetSceneCount: 7,
    narrationStyle: 'Delay the answer and increase curiosity with each scene.',
    pacing: 'accelerating',
  },
  {
    key: 'breaking_context',
    name: '속보 맥락',
    contentTypes: ['news', 'sports'],
    tones: ['serious', 'informative'],
    hookPattern: '가장 충격적인 사실 선공개',
    endingPattern: '앞으로의 영향과 관전 포인트',
    sceneRoles: ['breaking_hook', 'what_happened', 'key_quote', 'background', 'why_it_matters', 'impact', 'outlook'],
    targetSceneCount: 7,
    narrationStyle: 'Lead with the event, then add only the context needed to understand its impact.',
    pacing: 'fast',
  },
  {
    key: 'before_after',
    name: '비포 애프터',
    contentTypes: ['knowledge', 'sports', 'entertainment'],
    tones: ['informative', 'dramatic'],
    hookPattern: '변화 전후의 극적인 차이',
    endingPattern: '변화를 만든 한 가지 원인',
    sceneRoles: ['after_hook', 'before_state', 'problem', 'turning_point', 'change_process', 'after_state', 'lesson'],
    targetSceneCount: 7,
    narrationStyle: 'Contrast before and after states with a clear turning point.',
    pacing: 'balanced',
  },
  {
    key: 'countdown',
    name: '카운트다운',
    contentTypes: ['knowledge', 'sports', 'anime', 'entertainment'],
    tones: ['funny', 'informative', 'dramatic'],
    hookPattern: '마지막 순위를 기대하게 만드는 예고',
    endingPattern: '1위 공개와 짧은 반응',
    sceneRoles: ['ranking_hook', 'rank_3', 'rank_3_reason', 'rank_2', 'rank_2_reason', 'rank_1', 'rank_1_reason', 'cta'],
    targetSceneCount: 8,
    narrationStyle: 'Use a descending countdown and make each item stronger than the previous one.',
    pacing: 'accelerating',
  },
  {
    key: 'myth_fact',
    name: '오해와 사실',
    contentTypes: ['knowledge', 'news', 'sports'],
    tones: ['informative', 'serious'],
    hookPattern: '널리 알려진 통념을 즉시 부정',
    endingPattern: '정확한 사실 한 문장 요약',
    sceneRoles: ['myth_hook', 'common_belief', 'contradiction', 'evidence_1', 'evidence_2', 'fact_reveal', 'practical_takeaway'],
    targetSceneCount: 7,
    narrationStyle: 'State the misconception clearly, then replace it with evidence.',
    pacing: 'balanced',
  },
  {
    key: 'scene_analysis',
    name: '장면 분석',
    contentTypes: ['drama_highlight', 'anime'],
    tones: ['emotional', 'dramatic', 'informative'],
    hookPattern: '모두가 지나친 장면의 의미',
    endingPattern: '장면을 다시 보게 만드는 해석',
    sceneRoles: ['scene_hook', 'surface_action', 'visual_detail', 'character_motive', 'hidden_clue', 'meaning_reveal', 'rewatch_prompt'],
    targetSceneCount: 7,
    narrationStyle: 'Analyze one scene through details, motive, clue, and meaning.',
    pacing: 'cinematic',
  },
  {
    key: 'conflict_resolution',
    name: '갈등 해결',
    contentTypes: ['drama_highlight', 'anime', 'entertainment'],
    tones: ['dramatic', 'emotional'],
    hookPattern: '갈등이 폭발한 순간 선공개',
    endingPattern: '해결 또는 감정적 여운',
    sceneRoles: ['conflict_hook', 'characters', 'trigger', 'escalation', 'lowest_point', 'resolution', 'aftermath'],
    targetSceneCount: 7,
    narrationStyle: 'Build conflict, escalate it, then resolve with emotional consequence.',
    pacing: 'cinematic',
  },
  {
    key: 'comment_reaction',
    name: '댓글 검증',
    contentTypes: ['news', 'knowledge', 'entertainment', 'sports'],
    tones: ['funny', 'informative', 'serious'],
    hookPattern: '논쟁적인 댓글 또는 주장 제시',
    endingPattern: '검증 결과와 시청자 질문',
    sceneRoles: ['comment_hook', 'claim', 'first_reaction', 'fact_check', 'counterpoint', 'verdict', 'audience_question'],
    targetSceneCount: 7,
    narrationStyle: 'Present a provocative claim, test it fairly, and deliver a clear verdict.',
    pacing: 'fast',
  },
  {
    key: 'rapid_facts',
    name: '연속 팩트',
    contentTypes: ['knowledge', 'sports', 'news', 'default'],
    tones: ['informative', 'neutral'],
    hookPattern: '짧고 강한 숫자 또는 사실',
    endingPattern: '가장 중요한 팩트 재강조',
    sceneRoles: ['fact_hook', 'fact_1', 'fact_2', 'fact_3', 'fact_4', 'surprising_fact', 'summary'],
    targetSceneCount: 7,
    narrationStyle: 'Deliver one self-contained fact per scene with no filler.',
    pacing: 'fast',
  },
  {
    key: 'story_arc',
    name: '스토리 아크',
    contentTypes: ['drama_highlight', 'anime', 'sports', 'entertainment', 'default'],
    tones: ['emotional', 'dramatic', 'neutral'],
    hookPattern: '결말 직전의 장면 선공개',
    endingPattern: '결과와 인물의 변화',
    sceneRoles: ['outcome_hook', 'character_intro', 'goal', 'obstacle', 'decision', 'climax', 'outcome', 'meaning'],
    targetSceneCount: 8,
    narrationStyle: 'Tell a complete miniature story with a goal, obstacle, decision, and consequence.',
    pacing: 'cinematic',
  },
]

export function selectPlanStrategy(params: {
  classification: ShortsClassifierResult | null
  recentKeys: string[]
  seed: string
}) {
  const contentType = params.classification?.contentType ?? 'default'
  const tone = params.classification?.tone ?? 'neutral'
  const recent = new Set(params.recentKeys.slice(0, 5))
  const scored = YOUTUBE_PLAN_STRATEGIES.map(strategy => {
    let score = strategy.contentTypes.includes(contentType) ? 40 : 0
    if (strategy.tones.includes(tone)) score += 12
    if (recent.has(strategy.key)) score -= 50
    score += stableHash(`${params.seed}:${strategy.key}`) % 17
    return { strategy, score }
  }).sort((a, b) => b.score - a.score)
  return scored[0].strategy
}

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}
