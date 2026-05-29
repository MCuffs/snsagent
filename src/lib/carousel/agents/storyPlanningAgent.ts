import type { SlideRole } from '../types'
import type { NarrativeMemory, EmotionalBeat, EmotionType } from '../narrativeMemory'

const ROLE_EMOTION_MAP: Record<SlideRole, { emotion: EmotionType; intensity: number; transitionHint: string }> = {
  hook:              { emotion: 'curiosity',   intensity: 8, transitionHint: '강렬한 의문이나 반전으로 시작해 다음 슬라이드를 보고 싶게 끝낼 것' },
  problem:           { emotion: 'empathy',     intensity: 7, transitionHint: '독자의 고통에 공감하며 "왜 이런 일이 생기는가"로 연결' },
  cause:             { emotion: 'tension',     intensity: 8, transitionHint: '문제의 원인을 드러내 긴장감을 높이고 해결을 암시할 것' },
  common_mistake:    { emotion: 'tension',     intensity: 7, transitionHint: '흔한 실수를 짚어 독자가 "나도 이랬다"고 느끼게 끝낼 것' },
  product_solution:  { emotion: 'insight',     intensity: 7, transitionHint: '해결책을 제시하며 "이런 방법이 있었구나"의 통찰로 연결' },
  feature:           { emotion: 'insight',     intensity: 6, transitionHint: '핵심 기능을 구체적으로 보여주고 다음 혜택으로 넘길 것' },
  feature_1:         { emotion: 'insight',     intensity: 6, transitionHint: '첫 번째 특징을 명확히 전달하고 두 번째로 연결' },
  feature_2:         { emotion: 'insight',     intensity: 6, transitionHint: '두 번째 특징으로 기능 전달을 마무리하고 혜택으로 넘길 것' },
  benefit_or_proof:  { emotion: 'relief',      intensity: 6, transitionHint: '실제 변화를 보여주며 독자에게 "나도 될 수 있다"는 안도감 전달' },
  proof:             { emotion: 'relief',      intensity: 5, transitionHint: '근거와 증거로 신뢰를 완성하고 행동 유도로 넘길 것' },
  offer:             { emotion: 'aspiration',  intensity: 8, transitionHint: '기회를 구체화하며 욕망을 자극하고 CTA로 연결' },
  cta:               { emotion: 'conversion',  intensity: 9, transitionHint: '지금 행동해야 하는 이유를 명확하게 제시하며 마무리' },
}

export function buildEmotionalArc(memory: NarrativeMemory): EmotionalBeat[] {
  return memory.structure.slides.map(slide => {
    const config = ROLE_EMOTION_MAP[slide.role] ?? { emotion: 'insight' as EmotionType, intensity: 6, transitionHint: '핵심 메시지 전달 후 다음으로 연결' }
    return {
      slideNumber: slide.slideNumber,
      emotion: config.emotion,
      intensity: config.intensity,
      transitionHint: config.transitionHint,
    }
  })
}
