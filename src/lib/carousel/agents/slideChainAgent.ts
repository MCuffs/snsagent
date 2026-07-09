import { getLLMClient, getTextGenerationModel } from '../../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'
import { formatKnowledgeContextForPrompt } from '../../copywriting/copyKnowledgeBase'
import { buildAntiPatternRule, buildHeadlineStyleGuidance, buildBodyStyleGuidance } from '../../copywriting/copyStyleRules'
import { repairRenderableCopy } from '../../copywriting/renderableCopy'
import type { SlideCopy, SlideRole } from '../types'
import type { NarrativeMemory, CompletedSlide } from '../narrativeMemory'
import { appendCompletedSlide } from '../narrativeMemory'

const ROLE_SYSTEM_PROMPT: Partial<Record<SlideRole, string>> = {
  hook:            '당신은 SNS 스크롤을 멈추게 하는 훅 카피 전문가입니다. 강렬한 호기심과 반전을 중심으로 쓰세요. 에디토리얼 톤을 유지하면서 날카롭게 쓰세요.',
  problem:         '당신은 독자의 공감을 끌어내는 문제 제기 카피라이터입니다. 독자가 "맞아, 나도 그래"라고 느끼게 쓰세요. 구체적 상황과 통찰로 접근하세요.',
  cause:           '당신은 문제의 숨겨진 원인을 드러내는 카피라이터입니다. 긴장감 있게 "왜"를 밝히세요. 정보 나열이 아니라 통찰을 전달하세요.',
  common_mistake:  '당신은 독자의 실수 패턴을 짚어내는 카피라이터입니다. "나도 이랬다"는 자기 인식을 유발하세요. 구체적 상황을 묘사하세요.',
  product_solution:'당신은 통찰과 안도를 주는 해결책 카피라이터입니다. "이런 방법이 있었구나"의 감정을 만드세요. 제품 설명이 아니라 삶의 변화를 보여주세요.',
  cta:             '당신은 독자를 즉각적인 행동으로 이끄는 전환 카피라이터입니다. "저장해두세요" 같은 클리셰 대신 새로운 행동 동기를 만드세요.',
}

const DEFAULT_SYSTEM_PROMPT =
  '당신은 한국 인스타그램 SNS 에디토리얼 카피라이터입니다. 감성적 훅·페르소나·서사 흐름을 기반으로 네이티브 한국어 카피를 생성하세요. 입력 자료에서 확인할 수 없는 수치를 만들지 마세요.'

function buildSlidePrompt(
  memory: NarrativeMemory,
  slideIndex: number,
): string {
  const slide = memory.structure.slides[slideIndex]
  const plan = memory.slidePlan.find(p => p.slideNumber === slide.slideNumber)
  const beat = memory.emotionalArc.find(b => b.slideNumber === slide.slideNumber)

  const prevSlides = memory.completedSlides
  const prevContext = prevSlides.length > 0
    ? `\n이전 슬라이드 결과 (반드시 읽고 이어서 쓰세요):\n` +
      prevSlides.map(s => `  슬라이드${s.slideNumber}[${s.role}] 제목: "${s.headline}" | 본문: "${s.body}"`).join('\n') + '\n'
    : ''

  const forbidConcepts = plan?.forbidConcepts?.length
    ? `\n이미 사용한 개념 (반복 금지): ${plan.forbidConcepts.join(', ')}\n`
    : ''

  const usedOpeners = memory.usedHeadlineOpeners.size > 0
    ? `\n금지된 headline 시작 3글자: ${[...memory.usedHeadlineOpeners].join(', ')}\n`
    : ''

  const emotionInstruction = beat
    ? `\n감정 목표: ${beat.emotion} (강도 ${beat.intensity}/10)\n전환 힌트: ${beat.transitionHint}\n`
    : ''

  const narrativeInstruction = plan
    ? `\n서사 역할: ${plan.narrativePurpose}\n감성 목표: ${plan.emotionalGoal}\n`
    : ''

  const brandDnaSection = memory.brand.brandDna
    ? `\n브랜드 DNA:\n${formatBrandDnaForPrompt(memory.brand.brandDna)}\n`
    : ''

  const knowledgeSection = formatKnowledgeContextForPrompt(memory.knowledgeCtx)

  const isHook = slide.role === 'hook'
  const isCta = slide.role === 'cta'

  return `${prevContext}지금 작성할 슬라이드:
슬라이드 번호: ${slide.slideNumber}
역할(role): ${slide.role}
슬라이드 목적: ${slide.purpose}
${narrativeInstruction}${emotionInstruction}${forbidConcepts}${usedOpeners}
브랜드: ${memory.brand.name} (${memory.brand.industry})
어조: ${memory.brand.toneOfVoice}
금지어: ${memory.brand.forbiddenWords || '없음'}
${brandDnaSection}
상품명: ${memory.input.productName}
상품 설명: ${memory.input.productDescription}
핵심 혜택: ${memory.input.keyBenefits}
캠페인 목표: ${memory.input.objective}

${knowledgeSection}

${buildHeadlineStyleGuidance('ko')}

${buildBodyStyleGuidance('ko')}

${buildAntiPatternRule('ko')}

규칙:
- headline: 25자 이하 (공백 포함) — 강렬하고 구체적으로. 요약 라벨이 아니라 스크롤을 멈추게 하는 한 줄
- body: 150자 이하 (공백 포함) — 핵심 정보를 1~3문장으로 밀도 있게 작성. 에디토리얼 톤으로 날카롭게
- body 문장 어미를 다양하게 하세요. 매번 "~입니다/~있습니다"로 끝나면 안 됩니다. 하지만 대화체("~잖아요", "~라고요?")도 피하세요
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요.
- ctaText: ${isCta ? '20자 이하로 반드시 작성' : 'null'}
${isHook ? `- headline은 반드시 "${memory.selectedHook.text}" 그대로 사용` : ''}
- 이전 슬라이드와 같은 키워드·메시지를 반복하지 마세요. 같은 문장 구조도 반복하지 마세요
- 확인할 수 없는 수치·인증·할인율·순위를 만들지 마세요
- 스마트스토어, 쿠팡, 네이버쇼핑 등 플랫폼명을 쓰지 마세요
- 타겟 고객 설명 문장을 body에 직접 쓰지 마세요

JSON으로만 응답하세요:
{
  "headline": "...",
  "body": "...",
  "ctaText": ${isCta ? '"..."' : 'null'}
}`
}

function buildFallbackCopy(memory: NarrativeMemory, slideNumber: number, role: SlideRole): SlideCopy {
  const benefit = memory.input.keyBenefits.split(',')[0]?.trim() || '핵심 기능'
  const fallbacks: Record<SlideRole, SlideCopy> = {
    hook:            { slideNumber, headline: memory.selectedHook.text, body: '비슷해 보여도 차이는 여기서 납니다' },
    problem:         { slideNumber, headline: '고민은 여기서 시작', body: `${memory.input.productName} 고를 때 놓치기 쉬운 기준을 짚어볼게요.` },
    cause:           { slideNumber, headline: '헷갈리는 이유', body: '상세 설명보다 실제 사용 장면이 더 중요하기 때문입니다.' },
    common_mistake:  { slideNumber, headline: '이 실수는 피하세요', body: '가격만 보고 고르면 필요한 기능을 놓치기 쉽습니다.' },
    product_solution:{ slideNumber, headline: `${memory.input.productName}의 기준`, body: `${benefit}에 집중해 일상에서 바로 쓰기 쉽게 만들었습니다.` },
    feature:         { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_1:       { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_2:       { slideNumber, headline: '두 번째 포인트', body: '복잡한 준비 없이 바로 쓰기 좋은 구성이 강점입니다.' },
    benefit_or_proof:{ slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    proof:           { slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    offer:           { slideNumber, headline: '지금 확인해보세요', body: '필요한 옵션과 구성은 상세페이지에서 바로 볼 수 있습니다.' },
    cta:             { slideNumber, headline: '저장하고 비교하세요', body: memory.brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.', ctaText: memory.brand.ctaStyle || '자세히 보기' },
  }
  return fallbacks[role] ?? { slideNumber, headline: '저장하고 비교하세요', body: '프로필 링크에서 자세히 확인해보세요.' }
}

export async function runSlideChainAgent(memory: NarrativeMemory): Promise<CompletedSlide[]> {
  const client = getLLMClient()
  const textModel = getTextGenerationModel()

  for (let i = 0; i < memory.structure.slides.length; i++) {
    const slide = memory.structure.slides[i]
    const systemPrompt = ROLE_SYSTEM_PROMPT[slide.role] ?? DEFAULT_SYSTEM_PROMPT
    const userPrompt = buildSlidePrompt(memory, i)

    const fallbackCopy = buildFallbackCopy(memory, slide.slideNumber, slide.role)
    // Precomputed so a silently returned fallback is detectable by identity below.
    const fallbackShape = { headline: fallbackCopy.headline, body: fallbackCopy.body, ctaText: fallbackCopy.ctaText ?? null }
    const result = await client.generateJson<{ headline: string; body: string; ctaText?: string | null }>(
      `slide-chain-${slide.slideNumber}`,
      `${systemPrompt}\n\n${userPrompt}`,
      () => fallbackShape,
      { model: textModel, temperature: 0.45 }
    )
    const usedFallback = !result || result === fallbackShape || !result.headline?.trim() || !result.body?.trim()

    const repaired = repairRenderableCopy({
      headline: result?.headline?.trim() || fallbackCopy.headline,
      body: result?.body?.trim() || fallbackCopy.body,
      // 150 = the commerce renderer's true capacity (5 lines x 30 chars) — keep in sync
      // with renderer.ts truncateAtSentenceBoundary and qualityCheckEngine's body check.
      constraints: {
        maxHeadlineChars: 25,
        maxBodyChars: 150,
        maxBodyLines: 5,
        lineLength: 30,
      },
    })
    const headline = repaired.headline || fallbackCopy.headline
    const body = repaired.body || fallbackCopy.body

    const completed: CompletedSlide = {
      slideNumber: slide.slideNumber,
      role: slide.role,
      headline,
      body,
      ...(usedFallback ? { usedFallback: true } : {}),
    }

    appendCompletedSlide(memory, completed)
    console.log(`[SlideChain:slide-${slide.slideNumber}] role=${slide.role} headline="${headline}"`)
  }

  return memory.completedSlides
}
