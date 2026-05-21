import type { BrandProfile, CampaignInput, ContentStrategy, HookCandidate, HookType } from './types'

const HOOKS: { text: string; type: HookType; baseScore: number }[] = [
  { text: '사기 전에 꼭 보세요', type: 'curiosity', baseScore: 92 },
  { text: '왜 이제 알았지?', type: 'curiosity', baseScore: 85 },
  { text: '이거 하나로 정리 끝', type: 'benefit', baseScore: 88 },
  { text: '후기 좋은 이유 있음', type: 'social_proof', baseScore: 84 },
  { text: '비슷해도 다릅니다', type: 'comparison', baseScore: 82 },
]

export async function generateHooks(
  brand: BrandProfile,
  input: CampaignInput,
  strategy: ContentStrategy
): Promise<HookCandidate[]> {
  return HOOKS.map((hook, index) => ({
    text: fitTwentyChars(hook.text),
    type: hook.type,
    score: hook.baseScore + scoreBoost(hook.type, strategy.strategyType) - index,
    reason: `${brand.targetAudience}에게 ${input.productName} 구매 전 확인할 이유를 짧게 제시합니다.`,
  }))
}

export function selectBestHook(hooks: HookCandidate[]): HookCandidate {
  if (hooks.length === 0) {
    return {
      text: '사기 전에 꼭 보세요',
      type: 'curiosity',
      score: 80,
      reason: '기본 구매 전환형 Hook입니다.',
    }
  }
  return [...hooks].sort((a, b) => b.score - a.score)[0]
}

function scoreBoost(hookType: HookType, strategyType: ContentStrategy['strategyType']) {
  if (strategyType === 'comparison' && hookType === 'comparison') return 8
  if (strategyType === 'review_style' && hookType === 'social_proof') return 8
  if (strategyType === 'benefit_focused' && hookType === 'benefit') return 8
  return 0
}

function fitTwentyChars(text: string) {
  return text.length > 20 ? text.slice(0, 20) : text
}
