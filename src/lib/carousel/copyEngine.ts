import { getCopywritingModel, getLLMClient } from '../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../lib/brand-dna'
import type { BrandProfile, CampaignInput, CarouselStructure, HookCandidate, SlideRole, SlideCopy } from './types'
import type { CopyKnowledgeContext } from '../copywriting/copyKnowledgeBase'
import { formatKnowledgeContextForPrompt } from '../copywriting/copyKnowledgeBase'
import { checkCopyQuality } from '../copywriting/copyQualityChecker'
import { buildNarrativeTransitionInstructions } from '../copywriting/slideNarrativeEngine'

const BANNED_CLICHES = ['혁신적인', '최고의', '완벽한']

export async function generateSlideCopies(
  brand: BrandProfile,
  input: CampaignInput,
  structure: CarouselStructure,
  selectedHook: HookCandidate,
  knowledgeCtx?: CopyKnowledgeContext
): Promise<SlideCopy[]> {
  const client = getLLMClient()

  const slideDescriptions = structure.slides
    .map(s => `슬라이드 ${s.slideNumber} [${s.role}]: ${s.purpose}`)
    .join('\n')

  const brandDnaSection = brand.brandDna
    ? `\n브랜드 DNA (반드시 카피에 반영할 핵심 인사이트):\n${formatBrandDnaForPrompt(brand.brandDna)}\n`
    : ''

  const knowledgeSection = knowledgeCtx
    ? `\n${formatKnowledgeContextForPrompt(knowledgeCtx)}\n`
    : ''

  const narrativeSection = knowledgeCtx
    ? `\n${buildNarrativeTransitionInstructions(knowledgeCtx.narrativeArc, structure.slides)}\n`
    : ''

  const systemPrompt = knowledgeCtx
    ? `당신은 한국 인스타그램 SNS 에디토리얼 카피라이터입니다. 대학내일, 뉴닉 스타일의 카드뉴스 카피를 씁니다. 상품 설명을 요약하지 말고, 감성적 훅·페르소나·서사 흐름을 기반으로 네이티브 한국어 카피를 생성하세요. 입력 자료에서 확인할 수 없는 수치를 만들지 말고, 유효한 JSON으로만 응답하세요.`
    : '당신은 정확성을 우선하는 한국 SNS 카드뉴스 에디터입니다. 입력 자료에서 확인할 수 없는 사실이나 수치를 만들지 말고, 일관된 슬라이드 흐름을 가진 유효한 JSON으로만 응답하세요.'

  const prompt = `한국 인스타그램 카드뉴스 카피를 작성해주세요.

브랜드 정보:
- 브랜드명: ${brand.name}
- 업종: ${brand.industry}
- 타겟 고객: ${brand.targetAudience}
- 어조: ${brand.toneOfVoice}
- 금지어: ${brand.forbiddenWords || '없음'}
${brandDnaSection}${knowledgeSection}
상품 정보:
- 상품명: ${input.productName}
- 상품 설명: ${input.productDescription}
- 핵심 혜택: ${input.keyBenefits}
- 캠페인 목표: ${input.objective}

첫 번째 슬라이드 훅 문구: "${selectedHook.text}"

슬라이드 구성:
${slideDescriptions}
${narrativeSection}
규칙:
- headline: 반드시 20자 이하, 강렬하고 구체적으로 (공백 포함)
- body: 반드시 60자 이하, 핵심 메시지 전달 (공백 포함)
- ctaText: 마지막 슬라이드(cta 역할)에만 작성, 15자 이하. 나머지는 null
- 금지어와 과장 표현(혁신적인, 최고의, 완벽한) 사용 금지
- 슬라이드 역할(role)에 맞는 내용으로 작성
- hook 슬라이드의 headline은 반드시 "${selectedHook.text}" 그대로 사용
- 브랜드 DNA가 제공된 경우, 핵심 상품·차별점·고객 페인포인트·가치 제안 중 하나 이상이 슬라이드 카피에 반드시 녹아들어야 합니다
- 일반적인 업종 표현 대신 브랜드 고유의 언어와 키워드를 사용하세요
- 상품 정보와 브랜드 DNA에서 확인할 수 없는 수치, 할인율, 인증, 순위, 후기, 성분, 성능 또는 효능은 만들지 마세요
- 문제 제기 → 해결 방법 → 근거/혜택 → CTA 흐름으로 연결하고, 인접 슬라이드에서 같은 메시지를 반복하지 마세요

JSON 응답 형식:
{
  "slides": [
    { "slideNumber": 1, "headline": "...", "body": "...", "ctaText": null },
    { "slideNumber": 2, "headline": "...", "body": "...", "ctaText": null }
  ]
}`

  const result = await client.generateJson<{ slides: SlideCopy[] }>(
    'slide copy generation',
    prompt,
    () => ({
      slides: structure.slides.map(slide =>
        generateFallbackCopy(brand, input, slide.slideNumber, slide.role, selectedHook)
      ),
    }),
    {
      model: getCopywritingModel(),
      temperature: 0.35,
      systemPrompt,
    }
  )

  const generatedSlides = Array.isArray(result?.slides) ? result.slides : []
  const slidesMap = new Map(generatedSlides.map(s => [s.slideNumber, s]))

  const cleaned = structure.slides
    .map(slide => {
      const fallback = generateFallbackCopy(brand, input, slide.slideNumber, slide.role, selectedHook)
      const generated = slidesMap.get(slide.slideNumber)
      const copy = isGroundedCopy(generated, input) ? generated : fallback
      return cleanCopy(brand, copy, knowledgeCtx)
    })

  // Run copy quality check — replace block-severity slides with fallback
  if (knowledgeCtx) {
    const report = checkCopyQuality(cleaned, knowledgeCtx, structure.slides)
    const blockSlides = new Set(
      report.issues.filter(i => i.severity === 'block').map(i => i.slideNumber)
    )
    if (blockSlides.size > 0) {
      return cleaned.map(copy => {
        if (blockSlides.has(copy.slideNumber)) {
          const role = structure.slides.find(s => s.slideNumber === copy.slideNumber)?.role ?? 'feature'
          return cleanCopy(brand, generateFallbackCopy(brand, input, copy.slideNumber, role, selectedHook), knowledgeCtx)
        }
        return copy
      })
    }
  }

  return cleaned
}

function isGroundedCopy(copy: SlideCopy | undefined, input: CampaignInput): copy is SlideCopy {
  if (!copy || typeof copy.headline !== 'string' || typeof copy.body !== 'string') return false
  const text = `${copy.headline} ${copy.body}`
  const source = `${input.productName}\n${input.productDescription}\n${input.keyBenefits}`
  const generatedSignals = text.match(/\d[\d,.]*\s*(?:%|퍼센트|원|명|개|회|배|위|일|시간|분|ml|g|kg|cm)?/gi) || []
  const sourceSignals = new Set(
    (source.match(/\d[\d,.]*\s*(?:%|퍼센트|원|명|개|회|배|위|일|시간|분|ml|g|kg|cm)?/gi) || [])
      .map(signal => signal.replace(/\s+/g, '').toLowerCase())
  )
  return generatedSignals.every(signal => sourceSignals.has(signal.replace(/\s+/g, '').toLowerCase()))
}

function generateFallbackCopy(
  brand: BrandProfile,
  input: CampaignInput,
  slideNumber: number,
  role: SlideRole,
  selectedHook: HookCandidate
): SlideCopy {
  const benefit = firstBenefit(input.keyBenefits)

  const copyMap: Record<SlideRole, SlideCopy> = {
    hook: { slideNumber, headline: selectedHook.text, body: '비슷해 보여도 차이는 여기서 납니다' },
    problem: { slideNumber, headline: '고민은 여기서 시작', body: `${input.productName} 고를 때 놓치기 쉬운 기준을 짚어볼게요.` },
    cause: { slideNumber, headline: '헷갈리는 이유', body: '상세 설명보다 실제 사용 장면이 더 중요하기 때문입니다.' },
    common_mistake: { slideNumber, headline: '이 실수는 피하세요', body: '가격만 보고 고르면 필요한 기능을 놓치기 쉽습니다.' },
    product_solution: { slideNumber, headline: `${input.productName}의 기준`, body: `${benefit}에 집중해 일상에서 바로 쓰기 쉽게 만들었습니다.` },
    feature: { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_1: { slideNumber, headline: '첫 번째 포인트', body: `${benefit}을 짧은 시간 안에 체감할 수 있게 설계했습니다.` },
    feature_2: { slideNumber, headline: '두 번째 포인트', body: '복잡한 준비 없이 바로 쓰기 좋은 구성이 강점입니다.' },
    benefit_or_proof: { slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    proof: { slideNumber, headline: '후기가 말해줍니다', body: '구매 후 자주 쓰게 되는 이유는 작은 편리함에 있습니다.' },
    offer: { slideNumber, headline: '지금 확인해보세요', body: '필요한 옵션과 구성은 상세페이지에서 바로 볼 수 있습니다.' },
    cta: { slideNumber, headline: '저장하고 비교하세요', body: brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.', ctaText: brand.ctaStyle || '자세히 보기' },
  }

  return copyMap[role] ?? { slideNumber, headline: '저장하고 비교하세요', body: brand.ctaStyle || '프로필 링크에서 자세히 확인해보세요.' }
}

function firstBenefit(keyBenefits: string) {
  return keyBenefits.split(',').map(item => item.trim()).filter(Boolean)[0] || '필요한 기능'
}

function cleanCopy(brand: BrandProfile, copy: SlideCopy, knowledgeCtx?: CopyKnowledgeContext): SlideCopy {
  const forbiddenWords = brand.forbiddenWords
    .split(',')
    .map(word => word.trim())
    .filter(Boolean)

  const allBanned = knowledgeCtx
    ? [...new Set([...forbiddenWords, ...BANNED_CLICHES, ...knowledgeCtx.resolvedBannedPhrases])]
    : [...forbiddenWords, ...BANNED_CLICHES]

  const clean = (text: string, limit: number) => {
    let result = text
    for (const word of allBanned) {
      result = result.replaceAll(word, '')
    }
    return result.trim().slice(0, limit)
  }

  return {
    ...copy,
    headline: clean(copy.headline, 20),
    body: clean(copy.body, 60),
    ctaText: copy.ctaText ? clean(copy.ctaText, 30) : undefined,
  }
}
