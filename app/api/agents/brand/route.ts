import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { parseBrandDna } from '../../../../lib/brand-dna'

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

  return `당신은 한국 브랜드 전략가입니다. 사용자의 브랜드 프로필을 대화를 통해 개선합니다.

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
- 브랜드 정체성을 더 명확하게 다듬도록 돕습니다
- 사용자의 말에서 브랜드 정보를 추출합니다
- 필드를 업데이트할 준비가 되면 updates에 포함합니다

## 대화 규칙
- 한국어로만 대화합니다
- 구체적이고 따뜻한 피드백을 줍니다
- 한 번에 1-2가지만 물어봅니다
- 사용자가 정보를 주면 바로 updates에 반영합니다

## 응답 형식 (반드시 JSON)
업데이트할 내용이 없을 때:
{
  "message": "한국어 메시지"
}

업데이트할 내용이 있을 때:
{
  "message": "필드를 업데이트했습니다. 확인해보세요.",
  "updates": {
    "toneOfVoice": "새로운 톤앤매너",
    "brandDescription": "새로운 브랜드 설명"
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: buildSystemPrompt(brand) },
        ...messages,
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 800,
    })

    const content = response.choices[0]?.message?.content
    if (!content) return NextResponse.json({ message: '다시 시도해주세요.' })

    const parsed = JSON.parse(content) as BrandAgentResponse
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[BrandAgent]', error)
    return NextResponse.json({ message: '오류가 발생했습니다. 다시 시도해주세요.' }, { status: 500 })
  }
}
