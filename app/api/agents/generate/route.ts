import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'
import { collectBrandUrlContext } from '../../../../lib/brand-url-collector'
import { analyzePurchasePersuasionWithOpenAI, formatPurchasePersuasionForPrompt } from '../../../../lib/purchase-persuasion'
import { extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../src/lib/rss/rssFetcher'
import { buildCarouselResearchBrief, formatResearchBriefForPrompt } from '../../../../src/lib/research/carouselResearch'
import { repairRenderableCopy } from '../../../../src/lib/copywriting/renderableCopy'
import { getCopywritingModel } from '../../../../src/lib/ai/llmClient'
import {
  getOpenAIBaseURLHost,
  getOpenAIKeyFingerprint,
  logAiDiagnostic,
  readOpenAIError,
} from '../../../../src/lib/ai/diagnostics'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../../../../lib/rateLimiter'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateAgentRequest {
  messages: ChatMessage[]
  brandId: string
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
}

interface DraftSlide {
  slideNumber: number
  role: string
  headline: string
  body: string
  reasoning: string
}

interface GenerateParams {
  topic: string
  visualHint: string
  contentType: string
  objective: string
  slideCount: number
  productUrl?: string | null
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  structurePreview?: { slideNumber: number; role: string; description: string }[]
  draftSlides?: DraftSlide[]
  refinementOptions?: ClarificationOption[]
}

interface ClarificationOption {
  label: string
  value: string
}

interface ClarificationPrompt {
  question: string
  options: ClarificationOption[]
  allowCustom?: boolean
  skipLabel?: string
}

interface AgentResponse {
  message: string
  ready: boolean
  params?: GenerateParams
  clarification?: ClarificationPrompt
}

const VISUAL_HINT_OPTIONS = ['dark-editorial', 'trend-feed', 'community-style', 'minimal-clean', 'breaking-news']

function getAgentDraftCopyConstraints(language: 'ko' | 'en' = 'ko') {
  return language === 'en'
    ? {
      maxHeadlineChars: 40,
      maxBodyChars: 130,
      maxBodyLines: 3,
      lineLength: 34,
    }
    : {
      maxHeadlineChars: 22,
      maxBodyChars: 85,
      maxBodyLines: 3,
      lineLength: 20,
    }
}

function buildAgentResearchTopic(lastUserText: string, allUserText: string) {
  const clean = (text: string) => text
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const last = clean(lastUserText)
  if (last.length >= 8 && !/^(ㅇ+|네|예|응|좋아|ㄱㄱ|고고)$/u.test(last)) {
    return last.slice(0, 220)
  }

  return clean(allUserText).slice(-220)
}

function hasPriorDraftContext(messages: ChatMessage[]) {
  return messages.some(message => (
    message.role === 'assistant' &&
    (
      message.content.includes('[Existing draft slides]') ||
      message.content.includes('[기존 카피 초안]')
    )
  ))
}

function stripAgentMemoryContext(content: string) {
  return content
    .replace(/\n?\[Existing draft slides\][\s\S]*$/u, '')
    .replace(/\n?\[기존 카피 초안\][\s\S]*$/u, '')
}

function isNewTopicRequest(text: string) {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const compact = trimmed.replace(/\s+/g, '').toLowerCase()
  if (!compact) return false
  if (/https?:\/\//i.test(text)) return true
  if (/새주제|다른주제|주제변경|처음부터|완전히새로|이거말고|이것말고|아니이거말고|newtopic|differenttopic|startover/.test(compact)) {
    return true
  }

  const styleOnly = /(톤|문구|제목|본문|헤드라인|바디|슬라이드|페이지|장|길이|말투|표현|분위기|색감|스타일|headline|body|tone|style|slide|page)/.test(compact)
  if (styleOnly) return false

  return /[가-힣A-Za-z0-9]{2,}(?:이슈|뉴스|트렌드|논란|정보|사건|제품|브랜드)?(?:으로|로)(?:바꿔|변경|해줘|가자|진행)/.test(compact)
}

function isLightweightRevisionRequest(text: string) {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  if (!normalized) return true
  if (/^(ㅇ+|ㄱㄱ|고고|좋아|좋음|네|예|응|오케이|ok|okay|yes|go)$/.test(normalized)) return true

  return /수정|바꿔|변경|줄여|늘려|짧게|길게|톤|문구|제목|본문|슬라이드|페이지|장|더|다시|edit|revise|change|shorter|longer|tone|headline|body/.test(normalized)
}

function normalizeGeneralProfileCategory(value?: string | null) {
  if (value === 'current-affairs' || value === 'information' || value === 'trends') return value
  return 'information'
}

function buildKoreanGeneralModeInstruction(category: string) {
  switch (normalizeGeneralProfileCategory(category)) {
    case 'current-affairs':
      return [
        '이 콘텐츠는 시사 프로필 기반 카드뉴스입니다.',
        '목표는 사건, 정책, 사회 이슈의 사실관계와 배경, 핵심 쟁점, 영향을 독자가 균형 있게 이해하고 저장하게 만드는 것입니다.',
        '정치적 단정이나 과장 없이 확인된 근거와 아직 봐야 할 대목을 분리해 설명하세요.',
      ].join('\n')
    case 'trends':
      return [
        '이 콘텐츠는 트렌드 프로필 기반 카드뉴스입니다.',
        '목표는 사람들이 요즘 왜 반응하는지, 어떤 문화/소비/콘텐츠 흐름이 생겼는지, 독자가 어떻게 활용하거나 관찰하면 좋은지 보여주는 것입니다.',
        '뉴스 해설처럼 쟁점만 정리하지 말고, 변화의 신호, 반응 포인트, 실전 적용 관점 중심으로 흐름을 설계하세요.',
      ].join('\n')
    case 'information':
    default:
      return [
        '이 콘텐츠는 정보/테크 프로필 기반 카드뉴스입니다.',
        '목표는 독자가 개념, 변화, 사용법, 체크포인트를 빠르게 이해하고 실제 판단이나 행동에 활용하게 만드는 것입니다.',
        '딱딱한 백과사전식 설명보다 문제, 원리, 비교 기준, 실용 포인트 중심으로 흐름을 설계하세요.',
      ].join('\n')
  }
}

function buildEnglishGeneralModeInstruction(category: string) {
  switch (normalizeGeneralProfileCategory(category)) {
    case 'current-affairs':
      return 'This is a current-affairs carousel. Help readers understand verified facts, background, key tensions, and impact without partisan certainty or unsupported claims.'
    case 'trends':
      return 'This is a trend carousel. Explain why people are reacting now, what cultural/consumer/content signals are emerging, and how readers can interpret or apply the trend. Do not make it feel like a hard-news explainer.'
    case 'information':
    default:
      return 'This is an information or tech carousel. Help readers understand the concept, change, use case, checklist, or decision criteria in a practical, easy-to-apply way.'
  }
}

function buildSystemPrompt(
  brand: {
    name: string
    industry: string
    targetAudience: string
    toneOfVoice: string
    brandDna?: string | null
  },
  preferencesText: string,
  scrapedContext: string,
  language?: 'ko' | 'en',
  generationMode?: 'brand' | 'general',
  rssContext?: string,
  userTurnCount?: number
) {
  const isGeneral = generationMode === 'general'
  const dnaText = formatBrandDnaForPrompt(brand.brandDna)
  const briefingGuidance = language === 'en'
    ? `The user has sent ${userTurnCount ?? 0} request turn(s). Prefer one-pass planning: if the request has a usable topic, return ready:true with a complete strategy and draftSlides. Ask one clarification only when the topic is too vague to produce useful copy.`
    : `사용자가 요청을 ${userTurnCount ?? 0}번 보냈습니다. 기본은 원패스 기획입니다. 주제가 카드뉴스로 만들 수 있을 정도면 ready:true로 기획안과 draftSlides를 한 번에 반환하세요. 너무 막연해서 좋은 카피를 만들 수 없을 때만 질문하세요.`

  if (language === 'en') {
    return buildEnglishSystemPrompt({
      brand,
      preferencesText,
      scrapedContext,
      generationMode,
      rssContext,
      briefingGuidance,
    })
  }

  const modeInstruction = isGeneral
    ? [
      buildKoreanGeneralModeInstruction(brand.industry),
      '브랜드 홍보, 구매 유도, 제품 CTA처럼 쓰지 말고, 입력과 제공 근거 안에서 가장 자연스러운 카드뉴스 흐름을 직접 설계하세요.',
    ].join('\n')
    : [
      '이 콘텐츠는 URL 프로필 기반의 브랜드/상품/서비스 카드뉴스입니다.',
      '목표는 브랜드/상품/서비스 맥락을 독자가 저장하고 이해하게 만드는 것입니다.',
      '광고문처럼 쓰지 말고, 독자의 문제, 선택 기준, 활용 맥락 중심으로 가장 자연스러운 카드뉴스 흐름을 직접 설계하세요.',
    ].join('\n')

  const contextBlock = [
    isGeneral
      ? `프로필 분야: ${brand.industry || '시사/정보/트렌드'}\n주요 독자: ${brand.targetAudience || '일반 독자'}\n톤앤매너: ${brand.toneOfVoice || '명확하고 읽기 쉬운 에디토리얼 톤'}`
      : `브랜드명: ${brand.name}\n업종: ${brand.industry}\n타겟: ${brand.targetAudience}\n톤앤매너: ${brand.toneOfVoice}\n브랜드 DNA: ${dnaText || '없음'}`,
    `사용자 선호 스타일: ${preferencesText || '없음'}`,
    rssContext ? `실시간 관련 뉴스:\n${rssContext}` : '',
    scrapedContext ? `수집된 URL/자료 컨텍스트:\n${scrapedContext}` : '',
  ].filter(Boolean).join('\n\n')

  return `당신은 Shuffla의 한국 인스타그램 카드뉴스 크리에이티브 디렉터입니다.
${briefingGuidance}

## 제작 모드
${modeInstruction}

## 참고 정보
${contextBlock || '추가 참고 정보 없음'}

## 작성 규칙
- 유효한 JSON만 반환하세요. 마크다운 강조 기호는 쓰지 마세요.
- 충분한 주제가 있으면 ready:true로 기획안과 실제 카피 초안을 한 번에 반환하세요.
- 질문은 입력이 너무 넓거나 모호해서 좋은 카드뉴스가 불가능할 때만 1개 하세요.
- 슬라이드 흐름, 도메인, 톤, 헤드라인 방향은 입력을 보고 직접 판단하세요.
- 확인되지 않은 수치, 순위, 후기, 성과 예측, 의료/금융 단정 표현은 만들지 마세요.
- message는 3문단 이내, 220자 이하로 쓰고 카피 확인 후 생성을 자연스럽게 제안하세요.
- visualHint는 dark-editorial, trend-feed, community-style, minimal-clean, breaking-news 중 하나입니다.
- slideCount는 5, 7, 10 중 하나입니다. 기본은 5 또는 7입니다.
- structurePreview와 draftSlides는 slideCount와 같은 개수여야 합니다.
- draftSlides는 실제 카드에 들어갈 문구입니다. headline은 22자 이하, body는 85자 이하의 1~2문장으로 쓰세요.
- reasoning은 공백 포함 30자 이내의 짧은 한글 문장입니다.
- refinementOptions는 이 초안을 더 좋게 바꾸는 관점 선택지 3개입니다. 새 조사 없이 기존 근거/초안만 재구성하는 방향이어야 합니다.

## JSON 형식
{
  "message": "짧은 기획 요약과 카피 확인 안내",
  "ready": true,
  "params": {
    "topic": "구체 주제",
    "visualHint": "trend-feed",
    "contentType": "저장형 카드뉴스",
    "objective": "구체 목표",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "방향이 맞는 이유",
    "targetEmotion": "독자 감정",
    "hookDirection": "훅 방향",
    "recommendedCta": "저장/확인/방문 등 자연스러운 행동",
    "reasonForStyle": "스타일 이유",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "슬라이드 역할" }
    ],
    "draftSlides": [
      { "slideNumber": 1, "role": "Hook", "headline": "실제 제목", "body": "실제 본문입니다.", "reasoning": "의도 요약" }
    ],
    "refinementOptions": [
      { "label": "관점 선택지", "value": "새 조사는 하지 말고, 현재 근거와 초안을 바탕으로 구체 관점으로 다시 다듬어 주세요." }
    ]
  }
}

질문이 꼭 필요할 때만 ready:false와 clarification을 함께 반환하고, 가능한 범위의 params와 draftSlides도 포함하세요.`
}



function buildEnglishSystemPrompt(params: {
  brand: {
    name: string
    industry: string
    targetAudience: string
    toneOfVoice: string
    brandDna?: string | null
  }
  preferencesText: string
  scrapedContext: string
  generationMode?: 'brand' | 'general'
  rssContext?: string
  briefingGuidance: string
}) {
  const isGeneral = params.generationMode === 'general'
  const brandDna = formatBrandDnaForPrompt(params.brand.brandDna)
  const contextBlock = [
    params.rssContext ? `## Real-time relevant context\n${params.rssContext}` : '',
    params.scrapedContext ? `## Collected source or product context\n${params.scrapedContext}` : '',
  ].filter(Boolean).join('\n\n')
  const profileContext = isGeneral
    ? [
      '## Editorial Profile Context',
      `- Profile category: ${params.brand.industry || 'information/news/trends'}`,
      `- Target readers: ${params.brand.targetAudience || 'general readers'}`,
      `- Tone of voice: ${params.brand.toneOfVoice || 'clear editorial voice'}`,
    ].join('\n')
    : [
      '## Brand/Profile Context',
      `- Brand: ${params.brand.name}`,
      `- Industry: ${params.brand.industry}`,
      `- Target audience: ${params.brand.targetAudience}`,
      `- Tone of voice: ${params.brand.toneOfVoice}`,
      `- Brand DNA: ${brandDna || 'Not specified'}`,
    ].join('\n')

  return `You are Shuffla's senior Instagram carousel creative director.
${params.briefingGuidance}
## Mode
${isGeneral
    ? `${buildEnglishGeneralModeInstruction(params.brand.industry)} Do not force brand promotion, purchase CTAs, or product framing.`
    : `This is a URL/profile-based brand, product, or service carousel for ${params.brand.name}. Help readers understand and save the brand/product context without sounding like an ad.`}

${profileContext}

## User style memory
${params.preferencesText || 'No prior style memory.'}

${contextBlock}

## Rules
- Return valid JSON only.
- Write every JSON string value in English.
- Do not use markdown emphasis symbols.
- Prefer one-pass planning. If the user gives a usable topic, return ready:true with params and draftSlides.
- Ask a clarification only when the topic is too vague to produce useful copy.
- Keep message under 650 characters across 2-3 short paragraphs.
- Never invent performance metrics, medical claims, rankings, discounts, reviews, or unsupported facts.
- Decide the domain, flow, tone, and headline angle from the input.
- structurePreview and draftSlides must each contain exactly slideCount items.
- draftSlides must be real card copy. headline: max 40 chars. body: 1-2 sentences, max 130 chars.
- reasoning: one short English sentence under 30 chars.
- refinementOptions must contain exactly 3 topic-specific ways to improve this draft without new research.

JSON when ready:
{
  "message": "Short strategic recommendation and generation confirmation.",
  "ready": true,
  "params": {
    "topic": "specific topic or product name",
    "visualHint": "minimal-clean",
    "contentType": "educational guide",
    "objective": "specific content goal",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "why this direction fits",
    "targetEmotion": "reader emotion",
    "hookDirection": "specific hook angle",
    "recommendedCta": "specific reader action",
    "reasonForStyle": "visual reasoning",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "specific slide role" }
    ],
    "draftSlides": [
      { "slideNumber": 1, "role": "Hook", "headline": "Bold opening hook", "body": "One to two sentences of specific insight for the reader.", "reasoning": "Grabs attention with contrast" }
    ],
    "refinementOptions": [
      { "label": "Specific angle", "value": "Revise the draft around this specific angle using the existing evidence only. Do not run new research." }
    ]
  }
}

JSON when more detail is needed:
{
  "message": "One more detail will make this carousel more useful. Pick a direction or type your own.",
  "ready": false,
  "clarification": {
    "question": "Which angle should this carousel focus on?",
    "allowCustom": true,
    "skipLabel": "Use current info",
    "options": [
      { "label": "Practical guide", "value": "Create a practical guide for the target reader." },
      { "label": "Checklist", "value": "Create a checklist with concrete decision points." },
      { "label": "Balanced cautions", "value": "Explain benefits and cautions in a balanced way." }
    ]
  },
  "params": {
    "topic": "specific topic or product name",
    "visualHint": "minimal-clean",
    "contentType": "educational guide",
    "objective": "specific content goal",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "why this direction fits",
    "targetEmotion": "reader emotion",
    "hookDirection": "specific hook angle",
    "recommendedCta": "specific reader action",
    "reasonForStyle": "visual reasoning",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "specific slide role" }
    ],
    "draftSlides": [
      { "slideNumber": 1, "role": "Hook", "headline": "Bold opening hook", "body": "One to two sentences of specific insight for the reader.", "reasoning": "Grabs attention with contrast" }
    ],
    "refinementOptions": [
      { "label": "Specific angle", "value": "Revise the draft around this specific angle using the existing evidence only. Do not run new research." }
    ]
  }
}`
}

function validateParams(params: unknown): params is GenerateParams {
  if (!params || typeof params !== 'object') return false
  const p = params as Record<string, unknown>
  if (!p.topic || typeof p.topic !== 'string') return false
  if (!p.visualHint || !VISUAL_HINT_OPTIONS.includes(p.visualHint as string)) return false
  if (!p.contentType || typeof p.contentType !== 'string') return false
  if (!p.objective || typeof p.objective !== 'string') return false
  if (!p.slideCount || ![5, 7, 10].includes(Number(p.slideCount))) return false
  return true
}

function validateDraftSlides(params: GenerateParams) {
  if (!Array.isArray(params.draftSlides)) return false
  if (params.draftSlides.length !== Number(params.slideCount)) return false

  return params.draftSlides.every((slide, index) => (
    Number(slide.slideNumber) === index + 1 &&
    typeof slide.role === 'string' &&
    slide.role.trim().length > 0 &&
    typeof slide.headline === 'string' &&
    slide.headline.trim().length > 0 &&
    typeof slide.body === 'string' &&
    slide.body.trim().length > 0
  ))
}

function normalizeDraftSlides(params: GenerateParams, language: 'ko' | 'en' = 'ko') {
  if (!Array.isArray(params.draftSlides)) return
  const constraints = getAgentDraftCopyConstraints(language)

  params.draftSlides = params.draftSlides.map(slide => {
    const repaired = repairRenderableCopy({
      headline: slide.headline,
      body: slide.body,
      constraints,
    })

    return {
      ...slide,
      headline: repaired.headline,
      body: repaired.body,
    }
  })
}

function validateClarification(clarification: unknown): clarification is ClarificationPrompt {
  if (!clarification || typeof clarification !== 'object') return false
  const value = clarification as Record<string, unknown>
  if (typeof value.question !== 'string' || !value.question.trim()) return false
  if (!Array.isArray(value.options) || value.options.length < 2) return false
  return value.options.every(option => {
    if (!option || typeof option !== 'object') return false
    const item = option as Record<string, unknown>
    return typeof item.label === 'string' && item.label.trim().length > 0 &&
      typeof item.value === 'string' && item.value.trim().length > 0
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  // Rate limiting: 5 requests per 10 minutes per user
  const rateLimitResult = await checkRateLimit(`generate-agent:${user.id}`, RATE_LIMIT_PRESETS.aiGeneration)
  if (rateLimitResult.limited) {
    return NextResponse.json(
      { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
          'X-RateLimit-Limit': String(RATE_LIMIT_PRESETS.aiGeneration.maxRequests),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        }
      }
    )
  }

  try {
    const body = await request.json() as GenerateAgentRequest
    const { messages, brandId, language, generationMode } = body

    if (!brandId) return NextResponse.json({ error: 'brandId가 필요합니다.' }, { status: 400 })

    const brand = await dbService.getBrand(brandId)
    if (!brand || brand.userId !== user.id) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 1. If history is empty, immediately return greeting message (minimizes OpenAI API load)
    if (!messages || messages.length === 0) {
      const greeting: AgentResponse = language === 'en' ? {
        message: `Hello! I'm the Creative Content Director for ${brand.name}.\n\nPlease share a product URL or campaign topic you'd like to feature (e.g. "new leather bag launch"). I'll design the most effective card news strategy based on your brand's unique identity and target audience.`,
        ready: false,
      } : {
        message: `안녕하세요! ${brand.name}의 크리에이티브 콘텐츠 디렉터입니다.

오늘 인스타그램 피드에 소개하고 싶으신 브랜드의 상품 URL이나 캠페인 주제(예: 신상품 가죽백 출시 정보)를 가볍게 남겨주세요.

남겨주신 내용을 바탕으로 브랜드 고유의 감성과 타겟 고객에게 와닿을 수 있는 가장 효과적인 카드뉴스 구성 전략을 직접 기획해 드리겠습니다.`,
        ready: false,
      }
      return NextResponse.json(greeting)
    }

    // 2. Parse past styles memory
    let preferencesText = '과거 선호 스타일 기록 없음 (브랜드 정보 기준 기본 기획)'
    if (brand.editorPreferences) {
      try {
        const pref = JSON.parse(brand.editorPreferences)
        preferencesText = `
        - 과거 사용자가 선호한 타이포그래피 프리셋: ${pref.typographyPreset || '기본'}
        - 과거 사용자가 선호한 오버레이 프리셋: ${pref.overlay?.preset || '기본'}
        - 과거 선호한 텍스트 폰트/크기: ${pref.titleStyle?.fontPreset || '기본'} (크기: ${pref.titleStyle?.fontSize || '기본'})
        `
      } catch {
        // ignore JSON parsing errors
      }
    }

    // 3 & 4. URL scrape + RSS fetch in parallel
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    const allUserText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n')
    const userTurnCount = messages.filter(m => m.role === 'user').length

    const urlMatch = lastUserMessage?.content.match(/https?:\/\/[^\s]+/)
    const userTextClean = lastUserMessage?.content.replace(/https?:\/\/[^\s]+/g, '').trim() || ''
    const researchTopic = buildAgentResearchTopic(userTextClean, allUserText)
    const keywords = extractGenerationKeywords(researchTopic || userTextClean)
    const hasDraftContext = hasPriorDraftContext(messages)
    const requestsNewTopic = isNewTopicRequest(userTextClean)
    const isFollowUpRevision = userTurnCount > 1 && !requestsNewTopic && isLightweightRevisionRequest(userTextClean)
    const shouldUseExternalResearch = generationMode === 'general' &&
      researchTopic.length >= 2 &&
      (!hasDraftContext || requestsNewTopic) &&
      !isFollowUpRevision
    const shouldUseRssFallback = generationMode === 'general' &&
      Boolean(lastUserMessage) &&
      (!hasDraftContext || requestsNewTopic) &&
      !isFollowUpRevision

    const [scrapeResult, researchBrief, rssResult] = await Promise.all([
      // URL scrape (only if URL present)
      urlMatch ? (async () => {
        try {
          const productContext = await collectBrandUrlContext(urlMatch[0])
          const scraped = productContext.promptContext.slice(0, 5000)
          const apiKey = process.env.OPENAI_API_KEY
          if (apiKey && apiKey.length > 10) {
            const openai = new OpenAI({
              apiKey,
              ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
            })
            const persuasion = await analyzePurchasePersuasionWithOpenAI({
              openai,
              collected: productContext,
              locale: language,
            })
            return { scraped, persuasion: formatPurchasePersuasionForPrompt(persuasion) }
          }
          return { scraped, persuasion: '' }
        } catch (err) {
          console.warn('[GenerateAgent] Scrape failed:', err)
          return { scraped: '', persuasion: '' }
        }
      })() : Promise.resolve({ scraped: '', persuasion: '' }),

      // OpenAI Web Search research (only for general/editorial mode)
      shouldUseExternalResearch ? (async () => {
        try {
          return await buildCarouselResearchBrief({
            topic: researchTopic,
            category: brand.industry || 'information',
            keyContent: [
              `프로필 분야: ${brand.industry || 'information'}`,
              `주요 독자: ${brand.targetAudience || '일반 독자'}`,
              `톤앤매너: ${brand.toneOfVoice || '명확하고 읽기 쉬운 톤'}`,
            ].join('\n'),
            contentType: normalizeGeneralProfileCategory(brand.industry),
            slideCount: 7,
            language: language || 'ko',
            mode: 'fast',
          })
        } catch (err) {
          console.warn('[GenerateAgent] OpenAI web research failed:', err)
          return null
        }
      })() : Promise.resolve(null),

      // RSS fetch (only for general mode)
      shouldUseRssFallback ? (async () => {
        try {
          return await fetchRssForGeneration({
            category: inferRssCategory(researchTopic || userTextClean, brand.industry || 'information'),
            keywords,
            topic: (researchTopic || userTextClean).slice(0, 80),
            limit: 5,
            language: language || 'ko',
          })
        } catch (err) {
          console.warn('[GenerateAgent] RSS fetch failed:', err)
          return null
        }
      })() : Promise.resolve(null),
    ])

    const scrapedContext = scrapeResult.scraped
    const purchasePersuasionContext = scrapeResult.persuasion
    const researchContext = formatResearchBriefForPrompt(researchBrief, language || 'ko')
    let rssContext = ''
    if (!researchContext && rssResult && rssResult.matched && rssResult.articles.length > 0) {
      const lines = [
        `[실시간 관련 뉴스 — ${rssResult.matched ? '주제 키워드 매칭' : '최신 뉴스'}]`,
        `아래 최신 뉴스를 참고하여 훅·슬라이드 흐름을 기획하세요. 실제 이슈 기반으로 제안해야 독자의 공감을 얻습니다.`,
        '',
      ]
      rssResult.articles.forEach((a, i) => {
        lines.push(`기사 ${i + 1}: ${a.title}`)
        if (a.description) lines.push(`  → ${a.description.slice(0, 150)}`)
      })
      rssContext = lines.join('\n')
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.length < 10) {
      const fallback: AgentResponse = {
        message: '안녕하세요! 상품이나 캠페인 정보가 수집되었으나, API Key 설정이 확인되지 않습니다. 기획을 바로 생성할까요?',
        ready: true,
        params: {
          topic: lastUserMessage?.content || '신규 캠페인',
          visualHint: 'dark-editorial',
          contentType: '저장형 카드뉴스',
          objective: '상품 홍보 및 브랜딩 강화',
          slideCount: 5,
          productUrl: null,
          brandAnalysis: 'API Key 없음으로 분석 스킵',
          targetEmotion: '호기심',
          hookDirection: '기본 타이틀 제공',
          recommendedCta: '프로필 링크 확인',
          reasonForStyle: '기본 에디토리얼 설정 적용',
          structurePreview: [
            { slideNumber: 1, role: 'Hook', description: '제품 소개 메인 헤드라인' },
            { slideNumber: 2, role: 'Detail', description: '디테일 정보' },
            { slideNumber: 3, role: 'CTA', description: '행동 유도' }
          ]
        }
      }
      return NextResponse.json(fallback)
    }

    const openai = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    })
    const model = getCopywritingModel()
    const diagnosticContext = {
      stepName: 'generate agent strategy',
      provider: 'openai' as const,
      model,
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(apiKey),
      userId: user.id,
      brandId: brand.id,
      metadata: { language, generationMode },
    }
    const systemPrompt = buildSystemPrompt(
      brand,
      preferencesText,
      [scrapedContext, purchasePersuasionContext, researchContext].filter(Boolean).join('\n\n'),
      language,
      generationMode,
      rssContext,
      userTurnCount
    )
    const modelMessages = requestsNewTopic
      ? messages.map(message => (
        message.role === 'assistant'
          ? { ...message, content: stripAgentMemoryContext(message.content) }
          : message
      ))
      : messages
    logAiDiagnostic({ status: 'start', ...diagnosticContext })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...modelMessages,
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4000,
    })
    logAiDiagnostic({
      status: 'success',
      ...diagnosticContext,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ message: '디렉터 기획 수립에 실패했습니다. 다시 말씀해 주세요.', ready: false })
    }

    let parsed: AgentResponse
    try {
      parsed = JSON.parse(content) as AgentResponse
    } catch (parseError) {
      console.error('[GenerateAgent] Invalid JSON response:', parseError, content)
      return NextResponse.json({
        message: '기획안 응답 형식이 올바르지 않았습니다. 같은 요청으로 한 번만 다시 시도해 주세요.',
        ready: false,
      }, { status: 502 })
    }

    // Validate parameters if the agent flagged ready
    if (parsed.ready && parsed.params) {
      if (!validateParams(parsed.params)) {
        return NextResponse.json({
          message: parsed.message || '세부 기획 매개변수 형식을 더 정교하게 다듬는 중입니다. 슬라이드 수와 원하는 스타일 방향을 간단히 말씀해 주세요.',
          ready: false,
        })
      }
      parsed.params.slideCount = Number(parsed.params.slideCount)
      normalizeDraftSlides(parsed.params, language || 'ko')
      if (!validateDraftSlides(parsed.params)) {
        parsed.ready = false
        parsed.message = language === 'en'
          ? 'I prepared the strategy, but the slide draft was incomplete. Please send the same request once more or add one preferred angle so I can return the full draft.'
          : '기획 방향은 잡혔지만 슬라이드 카피 초안이 완성되지 않았습니다. 같은 요청을 한 번만 다시 보내주시거나 원하는 관점을 한 줄만 덧붙여 주세요.'
      }
    }

    // Trust LLM's own ready/clarification judgment — no heuristic override
    if (!parsed.ready && parsed.clarification && !validateClarification(parsed.clarification)) {
      delete parsed.clarification
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[GenerateAgent] Error:', error)
    logAiDiagnostic({
      status: 'failure',
      stepName: 'generate agent strategy',
      provider: 'openai',
      model: getCopywritingModel(),
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(),
      ...readOpenAIError(error),
    })
    const mapped = getOpenAIUserFacingError(error)
    return NextResponse.json({ message: mapped.message, ready: false }, { status: mapped.status })
  }
}


function getOpenAIUserFacingError(error: unknown) {
  const err = error as {
    status?: number
    code?: string
    type?: string
    message?: string
    error?: { code?: string; type?: string; message?: string }
  }
  const status = err.status || 500
  const code = err.code || err.error?.code || ''
  const type = err.type || err.error?.type || ''
  const message = err.message || err.error?.message || ''
  const haystack = `${code} ${type} ${message}`.toLowerCase()

  if (status === 401 || haystack.includes('invalid_api_key')) {
    return {
      status: 401,
      message: 'OpenAI API 키가 올바르지 않습니다. 서버의 OPENAI_API_KEY 설정을 확인해 주세요.',
    }
  }
  if (status === 429 || haystack.includes('insufficient_quota') || haystack.includes('quota')) {
    return {
      status: 429,
      message: 'OpenAI API 사용량 한도 또는 결제 한도에 도달했습니다. 계정의 크레딧과 결제 상태를 확인해 주세요.',
    }
  }
  if (haystack.includes('model') && (haystack.includes('not found') || haystack.includes('does not exist') || haystack.includes('access'))) {
    return {
      status: 400,
      message: '설정된 OpenAI 모델에 접근할 수 없습니다. OPENAI_TEXT_MODEL 또는 OPENAI_COPY_MODEL 값을 사용 가능한 모델로 변경해 주세요.',
    }
  }
  if (haystack.includes('unsupported') || haystack.includes('invalid parameter') || haystack.includes('max_tokens') || haystack.includes('temperature')) {
    return {
      status: 400,
      message: 'OpenAI 요청 형식이 현재 모델과 맞지 않습니다. 서버가 최신 요청 형식으로 배포되었는지 확인한 뒤 다시 시도해 주세요.',
    }
  }
  if (status >= 500) {
    return {
      status: 502,
      message: 'OpenAI 응답이 일시적으로 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
    }
  }
  return {
    status,
    message: '기획안을 만드는 중 문제가 발생했습니다. 입력 내용을 조금 더 구체적으로 적어 다시 시도해 주세요.',
  }
}
