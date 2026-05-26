import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'
import { collectBrandUrlContext } from '../../../../lib/brand-url-collector'

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
  productUrl?: string | null
  brandAnalysis?: string
  targetEmotion?: string
  hookDirection?: string
  recommendedCta?: string
  reasonForStyle?: string
  expectedGoal?: string
  saveProbability?: string
  structurePreview?: { slideNumber: number; role: string; description: string }[]
}

interface AgentResponse {
  message: string
  ready: boolean
  params?: GenerateParams
}

const VISUAL_HINT_OPTIONS = ['dark-editorial', 'trend-feed', 'community-style', 'minimal-clean', 'breaking-news']
const CONTENT_TYPE_OPTIONS = ['저장형 카드뉴스', '구매 전환형', '계정 유입형', '교육 정보형', '브랜드 인지도형']

function buildSystemPrompt(
  brand: {
    name: string
    industry: string
    targetAudience: string
    toneOfVoice: string
    brandDna?: string | null
  },
  preferencesText: string,
  scrapedContext: string
) {
  const dnaText = formatBrandDnaForPrompt(brand.brandDna)

  return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 브랜드 콘텐츠 전략가입니다.
사용자가 상품명, 캠페인 주제, 또는 상품 URL을 입력하면, 브랜드 프로필과 감성 선호도를 깊이 분석하여 카드뉴스 전략 기획서와 구조 프리뷰를 함께 제안해 주어야 합니다.

## 브랜드 정보
브랜드명: ${brand.name}
업종: ${brand.industry}
타겟 고객: ${brand.targetAudience}
톤앤매너: ${brand.toneOfVoice}

## 브랜드 DNA
${dnaText}

## 사용자의 과거 디자인 선호 스타일 (중요)
${preferencesText}

${scrapedContext ? `## 이번에 스크래핑된 상품 페이지 분석 정보\n${scrapedContext}\n` : ''}

## 대화 규칙 및 역할
- 당신은 단순 질문을 던지는 설문 시스템이 아닙니다. 사용자의 한두 단어 입력만으로도 브랜드를 대표할 수 있는 매력적인 기획안과 레이아웃(비주얼 스타일), 콘텐츠 구조를 "스스로 생각해서 먼저 제안"합니다.
- 대화는 단순 설문이 아닌 전문적인 전략 미팅처럼 느껴지도록 차분하고 설득력 있는 어조로 답변하십시오.
- 이미 제안된 기획안에 대해 사용자가 피드백(예: "더 밝게 해줘", "5장으로 수정해줘")을 준다면, 그 피드백을 수용하여 비주얼 스타일, 슬라이드 수 등을 수정하고 기획안을 즉시 업데이트해 주어야 합니다.

## 추천안 설정 가이드
1. visualHint (비주얼 스타일): 다음 중 하나만 제안
   - 'dark-editorial': 차분하고 진중한 감성 에디토리얼, 럭셔리/패션 브랜드 및 소장용 정보 카드에 추천.
   - 'trend-feed': 캐주얼하고 선명한 이미지 중심, 트렌디 피드, 구매 유도 및 즉각적인 CTR 극대화에 추천.
   - 'community-style': 커뮤니티 정보 공유 느낌, 친근한 대화 및 유저 반응 유도에 추천.
   - 'minimal-clean': 깔끔한 배경과 여백 위주, 미니멀하고 심플한 브랜드, 교육 및 제품 특징 요약에 추천.
   - 'breaking-news': 보도자료 또는 강렬한 강조, 이슈 중심의 대담한 폰트와 프로모션에 추천.
2. contentType (콘텐츠 목적): 다음 중 하나만 제안
   - '저장형 카드뉴스', '구매 전환형', '계정 유입형', '교육 정보형', '브랜드 인지도형'
3. objective: 캠페인 목표 (사용자 입력과 브랜드 DNA를 조화시켜 자연스럽고 설득력 있는 단문으로 작성)
4. slideCount (슬라이드 수): 5, 7, 10 중 하나 추천 (기본적으로 5장 또는 7장 추천)

## 응답 형식 (반드시 JSON)
주제나 URL이 제공되어 기획안을 추천할 수 있을 때:
{
  "message": "PYEARCHIVE의 브랜드 톤앤매너와 제품을 분석한 결과에 따른 전략 기획안 브리핑을 작성하세요. 마크다운 스타일을 활용하여 슬라이드 추천 흐름, 비주얼 선정 이유를 정중하고 차분하게 요약해 주세요. 그리고 마지막에는 '이 방향으로 생성해 드릴까요?'와 같이 승인을 구하는 질문으로 마무리하세요.",
  "ready": true,
  "params": {
    "topic": "상품/주제 이름 (예: PYE Essential Bag 001)",
    "visualHint": "dark-editorial", // 추천 비주얼 힌트
    "contentType": "저장형 카드뉴스", // 추천 콘텐츠 목적
    "objective": "타겟 유저의 소장(저장) 가치를 극대화하여 계정 팔로우 유도",
    "slideCount": 5, // 5, 7, 10 중 하나
    "productUrl": "http... (사용자가 입력한 URL이 있다면 기입, 없으면 null)",
    "brandAnalysis": "브랜드가 가진 미니멀하고 정돈된 감성을 적극적으로 반영",
    "targetEmotion": "나만 알고 싶은 브랜드에 대한 특별함 및 소유 욕구",
    "hookDirection": "일상의 무질서 속에서 균형을 잡는 에센셜 라이프 제안",
    "recommendedCta": "상세 스토어 이동 및 컬렉션 라인업 탐색 유도",
    "reasonForStyle": "해당 브랜드의 시그니처 정돈감을 극대화하기 위해 여백이 돋보이는 dark-editorial 스타일을 기획했습니다.",
    "expectedGoal": "타겟 도달 범위 확장 및 공유/저장 지표 30% 증가",
    "saveProbability": "92%", // 숫자 및 퍼센트로 입력 (예: 92%, 85%)
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "일상의 질서를 완성하는 파이 에센셜 백 소개" },
      { "slideNumber": 2, "role": "Context", "description": "불필요한 짐은 덜어내고 꼭 필요한 것만 정돈하는 생활" },
      { "slideNumber": 3, "role": "Detail", "description": "파이 에센셜 백 001의 미니멀한 실루엣과 수납력" },
      { "slideNumber": 4, "role": "Detail", "description": "시간이 흐를수록 깊어지는 텍스처와 색감 전달" },
      { "slideNumber": 5, "role": "Save CTA", "description": "계정 팔로우하고 나의 일상에 질서를 더할 팁 소장하기" }
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

    // 1. If history is empty, immediately return greeting message (minimizes OpenAI API load)
    if (!messages || messages.length === 0) {
      const greeting: AgentResponse = {
        message: `안녕하세요! **${brand.name}**의 AI 콘텐츠 디렉터입니다.\n\n오늘 인스타그램에 소개하고 싶으신 **상품의 URL**이나 **캠페인 주제(예: 미니멀 가죽백 신상품 출시)**를 입력해 주세요. 브랜드 DNA와 선호 디자인 무드를 분석하여 최적의 카드뉴스 구성 전략을 기획해 드리겠습니다.`,
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

    // 3. Detect URL in the latest user message and scrape
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    let scrapedContext = ''
    if (lastUserMessage) {
      const urlMatch = lastUserMessage.content.match(/https?:\/\/[^\s]+/)
      if (urlMatch) {
        try {
          const productContext = await collectBrandUrlContext(urlMatch[0])
          scrapedContext = productContext.sourceText.slice(0, 3000)
        } catch (err) {
          console.warn('[GenerateAgent] Scrape failed:', err)
        }
      }
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
          expectedGoal: '브랜드 인지도 상승',
          saveProbability: '80%',
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

    const systemPrompt = buildSystemPrompt(brand, preferencesText, scrapedContext)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1200,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ message: '디렉터 기획 수립에 실패했습니다. 다시 말씀해 주세요.', ready: false })
    }

    const parsed = JSON.parse(content) as AgentResponse

    // Validate parameters if the agent flagged ready
    if (parsed.ready && parsed.params) {
      if (!validateParams(parsed.params)) {
        return NextResponse.json({
          message: parsed.message || '세부 기획 매개변수 형식을 더 정교하게 다듬는 중입니다. 슬라이드 수와 원하는 스타일 방향을 간단히 말씀해 주세요.',
          ready: false,
        })
      }
      parsed.params.slideCount = Number(parsed.params.slideCount)
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('[GenerateAgent] Error:', error)
    return NextResponse.json({ message: '기획안 도출 과정에서 오류가 발생했습니다. 다시 제안 요청을 해주세요.', ready: false }, { status: 500 })
  }
}
