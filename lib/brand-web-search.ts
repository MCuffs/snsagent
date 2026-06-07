import OpenAI from 'openai'
import {
  getOpenAIBaseURLHost,
  getOpenAIKeyFingerprint,
  logAiDiagnostic,
} from '../src/lib/ai/diagnostics'
import { getTextGenerationModel } from '../src/lib/ai/llmClient'

export interface WebSearchBrandResult {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDescription: string
  coreProducts: string[]
  valueProposition: string
  customerPainPoints: string[]
  differentiators: string[]
  visualMood: string
  contentPillars: string[]
  brandKeywords: string[]
  avoidVisuals: string[]
  markdownReport: string
}

function extractOutputText(response: unknown): string {
  const value = response as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>
  }
  if (typeof value.output_text === 'string') return value.output_text
  return (value.output || [])
    .flatMap(item => item.content || [])
    .map(content => content.text || '')
    .filter(Boolean)
    .join('\n')
}

function parseJson(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

/**
 * OpenAI web_search 도구로 브랜드 정보를 검색하고 분석합니다.
 * URL 스크래핑이 실패한 경우 (네이버 스마트스토어 봇 차단 등)에 사용합니다.
 * Perplexity와 달리 별도 API 비용 없이 기존 OpenAI 키로 동작합니다.
 */
export async function analyzeBrandViaWebSearch(
  url: string,
  locale: 'ko' | 'en' = 'ko',
): Promise<WebSearchBrandResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.length < 10 || apiKey === 'your-openai-api-key-here') return null

  const model = process.env.OPENAI_RESEARCH_MODEL || getTextGenerationModel()
  const baseURL = getOpenAIBaseURLHost()
  const keyFingerprint = getOpenAIKeyFingerprint(apiKey)
  const stepName = 'brand-web-search-fallback'

  logAiDiagnostic({
    status: 'start',
    stepName,
    provider: 'openai',
    model,
    baseURL,
    keyFingerprint,
  })

  const isEn = locale === 'en'
  const toneOptions = isEn
    ? '"Friendly and clear", "Professional and trustworthy", "Young and energetic", "Premium and calm"'
    : '"친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤"'
  const industryOptions = isEn
    ? '"Online store", "Cafe / F&B", "Fitness", "Beauty / Care", "Education", "IT / SaaS"'
    : '"온라인 스토어", "카페 / F&B", "피트니스", "뷰티 / 케어", "교육 / 강의", "IT / SaaS"'
  const lang = isEn ? 'English' : '한국어'

  const prompt = isEn
    ? `Search the web for information about the brand or online store at this URL: ${url}

Find:
- Official brand/store name
- What they sell (products, services, categories)
- Target customers (age, gender, lifestyle)
- Brand tone and visual identity (colors, mood)
- Customer reviews, blog mentions, SNS posts
- Price positioning (budget / mid / premium)
- What makes them different from competitors

Based on your findings, return a brand analysis profile.
IMPORTANT: All text values MUST be written in English.
Industry must be one of: ${industryOptions}
Tone must be one of: ${toneOptions}

Return ONLY valid JSON (no code fences, no bold **):
{
  "name": "Brand name",
  "industry": "one of the industries",
  "targetAudience": "target customers",
  "toneOfVoice": "one of the tones",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "overused words in this industry",
  "ctaStyle": "CTA phrase matching brand tone",
  "brandDescription": "2-3 sentence brand introduction",
  "coreProducts": ["core product/service names (max 5)"],
  "valueProposition": "core brand promise",
  "customerPainPoints": ["problems this brand solves (max 4)"],
  "differentiators": ["competitive advantages (max 4)"],
  "visualMood": "card news image direction",
  "contentPillars": ["SNS content themes (max 5)"],
  "brandKeywords": ["keywords for card news (max 8)"],
  "avoidVisuals": ["visual styles that don't fit (max 4)"],
  "markdownReport": "3-4 natural prose paragraphs about this brand — no headers, no bullets, no bold"
}`
    : `다음 URL의 브랜드 또는 온라인 스토어 정보를 웹에서 검색해주세요: ${url}

검색할 정보:
- 공식 브랜드/스토어명
- 판매 상품/서비스/카테고리
- 타겟 고객 (나이, 성별, 라이프스타일)
- 브랜드 톤과 비주얼 아이덴티티 (컬러, 무드)
- 고객 리뷰, 블로그 언급, SNS 게시물
- 가격 포지셔닝 (저가/중가/고가)
- 경쟁사 대비 차별점

검색 결과를 기반으로 브랜드 분석 프로필을 생성하세요.
IMPORTANT: JSON의 모든 텍스트 값은 반드시 ${lang}으로 작성하세요.
업종: 반드시 ${industryOptions} 중 하나
톤: 반드시 ${toneOptions} 중 하나

반드시 유효한 JSON만 반환 (코드 펜스 없이, bold ** 절대 금지):
{
  "name": "브랜드명",
  "industry": "업종",
  "targetAudience": "타겟 고객 설명",
  "toneOfVoice": "톤앤매너",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "이 업종에서 남용되는 표현",
  "ctaStyle": "브랜드 톤에 맞는 CTA 문구",
  "brandDescription": "브랜드를 처음 보는 사람을 위한 2~3문장 소개",
  "coreProducts": ["핵심 상품/서비스명 (최대 5개)"],
  "valueProposition": "브랜드 핵심 약속",
  "customerPainPoints": ["이 브랜드가 해결하는 고객 고민 (최대 4개)"],
  "differentiators": ["경쟁 차별점 (최대 4개)"],
  "visualMood": "카드뉴스 이미지 방향",
  "contentPillars": ["SNS 콘텐츠 주제 축 (최대 5개)"],
  "brandKeywords": ["카드뉴스 생성 키워드 (최대 8개)"],
  "avoidVisuals": ["어울리지 않는 비주얼 스타일 (최대 4개)"],
  "markdownReport": "이 브랜드에 대해 크리에이티브 전략가가 동료에게 설명하듯 3~4문단으로 자연스럽게 서술. 제목(##), 목록(-), 볼드(**) 없이 순수 산문체로."
}`

  try {
    const client = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    })

    const response = await client.responses.create({
      model,
      tools: [{
        type: 'web_search',
        search_context_size: 'medium',
      } as never],
      include: ['web_search_call.action.sources'] as never,
      input: prompt,
    } as never)

    const outputText = extractOutputText(response)
    const parsed = parseJson(outputText)

    if (!parsed) {
      logAiDiagnostic({
        status: 'fallback',
        stepName,
        provider: 'openai',
        model,
        baseURL,
        keyFingerprint,
        errorMessage: 'web search response did not contain valid JSON',
      })
      return null
    }

    const s = (v: unknown, fb: string) => (typeof v === 'string' && v.trim()) ? v.trim() : fb
    const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String).filter(Boolean) : []

    const result: WebSearchBrandResult = {
      name: s(parsed.name, ''),
      industry: s(parsed.industry, isEn ? 'Online store' : '온라인 스토어'),
      targetAudience: s(parsed.targetAudience, isEn ? 'General customers' : '대중 고객'),
      toneOfVoice: s(parsed.toneOfVoice, isEn ? 'Friendly and clear' : '친근하고 명확한 톤'),
      mainColor: s(parsed.mainColor, '#03C75A'),
      forbiddenWords: s(parsed.forbiddenWords, ''),
      ctaStyle: s(parsed.ctaStyle, isEn ? 'Learn more via profile link' : '프로필 링크에서 확인하기'),
      brandDescription: s(parsed.brandDescription, ''),
      coreProducts: arr(parsed.coreProducts).slice(0, 5),
      valueProposition: s(parsed.valueProposition, ''),
      customerPainPoints: arr(parsed.customerPainPoints).slice(0, 4),
      differentiators: arr(parsed.differentiators).slice(0, 4),
      visualMood: s(parsed.visualMood, ''),
      contentPillars: arr(parsed.contentPillars).slice(0, 5),
      brandKeywords: arr(parsed.brandKeywords).slice(0, 8),
      avoidVisuals: arr(parsed.avoidVisuals).slice(0, 4),
      markdownReport: s(parsed.markdownReport, ''),
    }

    if (!result.name) {
      logAiDiagnostic({
        status: 'fallback',
        stepName,
        provider: 'openai',
        model,
        baseURL,
        keyFingerprint,
        errorMessage: 'web search could not determine brand name',
      })
      return null
    }

    logAiDiagnostic({
      status: 'success',
      stepName,
      provider: 'openai',
      model,
      baseURL,
      keyFingerprint,
    })

    console.log(`[BrandWebSearch] 성공: ${result.name} (${url})`)
    return result
  } catch (error) {
    logAiDiagnostic({
      status: 'failure',
      stepName,
      provider: 'openai',
      model,
      baseURL,
      keyFingerprint,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    console.warn('[BrandWebSearch] 실패:', error instanceof Error ? error.message : String(error))
    return null
  }
}
