import { getCopywritingModel, getLLMClient } from '../../ai/llmClient'
import type { NarrativeMemory, SlidePlan } from '../narrativeMemory'
import { formatKnowledgeContextForPrompt } from '../../copywriting/copyKnowledgeBase'

const ROLE_DEFAULT_GOALS: Record<string, { emotionalGoal: string; narrativePurpose: string }> = {
  hook:             { emotionalGoal: '강렬한 호기심을 자극해 스크롤을 멈추게 함', narrativePurpose: '전체 서사의 첫 단추 — 독자를 이야기 안으로 끌어들임' },
  problem:          { emotionalGoal: '독자의 공감과 불편함을 건드림', narrativePurpose: '훅의 궁금증을 구체적 문제로 풀어냄' },
  cause:            { emotionalGoal: '문제의 근본 원인을 드러내 긴장감 형성', narrativePurpose: '문제 슬라이드에서 이어진 "왜?"에 답함' },
  common_mistake:   { emotionalGoal: '"나도 이랬다"는 자기 인식 유발', narrativePurpose: '문제/원인 이후 독자의 행동 패턴을 지목함' },
  product_solution: { emotionalGoal: '"이런 방법이 있었구나"의 통찰과 안도', narrativePurpose: '긴장을 해소하며 브랜드 해결책을 처음 제시함' },
  feature:          { emotionalGoal: '핵심 기능의 구체성으로 신뢰 형성', narrativePurpose: '솔루션의 작동 방식을 보여줌' },
  feature_1:        { emotionalGoal: '첫 번째 차별점에 대한 기대감 형성', narrativePurpose: '솔루션의 첫 번째 구체적 근거를 제시함' },
  feature_2:        { emotionalGoal: '두 번째 차별점으로 신뢰를 쌓음', narrativePurpose: '솔루션의 두 번째 근거로 신뢰를 완성함' },
  benefit_or_proof: { emotionalGoal: '"나도 이렇게 될 수 있다"는 안도와 열망', narrativePurpose: '기능에서 실제 삶의 변화로 전환함' },
  proof:            { emotionalGoal: '사회적 증거로 구매 저항을 낮춤', narrativePurpose: '주장을 사실로 뒷받침하는 근거를 제공함' },
  offer:            { emotionalGoal: '지금 행동해야 한다는 욕망과 기회 인식', narrativePurpose: '혜택을 구체적 기회로 전환하며 행동을 준비시킴' },
  cta:              { emotionalGoal: '지금 당장 행동하게 만드는 전환 모멘텀', narrativePurpose: '서사를 마무리하고 독자를 다음 행동으로 안내함' },
}

function buildFallbackSlidePlan(memory: NarrativeMemory): SlidePlan[] {
  return memory.structure.slides.map((slide, i) => {
    const defaults = ROLE_DEFAULT_GOALS[slide.role] ?? {
      emotionalGoal: '핵심 메시지를 전달함',
      narrativePurpose: '이전 슬라이드와 연결하여 내용을 발전시킴',
    }
    const forbidConcepts = memory.structure.slides
      .slice(0, i)
      .map(s => s.purpose)
      .filter(Boolean)
    return {
      slideNumber: slide.slideNumber,
      role: slide.role,
      emotionalGoal: defaults.emotionalGoal,
      narrativePurpose: defaults.narrativePurpose,
      forbidConcepts,
    }
  })
}

export async function runDirectorAgent(memory: NarrativeMemory): Promise<SlidePlan[]> {
  const client = getLLMClient()

  const slideList = memory.structure.slides
    .map(s => `  슬라이드${s.slideNumber}[${s.role}]: ${s.purpose}`)
    .join('\n')

  const knowledgeSection = formatKnowledgeContextForPrompt(memory.knowledgeCtx)
  const editorialCluster = memory.knowledgeCtx.editorialCluster
  const clusterLine = editorialCluster
    ? `에디토리얼 스타일: ${editorialCluster.name} — 공식 "${editorialCluster.copyFormula}"`
    : ''

  const prompt = `당신은 한국 SNS 카드뉴스 크리에이티브 디렉터입니다.
아래 브랜드와 슬라이드 구조를 바탕으로 각 슬라이드의 서사 역할을 구체적으로 설계하세요.

브랜드: ${memory.brand.name} (${memory.brand.industry})
상품: ${memory.input.productName}
캠페인 목표: ${memory.input.objective}
선택된 훅: "${memory.selectedHook.text}"
${clusterLine}

${knowledgeSection}

슬라이드 구성:
${slideList}

각 슬라이드가 이전 슬라이드에서 무엇을 받아 어디로 넘기는지를 중심으로 설계하세요.
슬라이드들이 하나의 이야기처럼 연결되어야 합니다.
같은 키워드나 개념이 반복되지 않도록 forbidConcepts를 채우세요.

JSON 응답 형식:
{
  "slidePlan": [
    {
      "slideNumber": 1,
      "role": "hook",
      "emotionalGoal": "이 슬라이드가 독자에게 일으켜야 할 감정 (20자 이내)",
      "narrativePurpose": "이전 슬라이드를 받아 다음으로 넘기는 서사적 역할 (30자 이내)",
      "forbidConcepts": ["이전 슬라이드가 이미 다룬 개념1", "개념2"]
    }
  ]
}`

  const result = await client.generateJson<{ slidePlan: SlidePlan[] }>(
    'director-agent',
    prompt,
    () => ({ slidePlan: buildFallbackSlidePlan(memory) }),
    { model: getCopywritingModel(), temperature: 0.3 }
  )

  const plan = result?.slidePlan
  if (!Array.isArray(plan) || plan.length === 0) {
    return buildFallbackSlidePlan(memory)
  }

  // Merge with structure to ensure all slides are covered
  const planMap = new Map(plan.map(p => [p.slideNumber, p]))
  return memory.structure.slides.map(slide => {
    const p = planMap.get(slide.slideNumber)
    if (p && p.emotionalGoal && p.narrativePurpose) return { ...p, role: slide.role }
    const fallback = buildFallbackSlidePlan(memory).find(f => f.slideNumber === slide.slideNumber)!
    return fallback
  })
}
