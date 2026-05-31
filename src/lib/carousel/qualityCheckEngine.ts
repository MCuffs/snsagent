import type { BrandProfile, CampaignInput, CaptionResult, GeneratedSlide, QualityCheckResult } from './types'
import { isPromptAllowed } from '../ai/imageProvider'
import { getLLMClient, getCopywritingModel, MockLLMClient } from '../ai/llmClient'

const EXAGGERATED = ['혁신적인', '최고의', '완벽한', '100% 보장', '무조건']

export async function runQualityCheck(params: {
  brand: BrandProfile
  input: CampaignInput
  slides: GeneratedSlide[]
  caption: CaptionResult
}): Promise<QualityCheckResult> {
  const issues: string[] = []
  const suggestions: string[] = []
  const forbiddenWords = params.brand.forbiddenWords.split(',').map(word => word.trim()).filter(Boolean)

  // 1. Static Rule-Based Validation
  if (params.slides.length !== params.input.slideCount) {
    issues.push(`슬라이드 수가 요청값과 다릅니다. expected=${params.input.slideCount}, actual=${params.slides.length}`)
  }

  for (const slide of params.slides) {
    if (slide.headline.length > 25) issues.push(`${slide.slideNumber}번 headline이 25자를 초과했습니다.`)
    if (slide.body.length > 120) issues.push(`${slide.slideNumber}번 body가 120자를 초과했습니다.`)
    if (!slide.backgroundImageUrl) issues.push(`${slide.slideNumber}번 배경 이미지 URL이 비어 있습니다.`)
    if (!slide.finalImageUrl) issues.push(`${slide.slideNumber}번 최종 이미지 URL이 비어 있습니다.`)

    if (slide.designPrompt && !isPromptAllowed(slide.designPrompt)) {
      issues.push(`${slide.slideNumber}번 배경 이미지 프롬프트에 비-부정형 텍스트 유도 키워드가 포함되어 있습니다.`)
      suggestions.push('프롬프트에서 제목, 본문 내용 또는 "text", "headline", "title" 등 텍스트 생성 유도 단어를 제외하고, "no text"와 같은 부정 지시어 컨텍스트만 사용하세요.')
    }

    const text = `${slide.headline} ${slide.body}`
    for (const word of forbiddenWords) {
      if (word && text.includes(word)) issues.push(`${slide.slideNumber}번 슬라이드에 금지어 "${word}"가 포함되었습니다.`)
    }
    for (const word of EXAGGERATED) {
      if (text.includes(word)) issues.push(`${slide.slideNumber}번 슬라이드에 과장 표현 "${word}"가 포함되었습니다.`)
    }
  }

  if (params.caption.hashtags.length < 8 || params.caption.hashtags.length > 15) {
    issues.push('해시태그는 8~15개여야 합니다.')
  }

  const lastSlide = params.slides[params.slides.length - 1]
  if (!lastSlide || !/저장|확인|문의|구매|보기|링크/.test(`${lastSlide.headline} ${lastSlide.body}`)) {
    issues.push('마지막 슬라이드에 CTA가 명확하지 않습니다.')
  }

  // 2. Semantic LLM-Based Quality Check (Hybrid Guard)
  try {
    const client = getLLMClient()
    if (!(client instanceof MockLLMClient)) {
      const slidesJson = params.slides.map(s => ({
        slideNumber: s.slideNumber,
        headline: s.headline,
        body: s.body,
      }))
      const prompt = `당신은 한국 인스타그램 카드뉴스 전문 에디터이자 카피 분석가입니다. 
다음 생성된 카드뉴스 카피가 브랜드 아이덴티티 및 타겟 고객층에 잘 부합하는지, 문맥의 흐름이 자연스럽고 맞춤법에 맞는 한국어로 작성되었는지 평가해주세요. 특히 어색한 번역투 문구나 어조의 비일관성이 있는지 검수하십시오.

[브랜드 정보]
- 이름: ${params.brand.name}
- 업종: ${params.brand.industry}
- 타겟 고객: ${params.brand.targetAudience}
- 권장 톤앤매너: ${params.brand.toneOfVoice}
- 금지어: ${params.brand.forbiddenWords || '없음'}

[캠페인 목표]
- 주제: ${params.input.productName}
- 설명: ${params.input.productDescription}
- 목적: ${params.input.objective}

[생성된 슬라이드 카피]
${JSON.stringify(slidesJson, null, 2)}

[요청]
- 발견된 카피 품질 문제점 목록(issues)과 구체적인 피드백/개선 방안(suggestions)을 다음 형식의 JSON으로만 작성해 주세요. 
- 한글 어투가 완벽하거나 문제가 없다면 빈 배열을 반환하십시오.

JSON 응답 형식:
{
  "issues": ["이유 및 해당 슬라이드 번호..."],
  "suggestions": ["구체적인 카피 대안 및 수정 가이드..."]
}
`
      const llmResult = await client.generateJson<{ issues?: string[]; suggestions?: string[] }>(
        'narrative quality check',
        prompt,
        () => ({ issues: [], suggestions: [] }),
        {
          model: getCopywritingModel(),
          temperature: 0.25,
          systemPrompt: '카드뉴스 카피의 가독성, 번역투 문구, 브랜드 적합성을 정밀 심사하는 카피 가드레일 에이전트입니다. 반드시 유효한 JSON으로만 대답하십시오.',
        }
      )
      
      if (Array.isArray(llmResult?.issues)) {
        issues.push(...llmResult.issues)
      }
      if (Array.isArray(llmResult?.suggestions)) {
        suggestions.push(...llmResult.suggestions)
      }
    }
  } catch (err) {
    console.warn('[QualityCheckEngine] Semantic check failed:', err)
  }

  if (issues.length > 0) {
    suggestions.push('needs_review 상태로 저장하고 운영자가 문구와 이미지 URL을 확인하세요.')
  }

  return {
    passed: issues.length === 0,
    issues,
    suggestions,
  }
}
