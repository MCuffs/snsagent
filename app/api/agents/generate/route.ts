import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getSessionUser } from '../../../actions'
import { dbService } from '../../../../lib/db-service'
import { formatBrandDnaForPrompt } from '../../../../lib/brand-dna'
import { collectBrandUrlContext } from '../../../../lib/brand-url-collector'
import { analyzePurchasePersuasionWithOpenAI, formatPurchasePersuasionForPrompt } from '../../../../lib/purchase-persuasion'
import { extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../../../../src/lib/rss/rssFetcher'
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

interface GenerateAgentRequest {
  messages: ChatMessage[]
  brandId: string
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
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
  rssContext?: string
) {
  const isGeneral = generationMode === 'general'
  const dnaText = formatBrandDnaForPrompt(brand.brandDna)

  if (isGeneral) {
    return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 정보/시사/트렌드 콘텐츠 전략가입니다.
사용자가 뉴스 기사, 정보글, 또는 트렌드 글을 입력하면, 이를 깊이 분석하여 일반 정보 전달용 카드뉴스 전략 기획서와 구조 프리뷰를 함께 제안해 주어야 합니다.

## 이번 카드뉴스 유형 (중요)
- 본 콘텐츠는 브랜드 홍보용이 아닌, 일반 정보/시사/트렌드 요약 전달용 카드뉴스입니다.
- 브랜드 고유의 이름, 브랜드 DNA, 또는 특정 브랜드의 업종을 카피나 레이아웃 기획에 강제로 대입하지 마십시오.
- 타겟 고객 및 제공된 정보글(원문/RSS)의 객관적 팩트에 전적으로 초점을 맞추어 텍스트를 구성해야 합니다.
- 톤앤매너는 대중이 이해하기 쉬우며 신뢰감 있고 명확한 에디토리얼 어조(예: 뉴닉, 대학내일 정보성 피드 스타일)를 기본으로 취하십시오.

## 사용자의 과거 디자인 선호 스타일 (비주얼/레이아웃 테마용)
${preferencesText}

${rssContext ? `## 실시간 수집된 관련 뉴스 (훅 및 슬라이드 기획의 핵심 근거로 활용)\n${rssContext}\n\n위 뉴스 기사들의 실제 이슈, 트렌드 키워드, 구체적 사실을 훅 방향과 슬라이드 흐름에 반드시 반영하세요.\n` : ''}
${scrapedContext ? `## 이번에 수집된 기사/정보 본문 분석 정보\n${scrapedContext}\n` : ''}

## 대화 규칙 및 역할
- **크리에이티브 디렉터의 목소리**: 기계적 답변을 지양하고, 정보 콘텐츠 기획 전문가로서 주도적으로 레이아웃과 흐름을 설계해 주십시오. "질문을 수집하여 분석했다"가 아니라 "정보의 핵심을 이렇게 요약해 흐름을 잡았다"는 관점에서 제안하십시오.
- **마크다운 서식 절대 사용 금지**: **별표(\`**\` 또는 \`*\`), 샵(\`#\`)을 이용한 타이틀 구성 등 마크다운 스타일은 사용자가 읽기에 불필요한 AI 기계음 느낌을 줍니다. **어떠한 강조 기호도 사용하지 말고**, 오직 일반 텍텍스트, 평이한 문장, 그리고 자연스러운 단락 구분(줄바꿈)만을 활용하십시오. 필요 시 대시(\`-\`) 또는 일반 번호를 사용한 목록 형태로만 깔끔하게 나열하십시오.
- 당신은 단순 질문을 던지는 설문 시스템이 아닙니다. 사용자의 한두 단어 입력만으로도 브랜드를 대표할 수 있는 매력적인 기획안과 레이아웃(비주얼 스타일), 콘텐츠 구조를 "스스로 생각해서 먼저 제안"합니다.
- 단, 사용자의 입력에 주제·대상·관점이 거의 없어 실제 카드뉴스 품질이 낮아질 경우에는 무리하게 생성하지 말고 ready를 false로 두고 clarification을 반환하세요. clarification은 사용자가 바로 고를 수 있는 3~4개의 구체 선택지를 포함해야 합니다.
- 이미 제안된 기획안에 대해 사용자가 피드백(예: "더 밝게 해줘", "5장으로 수정해줘")을 준다면, 그 피드백을 수용하여 비주얼 스타일, 슬라이드 수 등을 수정하고 기획안을 즉시 업데이트해 주어야 합니다.
- message는 채팅창에서 편하게 읽히도록 세 문단, 총 220자 이내로 작성하십시오. 정보의 핵심 내용 요약, 슬라이드 흐름 소개, 생성 의사 확인 질문만 담으십시오.
- 성과 지표나 도달률 등 근거 없는 예측 수치는 작성하지 마십시오.

## 추천안 설정 가이드
1. visualHint (비주얼 스타일): 다음 중 하나만 제안
   - 'breaking-news': 보도자료 또는 강렬한 강조, 이슈 중심의 대담한 폰트와 프로모션에 추천. (일반 시사/트렌드 뉴스에 강력 추천)
   - 'minimal-clean': 깔끔한 배경과 여백 위주, 미니멀하고 심플한 브랜드, 교육 및 제품 특징 요약에 추천.
   - 'trend-feed': 캐주얼하고 선명한 이미지 중심, 트렌디 피드, 구매 유도 및 즉각적인 CTR 극대화에 추천.
   - 'community-style': 커뮤니티 정보 공유 느낌, 친근한 대화 및 유저 반응 유도에 추천.
   - 'dark-editorial': 차분하고 진중한 감성 에디토리얼, 럭셔리/패션 브랜드 및 소장용 정보 카드에 추천.
2. contentType (콘텐츠 목적): 다음 중 하나만 제안
   - '교육 정보형', '저장형 카드뉴스', '계정 유입형'
3. objective: 캠페인 목표 (정보 전달과 유저 소장 욕구 자극 등을 고려한 설득력 있는 단문으로 작성)
4. slideCount (슬라이드 수): 5, 7, 10 중 하나 추천 (정보의 분량에 맞춰 추천)

## 응답 형식 (반드시 JSON)
주제나 본문 정보가 제공되어 기획안을 추천할 수 있을 때:
{
  "message": "수집된 정보의 트렌디하고 시급한 특성을 살려, 대담한 타이포와 명확한 팩트가 강조되는 breaking-news 스타일 카드뉴스로 제안합니다.\\n\\n첫 장에서 핵심 이슈를 던지고, 배경 설명과 구체적 근거를 거쳐 요약으로 이어지는 정보 전달 흐름입니다.\\n\\n이 방향으로 카드뉴스를 생성할까요?",
  "ready": true,
  "params": {
    "topic": "정보/이슈 요약 제목 (예: 2026년 하반기 주요 테크 트렌드)",
    "visualHint": "breaking-news", // 추천 비주얼 힌트
    "contentType": "교육 정보형", // 추천 콘텐츠 목적
    "objective": "정보 전달을 통해 타겟 독자의 소장 및 계정 유입 극대화",
    "slideCount": 5, // 5, 7, 10 중 하나
    "productUrl": "http... (사용자가 입력한 URL이 있다면 기입, 없으면 null)",
    "brandAnalysis": "최신 트렌드/시사 뉴스의 전달력을 높이기 위해 직관적이고 팩트 중심의 레이아웃 기획",
    "targetEmotion": "새로운 정보를 가장 빠르게 습득했다는 지적 호기심 충족",
    "hookDirection": "놓치기 쉬운 트렌드 변화를 한 번에 요약 정리",
    "recommendedCta": "게시물 저장 및 관련 뉴스 소식 팔로우 유도",
    "reasonForStyle": "정보성 뉴스의 전달과 신뢰감을 극대화하기 위해 대담한 breaking-news 스타일을 선택했습니다.",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "가장 주목해야 할 테크 트렌드 핵심 헤드라인" },
      { "slideNumber": 2, "role": "Context", "description": "이 트렌드가 나타난 배경 및 최근 사회적 변화" },
      { "slideNumber": 3, "role": "Detail", "description": "트렌드를 이루는 3가지 핵심 세부 특징 요약" },
      { "slideNumber": 4, "role": "Detail", "description": "실제 유저나 기업들이 겪는 실사례와 실질적 영향" },
      { "slideNumber": 5, "role": "Save CTA", "description": "카드뉴스 저장하고 내일 아침 트렌드 빠르게 챙겨보기" }
    ]
  }
}

정보가 부족해 추가 수집이 필요할 때:
{
  "message": "좋은 카드뉴스를 만들기에는 정보가 아직 조금 넓습니다.\n\n아래 방향 중 하나를 고르거나 직접 답변해 주세요. 선택한 내용을 바탕으로 훅과 슬라이드 흐름을 더 정확하게 잡겠습니다.",
  "ready": false,
  "clarification": {
    "question": "이번 카드뉴스에서 어떤 관점을 가장 강조할까요?",
    "allowCustom": true,
    "skipLabel": "현재 정보로 진행",
    "options": [
      { "label": "효능/장점 정리", "value": "주제의 효능과 장점을 구체적으로 정리한 카드뉴스" },
      { "label": "체크리스트", "value": "실생활에서 확인할 체크리스트형 카드뉴스" },
      { "label": "요즘 이슈 연결", "value": "최근 트렌드와 연결한 정보성 카드뉴스" }
    ]
  }
}${language === 'en' ? '\n\nIMPORTANT: You are operating in English mode. Write ALL your messages, strategy briefs, and JSON fields entirely in English. Do not use Korean in any output.' : ''}`
  }

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
- **인간 크리에이티브 디렉터의 목소리**: 기계적이거나 정형화된 챗봇 문투는 피하고, 전문 에이전시의 든든한 파트너로서 예의를 갖추되 정답을 주도적으로 제시하는 전문가 톤을 취하십시오. "질문을 수집하여 분석했다"는 형태가 아니라, "브랜드의 매력을 이렇게 해석했다"는 관점에서 제안하십시오.
- **마크다운 서식 절대 사용 금지**: **별표(\`**\` 또는 \`*\`), 샵(\`#\`)을 이용한 타이틀 구성 등 마크다운 스타일은 사용자가 읽기에 불필요한 AI 기계음 느낌을 줍니다. **어떠한 강조 기호도 사용하지 말고**, 오직 일반 텍텍스트, 평이한 문장, 그리고 자연스러운 단락 구분(줄바꿈)만을 활용하십시오. 필요 시 대시(\`-\`) 또는 일반 번호를 사용한 목록 형태로만 깔끔하게 나열하십시오.
- 당신은 단순 질문을 던지는 설문 시스템이 아닙니다. 사용자의 한두 단어 입력만으로도 브랜드를 대표할 수 있는 매력적인 기획안과 레이아웃(비주얼 스타일), 콘텐츠 구조를 "스스로 생각해서 먼저 제안"합니다.
- 단, 사용자의 입력에 상품·캠페인·고객 문제·핵심 관점이 거의 없어 실제 카드뉴스 품질이 낮아질 경우에는 무리하게 생성하지 말고 ready를 false로 두고 clarification을 반환하세요. clarification은 사용자가 바로 고를 수 있는 3~4개의 구체 선택지를 포함해야 합니다.
- 이미 제안된 기획안에 대해 사용자가 피드백(예: "더 밝게 해줘", "5장으로 수정해줘")을 준다면, 그 피드백을 수용하여 비주얼 스타일, 슬라이드 수 등을 수정하고 기획안을 즉시 업데이트해 주어야 합니다.
- message는 채팅창에서 편하게 읽히도록 세 문단, 총 220자 이내로 작성하십시오. 콘셉트 해석, 슬라이드 흐름 요약, 생성 여부 확인 질문만 담으십시오.
- 성과 증가율, 저장 확률 등 확인할 근거가 없는 수치나 예측 지표는 message와 params 어디에도 작성하지 마십시오.

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
  "message": "PYEARCHIVE의 정돈된 감성을 살려, 여백과 제품 실루엣이 돋보이는 에디토리얼 카드뉴스로 제안합니다.\\n\\n첫 장에서 일상의 질서를 이야기하고, 디테일과 수납 장면을 거쳐 컬렉션 탐색으로 이어갑니다.\\n\\n이 방향으로 카드뉴스를 생성할까요?",
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
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "일상의 질서를 완성하는 파이 에센셜 백 소개" },
      { "slideNumber": 2, "role": "Context", "description": "불필요한 짐은 덜어내고 꼭 필요한 것만 정돈하는 생활" },
      { "slideNumber": 3, "role": "Detail", "description": "파이 에센셜 백 001의 미니멀한 실루엣 and 수납력" },
      { "slideNumber": 4, "role": "Detail", "description": "시간이 흐를수록 깊어지는 텍스처와 색감 전달" },
      { "slideNumber": 5, "role": "Save CTA", "description": "계정 팔로우하고 나의 일상에 질서를 더할 팁 소장하기" }
    ]
  }
}

정보가 부족해 추가 수집이 필요할 때:
{
  "message": "좋은 카드뉴스를 만들기에는 정보가 아직 조금 넓습니다.\n\n아래 방향 중 하나를 고르거나 직접 답변해 주세요. 선택한 내용을 바탕으로 훅과 슬라이드 흐름을 더 정확하게 잡겠습니다.",
  "ready": false,
  "clarification": {
    "question": "이번 카드뉴스에서 무엇을 가장 강조할까요?",
    "allowCustom": true,
    "skipLabel": "현재 정보로 진행",
    "options": [
      { "label": "신상품 소개", "value": "신상품 또는 대표 상품을 소개하는 카드뉴스" },
      { "label": "고객 고민 해결", "value": "고객의 고민을 해결하는 정보형 카드뉴스" },
      { "label": "브랜드 스토리", "value": "브랜드 차별점과 스토리를 보여주는 카드뉴스" }
    ]
  }
}${language === 'en' ? '\n\nIMPORTANT: You are operating in English mode. Write ALL your messages, strategy briefs, and JSON fields entirely in English. Do not use Korean in any output.' : ''}`
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

function isGenericCardNewsRequest(text: string) {
  const normalized = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  if (!normalized) return true
  const genericOnly = normalized
    .replace(/카드뉴스|카드 뉴스|콘텐츠|컨텐츠|인스타그램|인스타|피드|릴스|sns|만들어줘|만들어|생성|제작|기획|추천|홍보|마케팅|브랜드|상품|주제|해줘|해주세요|부탁/g, '')
    .replace(/\s+/g, '')

  if (genericOnly.length === 0) return true
  if (normalized.length <= 3) return true
  return false
}

function isBroadTopic(text: string) {
  const normalized = text
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  const broadTopics = new Set(['건강', '뷰티', '패션', '음식', '푸드', '운동', '다이어트', 'ai', '트렌드', '경제', '주식', '마케팅', '공부', '여행'])
  return broadTopics.has(normalized)
}

function buildClarificationResponse(input: {
  userText: string
  brand: { name: string; industry: string }
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
}): AgentResponse | null {
  const hasUrl = /https?:\/\/[^\s]+/.test(input.userText)
  const textWithoutUrl = input.userText.replace(/https?:\/\/[^\s]+/g, '').trim()

  if (hasUrl && textWithoutUrl.length >= 2) return null
  if (!isGenericCardNewsRequest(input.userText) && !isBroadTopic(input.userText)) return null

  if (input.language === 'en') {
    const question = input.generationMode === 'general'
      ? 'Which angle should this card news focus on?'
      : `What should ${input.brand.name}'s card news focus on?`
    return {
      ready: false,
      message: 'I need one more detail to make the card news useful instead of generic. Pick a direction below or type your own answer.',
      clarification: {
        question,
        allowCustom: true,
        skipLabel: 'Use current info',
        options: input.generationMode === 'general'
          ? [
              { label: 'Benefits summary', value: `${input.userText} benefits and key points` },
              { label: 'Checklist', value: `${input.userText} checklist and practical tips` },
              { label: 'Trend angle', value: `${input.userText} recent trend and context` },
              { label: 'Cautions', value: `${input.userText} cautions and balanced explanation` },
            ]
          : [
              { label: 'New product', value: `${input.brand.name} new product launch card news` },
              { label: 'Customer problem', value: `${input.brand.name} customer pain point solution card news` },
              { label: 'Brand story', value: `${input.brand.name} brand story and differentiation card news` },
              { label: 'Promotion', value: `${input.brand.name} promotion or event card news` },
            ],
      },
    }
  }

  const question = input.generationMode === 'general'
    ? '이번 카드뉴스에서 어떤 관점을 가장 강조할까요?'
    : `${input.brand.name} 카드뉴스에서 무엇을 가장 강조할까요?`

  return {
    ready: false,
    message: '좋은 카드뉴스를 만들기에는 정보가 아직 조금 넓습니다.\n\n아래 방향 중 하나를 고르거나, 직접 답변해 주세요. 선택한 내용을 바탕으로 훅과 슬라이드 흐름을 더 정확하게 잡겠습니다.',
    clarification: {
      question,
      allowCustom: true,
      skipLabel: '현재 정보로 진행',
      options: input.generationMode === 'general'
        ? [
            { label: '효능/장점 정리', value: `${input.userText}의 효능과 장점을 구체적으로 정리한 카드뉴스` },
            { label: '체크리스트', value: `${input.userText}를 실생활에서 확인할 체크리스트형 카드뉴스` },
            { label: '요즘 이슈 연결', value: `${input.userText}를 최근 트렌드와 연결한 정보성 카드뉴스` },
            { label: '주의점까지 균형 있게', value: `${input.userText}의 장점과 주의점을 균형 있게 설명한 카드뉴스` },
          ]
        : [
            { label: '신상품 소개', value: `${input.brand.name}의 신상품 또는 대표 상품을 소개하는 카드뉴스` },
            { label: '고객 고민 해결', value: `${input.brand.name} 고객의 고민을 해결하는 정보형 카드뉴스` },
            { label: '브랜드 스토리', value: `${input.brand.name}의 차별점과 브랜드 스토리를 보여주는 카드뉴스` },
            { label: '이벤트/프로모션', value: `${input.brand.name}의 이벤트 또는 프로모션을 안내하는 카드뉴스` },
          ],
    },
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

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

    // 3. Detect URL in the latest user message and scrape
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMessage) {
      const clarification = buildClarificationResponse({
        userText: lastUserMessage.content,
        brand,
        language,
        generationMode,
      })
      if (clarification) return NextResponse.json(clarification)
    }

    let scrapedContext = ''
    let purchasePersuasionContext = ''
    if (lastUserMessage) {
      const urlMatch = lastUserMessage.content.match(/https?:\/\/[^\s]+/)
      if (urlMatch) {
        try {
          const productContext = await collectBrandUrlContext(urlMatch[0])
          scrapedContext = productContext.promptContext.slice(0, 5000)
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
            purchasePersuasionContext = formatPurchasePersuasionForPrompt(persuasion)
          }
        } catch (err) {
          console.warn('[GenerateAgent] Scrape failed:', err)
        }
      }
    }

    // 4. Fetch RSS news relevant to the user's topic for real-time grounding
    let rssContext = ''
    if (lastUserMessage && generationMode === 'general') {
      try {
        const userText = lastUserMessage.content.replace(/https?:\/\/[^\s]+/g, '').trim()
        const keywords = extractGenerationKeywords(userText)
        const rssResult = await fetchRssForGeneration({
          category: inferRssCategory(userText, brand.industry || 'information'),
          keywords,
          topic: userText.slice(0, 80),
          limit: 5,
        })
        if (rssResult.matched && rssResult.articles.length > 0) {
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
      } catch (err) {
        console.warn('[GenerateAgent] RSS fetch failed:', err)
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
    }
    const systemPrompt = buildSystemPrompt(
      brand,
      preferencesText,
      [scrapedContext, purchasePersuasionContext].filter(Boolean).join('\n\n'),
      language,
      generationMode,
      rssContext
    )
    logAiDiagnostic({ status: 'start', ...diagnosticContext })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1200,
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
    }
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
