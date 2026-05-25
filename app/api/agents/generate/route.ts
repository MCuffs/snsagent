import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GenerateAgentRequest {
  messages: ChatMessage[]
  brandId: string
}

interface GenerateParams {
  topic: string
  visualHint: string
  contentType: string
  objective: string
  slideCount: number
  productUrl?: string
}

interface AgentResponse {
  message: string
  ready: boolean
  params?: GenerateParams
}

const VISUAL_HINT_OPTIONS = ['dark-editorial', 'trend-feed', 'community-style', 'minimal-clean', 'breaking-news']
const CONTENT_TYPE_OPTIONS = ['저장형 카드뉴스', '구매 전환형', '계정 유입형', '교육 정보형', '브랜드 인지도형']

function buildSystemPrompt(brand: {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  brandDna?: string | null
}) {
  const dnaText = formatBrandDnaForPrompt(brand.brandDna)

  return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터입니다.
사용자와 자연스러운 대화를 통해 카드뉴스 생성에 필요한 정보를 수집합니다.

## 브랜드 정보
브랜드명: ${brand.name}
업종: ${brand.industry}
타겟 고객: ${brand.targetAudience}
톤앤매너: ${brand.toneOfVoice}

## 브랜드 DNA
${dnaText}

## 대화 규칙
- 반드시 한국어로 대화합니다
- 친근하고 전문적인 톤을 유지합니다
- 한 번에 너무 많은 질문을 하지 않습니다
- 사용자의 의도를 파악해 최적의 방향을 제안합니다
- 필요한 정보가 모두 모이면 즉시 생성을 준비합니다

## 수집해야 할 정보
1. topic: 홍보할 상품/주제 (예: "여름 반팔 티셔츠")
2. visualHint: 비주얼 스타일 — 반드시 다음 중 하나: ${VISUAL_HINT_OPTIONS.join(', ')}
3. contentType: 콘텐츠 목적 — 반드시 다음 중 하나: ${CONTENT_TYPE_OPTIONS.join(', ')}
4. objective: 캠페인 목표 (예: "저장 및 팔로우 유도", "구매 전환", "팔로워 유입")
5. slideCount: 슬라이드 수 — 반드시 5, 7, 10 중 하나
6. productUrl: 상품 URL (선택사항 — 없으면 null)

## 비주얼 힌트 선택 가이드
- dark-editorial: 무게감 있는 에디토리얼, 저장형 콘텐츠에 최적
- trend-feed: 트렌디한 인스타 피드, 구매 전환에 최적
- community-style: 커뮤니티 감성, 팔로워 유입에 최적
- minimal-clean: 깔끔한 미니멀, 정보형 콘텐츠에 최적
- breaking-news: 뉴스형 강렬함, 이슈/프로모션에 최적

## 응답 형식 (반드시 JSON)
정보가 불충분할 때:
{
  "message": "사용자에게 보낼 자연스러운 한국어 메시지",
  "ready": false
}

모든 정보가 수집되었을 때:
{
  "message": "좋아요! [topic]으로 [slideCount]장 [contentType] 카드뉴스를 만들게요. 바로 시작할까요?",
  "ready": true,
  "params": {
    "topic": "...",
    "visualHint": "dark-editorial",
    "contentType": "저장형 카드뉴스",
    "objective": "저장 및 팔로우 유도",
    "slideCount": 7,
    "productUrl": null
  }
}

중요: 사용자가 한 메시지에 모든 정보를 줬다면 (예: "여름 반팔 7장 다크로") 바로 ready=true로 응답하세요.`
}

function validateParams(params: unknown): params is GenerateParams {
  if (!params || typeof params !== 'object') return false
  const p = params as Record<string, unknown>
  if (!p.topic || typeof p.topic !== 'string') return false
  if (!p.visualHint || !VISUAL_HINT_OPTIONS.includes(p.visualHint as string)) return false
  if (!p.contentType || typeof p.contentType !== 'string') return false
  if (!p.objective || typeof p.objective !== 'string') return false
  if (!p.slideCount || ![5, 7, 10].includes(p.slideCount as number)) return false
  return true
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const body = await request.json() as GenerateAgentRequest
    const { messages, brandId } = body

    if (!brandId) return NextResponse.json({ error: 'brandId가 필요합니다.' }, { status: 400 })

    const brand = await dbService.getBrand(brandId)
    if (!brand || brand.userId !== user.id) {
      return NextResponse.json({ error: '브랜드를 찾을 수 없습니다.' }, { status: 404 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.length < 10) {
      // Fallback response when no API key
      const fallback: AgentResponse = {
        message: '안녕하세요! 오늘 어떤 상품을 소개할까요?',
        ready: false,
      }
      return NextResponse.json(fallback)
    }

    const openai = new OpenAI({
      apiKey,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    })

    const systemPrompt = buildSystemPrompt(brand)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 600,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ message: '다시 시도해주세요.', ready: false })
    }

    const parsed = JSON.parse(content) as AgentResponse

    // Validation gate: if ready=true, verify params are complete
    if (parsed.ready && parsed.params) {
      if (!validateParams(parsed.params)) {
        return NextResponse.json({
          message: parsed.message || '정보를 조금 더 확인할게요. 슬라이드 수(5, 7, 10장)와 스타일을 알려주세요.',
          ready: false,
        })
      }
      // Normalize slideCount to number
      parsed.params.slideCount = Number(parsed.params.slideCount)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[GenerateAgent]', error)
    return NextResponse.json({ message: '오류가 발생했습니다. 다시 시도해주세요.', ready: false }, { status: 500 })
  }
}
