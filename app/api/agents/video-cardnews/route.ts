import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { getCopywritingModel } from '../../../../src/lib/ai/llmClient'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface VideoCardAgentRequest {
  messages: ChatMessage[]
  brandId: string
  language?: 'ko' | 'en'
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

interface VideoCardAgentResponse {
  message: string
  ready: boolean
  params?: {
    topic: string
    targetAndMessage?: string
    mood?: string
    objective?: string
    cta?: string
    mustInclude?: string
    avoid?: string
  }
  clarification?: ClarificationPrompt
}

const MAX_DIRECTOR_MESSAGES = 6
const MAX_DIRECTOR_MESSAGE_CHARS = 700

function compactDirectorMessages(messages: ChatMessage[]) {
  return messages
    .slice(-MAX_DIRECTOR_MESSAGES)
    .map(message => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_DIRECTOR_MESSAGE_CHARS),
    }))
    .filter(message => message.content.length > 0)
}

function buildSystemPrompt(brand: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
}, language?: 'ko' | 'en') {
  const isEn = language === 'en'
  const brandLine = isEn
    ? `Brand: ${brand.name}; category: ${brand.industry || 'unknown'}; audience: ${brand.targetAudience || 'general'}; tone: ${brand.toneOfVoice || 'clear'}.`
    : `브랜드: ${brand.name}; 업종: ${brand.industry || '미상'}; 타겟: ${brand.targetAudience || '일반'}; 톤: ${brand.toneOfVoice || '명확한 톤'}.`

  if (isEn) {
    return `You are Shuffla's video card news director. ${brandLine}
Build a compact production brief with 7 fields: topic, targetAndMessage, mood, objective, cta, mustInclude, avoid.
Decision: if topic and audience/message are inferable, set ready=true and infer the remaining fields conservatively. Ask at most one follow-up only when the core topic or audience/message is unclear.
Follow-up: one natural question, 2-3 concrete options, no long explanation.
Output valid JSON only:
ready=false -> {"message":"short follow-up","ready":false,"clarification":{"question":"one question","allowCustom":true,"skipLabel":"Use current info","options":[{"label":"short","value":"specific answer"}]}}
ready=true -> {"message":"short editable brief","ready":true,"params":{"topic":"refined topic","targetAndMessage":"audience + key message","mood":"visual mood","objective":"campaign purpose","cta":"final viewer action","mustInclude":"required facts/details","avoid":"things to avoid"}}`
  }

  return `당신은 Shuffla 영상 카드뉴스 디렉터입니다. ${brandLine}
제작 브리프 필드는 7개입니다: topic, targetAndMessage, mood, objective, cta, mustInclude, avoid.
판단: 주제와 타겟/메시지를 추론할 수 있으면 ready=true로 두고 나머지는 보수적으로 추론합니다. 핵심 주제나 타겟/메시지가 불명확할 때만 질문은 1개만 합니다.
질문: 짧고 자연스럽게, 선택지는 구체적인 2-3개, 장문 설명 금지.
유효한 JSON만 반환:
ready=false -> {"message":"짧은 후속 질문","ready":false,"clarification":{"question":"질문 1개","allowCustom":true,"skipLabel":"현재 정보로 진행","options":[{"label":"짧은 라벨","value":"구체 답변"}]}}
ready=true -> {"message":"짧은 수정 가능 기획안","ready":true,"params":{"topic":"정제 주제","targetAndMessage":"타겟+핵심 메시지","mood":"영상 분위기","objective":"제작 목적","cta":"마지막 행동 유도","mustInclude":"반드시 포함할 정보","avoid":"피해야 할 정보나 표현"}}`
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
  return {
    status,
    message: '기획안을 만드는 중 문제가 발생했습니다. 입력 내용을 조금 더 구체적으로 적어 다시 시도해 주세요.',
  }
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find(message => message.role === 'user')?.content.trim() || ''
}

function buildFallbackResponse(messages: ChatMessage[], language?: 'ko' | 'en'): VideoCardAgentResponse {
  const topic = getLastUserMessage(messages)
  if (language === 'en') {
    return {
      message: 'I prepared an editable brief from your request. Please review it before generation.',
      ready: true,
      params: {
        topic: topic || 'Video card news topic',
        targetAndMessage: 'People who need a short, clear vertical video card news flow. Show the main idea in a simple and persuasive way.',
        mood: 'Clean, bright, polished short-form tone with smooth motion and readable text.',
        objective: 'Explain the topic clearly and make viewers interested enough to continue.',
        cta: 'Invite viewers to learn more or try the service.',
        mustInclude: 'Use only details provided by the user or brand profile.',
        avoid: 'Avoid unsupported facts, exact text inside generated video, and exaggerated claims.',
      },
    }
  }

  return {
    message: '입력 내용을 바탕으로 수정 가능한 기획안을 준비했습니다. 생성 전에 확인해주세요.',
    ready: true,
    params: {
      topic: topic || '영상 카드뉴스 주제',
      targetAndMessage: '짧고 명확한 영상 카드뉴스가 필요한 사용자에게 핵심 메시지를 쉽고 설득력 있게 전달합니다.',
      mood: '깔끔하고 밝은 숏폼 톤, 부드러운 움직임, 읽기 쉬운 텍스트 중심',
      objective: '주제를 명확하게 설명하고 시청자가 다음 내용을 계속 보게 만듭니다.',
      cta: '더 알아보기 또는 바로 시도하기를 자연스럽게 유도합니다.',
      mustInclude: '사용자 입력과 브랜드 프로필에서 확인된 정보만 포함합니다.',
      avoid: '근거 없는 수치, 과장 표현, 생성 영상 내부의 정확한 텍스트 렌더링은 피합니다.',
    },
  }
}

function parseAgentResponse(content: string): VideoCardAgentResponse | null {
  try {
    return JSON.parse(content) as VideoCardAgentResponse
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
      return JSON.parse(jsonMatch[0]) as VideoCardAgentResponse
    } catch {
      return null
    }
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const body = await request.json() as VideoCardAgentRequest
    const { messages, brandId, language } = body

    if (!brandId) return NextResponse.json({ error: 'brandId가 필요합니다.' }, { status: 400 })

    const brand = await dbService.getBrand(brandId)
    if (!brand || brand.userId !== user.id) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!messages || messages.length === 0) {
      const greeting: VideoCardAgentResponse = language === 'en' ? {
        message: `Hello! I'm the Video Creative Director for ${brand.name}.\n\nPlease share the topic or keyword of the vertical video card news you'd like to create today!`,
        ready: false,
      } : {
        message: `안녕하세요! ${brand.name}의 영상 크리에이티브 디렉터입니다.
        
오늘 제작하고 싶으신 9:16 세로 영상 카드뉴스의 주제나 키워드를 알려주세요!`,
        ready: false,
      }
      return NextResponse.json(greeting)
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json(buildFallbackResponse(messages, language))
    }

    const openai = new OpenAI({ apiKey, ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}) })
    const model = getCopywritingModel()
    const systemPrompt = buildSystemPrompt(brand, language)
    const compactMessages = compactDirectorMessages(messages)

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...compactMessages],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: '기획 전략을 수립하는 데 실패했습니다.' }, { status: 500 })
    }

    const parsed = parseAgentResponse(content)
    if (!parsed) {
      console.error('[VideoCardAgent] Invalid JSON response:', content.slice(0, 500))
      return NextResponse.json(buildFallbackResponse(messages, language))
    }
    return NextResponse.json(parsed)

  } catch (error) {
    console.error('[VideoCardAgent] Error:', error)
    const mapped = getOpenAIUserFacingError(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
