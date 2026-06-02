import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { parseBrandDna } from '../../../../lib/brand-dna'
import { getCopywritingModel } from '../../../../src/lib/ai/llmClient'
import {
  getOpenAIBaseURLHost,
  getOpenAIKeyFingerprint,
  logAiDiagnostic,
  readOpenAIError,
} from '../../../../src/lib/ai/diagnostics'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BrandAgentRequest {
  messages: ChatMessage[]
  brandId: string
}

interface BrandProfileUpdates {
  name?: string
  industry?: string
  targetAudience?: string
  toneOfVoice?: string
  mainColor?: string
  brandDescription?: string
}

interface BrandAgentResponse {
  message: string
  updates?: BrandProfileUpdates
}

function buildSystemPrompt(brand: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  brandDna?: string | null
}) {
  const dna = parseBrandDna(brand.brandDna)

  return `당신은 노련하고 따뜻한 시각을 가진 한국 브랜드 전략가입니다. 사용자와의 대화를 통해 자연스럽게 브랜드 정체성을 이끌어내고 프로필을 멋지게 완성할 수 있도록 돕습니다.

## 현재 브랜드 프로필
- 브랜드명: ${brand.name}
- 업종: ${brand.industry}
- 타겟 고객: ${brand.targetAudience}
- 톤앤매너: ${brand.toneOfVoice}
- 브랜드 컬러: ${brand.mainColor}
- 브랜드 설명: ${dna.brandDescription || '(미설정)'}
- 핵심 제품: ${dna.coreProducts.join(', ') || '(미설정)'}
- 차별점: ${dna.differentiators.join(', ') || '(미설정)'}

## 역할
- 브랜드 정체성을 더 명확하게 다듬도록 돕습니다.
- 사용자의 말에서 유용한 브랜드 정보를 추출하여 반영합니다.
- 필드를 업데이트할 준비가 되면 updates에 포함합니다.

## 대화 규칙
- **오직 자연스러운 한국어 줄글로만 작성하십시오.** 로봇이나 AI가 템플릿을 읽어주는 듯한 말투(예: "업데이트가 완료되었습니다. 분석 결과에 따르면...")는 절대로 피하고, 진심으로 고민해주는 인간 크리에이티브 파트너처럼 다정하고 전문적으로 이야기하세요.
- **마크다운 서식 절대 금지**: 별표 두 개(\`**\`)를 사용한 볼드체 표기, 별표 한 개(\`*\`)를 사용한 이탤릭, 샵(\`#\`)을 사용한 제목 기호 등 모든 종류의 마크다운 강조 기호를 **어떠한 상황에서도 절대 사용하지 마십시오.** 일반 텍스트 문장과 가벼운 줄바꿈으로만 의사를 전달해야 합니다.
- 한 번에 너무 많은 것을 요구하지 않고, 1-2가지 화두에 대해 친근하고 구체적으로 묻고 답하십시오.
- 사용자가 브랜드 스토리를 들려주면 칭찬과 공감을 보낸 뒤 즉시 해당 필드에 어울리는 글로 정돈하여 updates에 제안하십시오.

## 응답 형식 (반드시 JSON)
업데이트할 내용이 없을 때:
{
  "message": "안녕하세요! Mocha Studio의 방향성에 대해 들려주신 이야기를 정돈해보았어요. 브랜드가 지닌 따뜻함과 신뢰감이 잘 묻어나는 설명입니다."
}

업데이트할 내용이 있을 때:
{
  "message": "들려주신 내용을 반영하여 브랜드 설명을 조금 더 감성적이고 정돈된 문체로 보완해보았습니다. 수정된 내용을 확인해보시겠어요?",
  "updates": {
    "toneOfVoice": "신뢰감 있고 따뜻한",
    "brandDescription": "새로운 브랜드 설명 내용"
  }
}

변경할 필드만 updates에 포함합니다. 변경하지 않는 필드는 포함하지 마세요.
mainColor는 반드시 #RRGGBB 형식이어야 합니다.`
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const body = await request.json() as BrandAgentRequest
    const { messages, brandId } = body

    if (!brandId) return NextResponse.json({ error: 'brandId가 필요합니다.' }, { status: 400 })

    const brand = await dbService.getBrand(brandId)
    if (!brand || brand.userId !== user.id) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json({ message: '브랜드에 대해 더 알려주시면 프로필을 개선해드릴게요!' })
    }

    const openai = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    })
    const model = getCopywritingModel()
    const diagnosticContext = {
      stepName: 'brand agent profile',
      provider: 'openai' as const,
      model,
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(apiKey),
    }

    logAiDiagnostic({ status: 'start', ...diagnosticContext })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(brand) },
        ...messages,
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 800,
    })
    logAiDiagnostic({
      status: 'success',
      ...diagnosticContext,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return NextResponse.json({ message: '다시 시도해주세요.' })

    const parsed = JSON.parse(content) as BrandAgentResponse
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[BrandAgent]', error)
    logAiDiagnostic({
      status: 'failure',
      stepName: 'brand agent profile',
      provider: 'openai',
      model: getCopywritingModel(),
      baseURL: getOpenAIBaseURLHost(),
      keyFingerprint: getOpenAIKeyFingerprint(),
      ...readOpenAIError(error),
    })
    return NextResponse.json({ message: '오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
