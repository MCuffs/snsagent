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
  }
  clarification?: ClarificationPrompt
}

function buildSystemPrompt(brand: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
}, language?: 'ko' | 'en') {
  const isEn = language === 'en'

  if (isEn) {
    return `You are Shuffla's dynamic Video Card News Creative Director.
The user wants to create a 9:16 vertical video card news post.
Your goal is to guide the user in a natural, creative dialogue to collect or infer the following parameters:
1. topic (Clear and refined video news topic)
2. targetAndMessage (The target audience and the key message to deliver)
3. mood (Visual mood and tone, e.g., "emotional & warm", "informative", "dynamic & bold", "minimal & sophisticated")

## Guidelines:
- **Do not ask robotic, dry templated questions** or repeat the same list of options over and over. Ask a topic-tailored, creative follow-up question.
- Based on the user's input, suggest creative visual scene concepts or ideas rather than just asking for details.
- Provide 2-3 topic-specific, creative options in the 'options' field to help them choose easily.
- If you already have enough information from the user's initial or subsequent inputs, return ready: true with the extracted parameters in the 'params' field.

## JSON Response Formats:
When ready: false (need more detail):
{
  "message": "Friendly and creative conversational follow-up question.",
  "ready": false,
  "clarification": {
    "question": "The specific question about the video direction.",
    "allowCustom": true,
    "skipLabel": "Use current info",
    "options": [
      { "label": "Short label for Option 1", "value": "Option 1 value/response text" },
      { "label": "Short label for Option 2", "value": "Option 2 value/response text" }
    ]
  }
}

When ready: true (have enough info to generate):
{
  "message": "Strategic briefing summary of what we will create.",
  "ready": true,
  "params": {
    "topic": "The refined and clean topic",
    "targetAndMessage": "The target audience and key message",
    "mood": "Selected visual mood/tone"
  }
}`
  }

  return `당신은 Shuffla의 인스타그램 영상 카드뉴스 크리에이티브 디렉터입니다.
사용자는 인스타그램 릴스/숏폼용 9:16 세로 영상 카드뉴스를 제작하려고 합니다.
당신의 역할은 사용자와의 창의적이고 자연스러운 대화를 통해 아래의 핵심 정보 3가지를 도출하거나 추론하는 것입니다.
1. topic (영상 카드뉴스의 주제)
2. targetAndMessage (이 영상을 보게 될 타겟 독자 및 전달하고자 하는 핵심 메시지)
3. mood (영상의 전반적인 비주얼 분위기 및 톤, 예: "감성적·따뜻한", "정보 전달형", "역동적·강렬한", "미니멀·세련된")

## 대화 및 질문 가이드:
- **기계적이거나 룰베이스 챗봇 같은 하드코딩된 질문("독자가 누구인가요? 메시지가 무엇인가요?")을 반복하지 마세요.**
- 사용자의 입력(주제)에 따라, 사용자가 비주얼을 쉽게 구상할 수 있도록 주제에 특화된 창의적인 아이디어나 비주얼 무드를 제안하며 자연스럽게 질문을 이어나가세요.
- 사용자가 쉽게 응답할 수 있도록, 대화 맥락에 직접적으로 연관된 **구체적이고 매력적인 2~3개의 선택지(options)**를 함께 제공하세요.
- 사용자가 보낸 첫 메시지나 대화 과정에서 이미 충분히 기획 방향이 도출되었다고 판단되면 즉시 ready: true를 반환하고 추출된 값들을 params에 담아주세요.

## JSON 응답 형식:
추가 정보가 필요할 때 (ready: false):
{
  "message": "사용자에게 보낼 부드럽고 친근한 맞춤형 대화문",
  "ready": false,
  "clarification": {
    "question": "기획을 구체화하기 위해 사용자에게 던질 핵심 질문",
    "allowCustom": true,
    "skipLabel": "현재 정보로 진행",
    "options": [
      { "label": "옵션 1의 간단한 라벨", "value": "사용자가 이 옵션을 골랐을 때 전송될 답변 내용" },
      { "label": "옵션 2의 간단한 라벨", "value": "사용자가 이 옵션을 골랐을 때 전송될 답변 내용" }
    ]
  }
}

준비가 완료되었을 때 (ready: true):
{
  "message": "기획안 요약과 생성 확인 메시지",
  "ready": true,
  "params": {
    "topic": "정제된 구체적 주제",
    "targetAndMessage": "분석된 타겟 독자 및 핵심 메시지",
    "mood": "결정된 영상 분위기 및 톤"
  }
}`
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
      return NextResponse.json({ error: 'OpenAI API 키 설정이 확인되지 않습니다.' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey, ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}) })
    const model = getCopywritingModel()
    const systemPrompt = buildSystemPrompt(brand, language)

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: '기획 전략을 수립하는 데 실패했습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(content) as VideoCardAgentResponse
    return NextResponse.json(parsed)

  } catch (error) {
    console.error('[VideoCardAgent] Error:', error)
    const mapped = getOpenAIUserFacingError(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
