import type { CarouselStructure, ContentStrategy, HookCandidate, SlideRole } from './types'

const PURPOSES: Record<SlideRole, string> = {
  hook: '스크롤을 멈추게 하는 첫 메시지',
  problem: '고객이 겪는 불편을 구체화',
  cause: '문제가 반복되는 원인을 설명',
  common_mistake: '구매 전 흔한 실수를 짚음',
  product_solution: '상품을 해결책으로 연결',
  feature: '핵심 기능을 쉽게 설명',
  feature_1: '첫 번째 핵심 기능 설명',
  feature_2: '두 번째 핵심 기능 설명',
  benefit_or_proof: '혜택 또는 신뢰 근거 제시',
  proof: '후기, 사용 장면, 신뢰 요소 제시',
  offer: '혜택 또는 제안을 정리',
  cta: '저장, 문의, 구매 행동 유도',
}

export async function generateStructure(
  strategy: ContentStrategy,
  selectedHook: HookCandidate,
  slideCount: number
): Promise<CarouselStructure> {
  const roles = getRoles(slideCount)
  return {
    slides: roles.map((role, index) => ({
      slideNumber: index + 1,
      role,
      purpose: index === 0 ? `${PURPOSES.hook}: ${selectedHook.text}` : `${PURPOSES[role]} (${strategy.strategyType})`,
    })),
  }
}

function getRoles(slideCount: number): SlideRole[] {
  if (slideCount >= 10) {
    return ['hook', 'problem', 'cause', 'common_mistake', 'product_solution', 'feature_1', 'feature_2', 'proof', 'offer', 'cta']
  }
  if (slideCount >= 7) {
    return ['hook', 'problem', 'cause', 'product_solution', 'feature', 'proof', 'cta']
  }
  return ['hook', 'problem', 'product_solution', 'benefit_or_proof', 'cta']
}
