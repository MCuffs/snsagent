import { getLLMClient, getTextGenerationModel } from '../../ai/llmClient'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'
import { formatKnowledgeContextForPrompt } from '../../copywriting/copyKnowledgeBase'
import { repairRenderableCopy } from '../../copywriting/renderableCopy'
import type { NarrativeMemory, CompletedSlide } from '../narrativeMemory'
import { appendCompletedSlide } from '../narrativeMemory'
import { runCriticAgent, type CriticResult } from './criticAgent'

const MAX_RETRIES = 2

function buildRegenerationPrompt(memory: NarrativeMemory, slideNumber: number): string {
  const slide = memory.structure.slides.find(s => s.slideNumber === slideNumber)!
  const plan = memory.slidePlan.find(p => p.slideNumber === slideNumber)
  const beat = memory.emotionalArc.find(b => b.slideNumber === slideNumber)

  const prevSlides = memory.completedSlides.filter(s => s.slideNumber < slideNumber)
  const prevContext = prevSlides.length > 0
    ? `이전 슬라이드 결과:\n` +
      prevSlides.map(s => `  슬라이드${s.slideNumber}[${s.role}] 제목: "${s.headline}" | 본문: "${s.body}"`).join('\n') + '\n'
    : ''

  const current = memory.completedSlides.find(s => s.slideNumber === slideNumber)
  const currentContext = current
    ? `\n현재 슬라이드 (이 내용을 개선하세요):\n  제목: "${current.headline}"\n  본문: "${current.body}"\n`
    : ''

  const brandDnaSection = memory.brand.brandDna
    ? `\n브랜드 DNA:\n${formatBrandDnaForPrompt(memory.brand.brandDna)}\n`
    : ''

  const knowledgeSection = formatKnowledgeContextForPrompt(memory.knowledgeCtx)
  const isCta = slide.role === 'cta'
  const isHook = slide.role === 'hook'

  return `${prevContext}${currentContext}
재작성할 슬라이드:
슬라이드 번호: ${slideNumber}
역할(role): ${slide.role}
슬라이드 목적: ${slide.purpose}
${plan ? `서사 역할: ${plan.narrativePurpose}\n감성 목표: ${plan.emotionalGoal}` : ''}
${beat ? `감정: ${beat.emotion} (강도 ${beat.intensity}/10)\n전환 힌트: ${beat.transitionHint}` : ''}

브랜드: ${memory.brand.name} (${memory.brand.industry})
${brandDnaSection}
상품명: ${memory.input.productName}
핵심 혜택: ${memory.input.keyBenefits}

${knowledgeSection}

문제: 이전 슬라이드와 서사가 끊기거나 메시지가 반복되었습니다. 이를 개선하세요.
규칙:
- headline: 25자 이하
- body: 220자 이하 — 정보를 풍성하게 1~4문장으로
- body는 반드시 완성된 문장으로 끝내세요. 조사, 명사, 연결어, 쉼표 뒤에서 절대 끊지 마세요.
- ctaText: ${isCta ? '20자 이하 필수' : 'null'}
${isHook ? `- headline은 반드시 "${memory.selectedHook.text}" 그대로` : ''}
- 이전 슬라이드 메시지 반복 금지
- 확인되지 않은 수치 금지

JSON만 응답:
{
  "headline": "...",
  "body": "...",
  "ctaText": ${isCta ? '"..."' : 'null'}
}`
}

export async function runRegenerationLoop(
  memory: NarrativeMemory,
  initialCriticResult: CriticResult,
): Promise<CriticResult> {
  const client = getLLMClient()
  const textModel = getTextGenerationModel()

  let criticResult = initialCriticResult
  let retryCount = 0

  while (criticResult.weakSlides.length > 0 && retryCount < MAX_RETRIES) {
    retryCount++
    console.log(`[RegenerationLoop] retry=${retryCount} weakSlides=[${criticResult.weakSlides.join(',')}]`)

    for (const slideNumber of criticResult.weakSlides) {
      const slide = memory.structure.slides.find(s => s.slideNumber === slideNumber)
      if (!slide) continue

      const prompt = buildRegenerationPrompt(memory, slideNumber)

      const result = await client.generateJson<{ headline: string; body: string; ctaText?: string | null }>(
        `regen-slide-${slideNumber}`,
        prompt,
        () => {
          const existing = memory.completedSlides.find(s => s.slideNumber === slideNumber)
          return { headline: existing?.headline ?? '', body: existing?.body ?? '', ctaText: null }
        },
        { model: textModel, temperature: 0.5 }
      )

      if (result?.headline && result?.body) {
        // Replace the existing completed slide
        const idx = memory.completedSlides.findIndex(s => s.slideNumber === slideNumber)
        const repaired = repairRenderableCopy({
          headline: result.headline.trim(),
          body: result.body.trim(),
          constraints: { maxHeadlineChars: 25, maxBodyChars: 220, maxBodyLines: 6, lineLength: 32 },
        })
        const updated: CompletedSlide = {
          slideNumber,
          role: slide.role,
          headline: repaired.headline,
          body: repaired.body,
        }
        if (idx >= 0) {
          memory.completedSlides[idx] = updated
        } else {
          appendCompletedSlide(memory, updated)
        }
        console.log(`[RegenerationLoop] slide-${slideNumber} regenerated: "${updated.headline}"`)
      }
    }

    criticResult = runCriticAgent(memory)
  }

  return criticResult
}
