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
  rssContext?: string,
  userTurnCount?: number
) {
  const isGeneral = generationMode === 'general'
  const dnaText = formatBrandDnaForPrompt(brand.brandDna)
  const turnsLeft = Math.max(0, 3 - (userTurnCount ?? 0))
  const roundGuidance = turnsLeft > 0
    ? (language === 'en'
      ? `\n## Briefing Round Control\nThe user has answered ${userTurnCount ?? 0} briefing rounds. If the accumulated briefing is still missing audience, angle, evidence, or desired action, ask one concrete follow-up with 3-4 options. Do not repeat a question focus already asked in the conversation. If the briefing is specific enough, return ready:true.\n`
      : `\n## 브리핑 라운드 제어\n사용자가 브리핑 ${userTurnCount ?? 0}라운드에 답했습니다. 누적 브리핑에 독자·관점·근거·행동 유도 중 부족한 축이 남아 있을 때만 추가 질문을 하세요. 이미 물어본 질문 축을 반복하지 말고, 충분히 구체적이면 ready:true를 반환하세요.\n`)
    : (language === 'en'
      ? `\n## Briefing Round Control\nThe user has completed all 3 required briefing rounds. You may now set ready:true and return the full params.\n`
      : `\n## 브리핑 라운드 제어\n사용자가 필수 브리핑 3라운드를 모두 완료했습니다. 이제 ready:true와 함께 전체 params를 반환할 수 있습니다.\n`)

  if (language === 'en') {
    return buildEnglishSystemPrompt({
      brand,
      preferencesText,
      scrapedContext,
      generationMode,
      rssContext,
      roundGuidance,
    })
  }

  if (isGeneral) {
    return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 정보/시사/트렌드 콘텐츠 전략가입니다.
사용자가 뉴스 기사, 정보글, 또는 트렌드 글을 입력하면, 이를 깊이 분석하여 일반 정보 전달용 카드뉴스 전략 기획서와 각 슬라이드별 실제 카피 초안(Headline/Body)을 제안해 주어야 합니다.
${roundGuidance}
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
- 기계적 답변을 지양하고, 정보 콘텐츠 기획 전문가로서 주도적으로 레이아웃과 흐름을 설계해 주십시오.
- 어떠한 마크다운 강조 기호도 사용하지 말고, 일반 텍스트와 자연스러운 단락 구분만 사용하십시오.
- 사용자가 카드뉴스 주제나 글을 주면, 레이아웃 추천뿐만 아니라 **실제 각 슬라이드에 들어갈 카피 초안(headline, body)과 그렇게 작성한 의도(reasoning, 공백 포함 30자 이내로 극히 짧게 한글로 작성)**를 "draftSlides" 배열에 담아 함께 돌려주십시오.
- 대화 과정에서 사용자가 카피에 대한 피드백(예: '3페이지 본문 내용을 더 간결하게 수정해줘', '톤을 더 밝게 해줘')을 준다면, 사용자의 의도를 반영하여 해당 슬라이드들의 "headline"과 "body"를 수정하고, 변경 기획 사유를 "reasoning"에 공백 포함 30자 이내의 아주 짧은 한글 1문장으로 작성하여 "draftSlides"를 실시간 갱신해 반환하세요. 생성 속도를 높이기 위해 기획 사유를 상세하게 설명하지 마십시오.
- 사용자의 입력에 주제·대상·관점이 부족해 실제 카드뉴스 품질이 낮아질 경우에는 ready를 false로 두고 clarification을 반환하세요. 단, 이 때도 지금까지 정해진 정보나 임시 기획에 근거한 "params"와 "draftSlides"는 함께 채워서 내려주어야 유저가 중간 흐름을 파악할 수 있습니다.
- clarification은 사용자가 바로 고를 수 있는 3~4개의 구체 선택지를 포함해야 합니다.
- message는 세 문단, 총 220자 이내로 작성하십시오.
- 성과 지표나 도달률 등 근거 없는 예측 수치는 작성하지 마십시오.

## 추천안 설정 가이드
1. visualHint: 'breaking-news', 'minimal-clean', 'trend-feed', 'community-style', 'dark-editorial' 중 하나
2. contentType: '교육 정보형', '저장형 카드뉴스', '계정 유입형' 중 하나
3. objective: 정보 전달과 유저 소장 욕구를 고려한 단문
4. slideCount: 5, 7, 10 중 하나

## 응답 형식 (반드시 JSON)
추천안이 제안되고 생성할 준비가 끝났을 때 (ready: true):
{
  "message": "수집된 정보의 특성을 살려, 명확한 팩트가 강조되는 카드뉴스 초안을 준비했습니다.\\n\\n각 슬라이드별 제목과 내용을 확인하시고, 수정하고 싶은 부분이 있다면 말씀해 주세요.\\n\\n이 방향으로 카드뉴스를 완성할까요?",
  "ready": true,
  "params": {
    "topic": "정보/이슈 요약 제목",
    "visualHint": "breaking-news",
    "contentType": "교육 정보형",
    "objective": "정보 전달을 통해 타겟 독자의 소장 및 계정 유입 극대화",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "최신 트렌드/시사 뉴스의 전달력을 높이기 위한 기획",
    "targetEmotion": "새로운 정보를 빠르게 습득했다는 만족감",
    "hookDirection": "놓치기 쉬운 트렌드 변화를 한 번에 요약",
    "recommendedCta": "게시물 저장 및 관련 소식 팔로우 유도",
    "reasonForStyle": "정보성 뉴스의 전달과 신뢰감을 높이기 위한 스타일",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "핵심 헤드라인" }
    ],
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "요즘 대세라는 AI 트렌드, 아직도 모른다면?",
        "body": "빠르게 변화하는 AI 기술의 실상과 대중의 인식을 한눈에 요약해 드립니다.",
        "reasoning": "최근 AI 트렌드에 대한 독자의 호기심과 긴장감을 유발하기 위해 자극적인 질문형 헤드라인을 구성함."
      }
    ]
  }
}

정보가 부족하거나 사용자와 피드백을 주고받는 중일 때 (ready: false):
{
  "message": "입력하신 주제에 맞춰 1차 카드뉴스 기획과 카피 초안을 작성했습니다.\\n\\n오른쪽 패널에서 카피를 확인하시고, 수정하고 싶은 포인트가 있거나 아래 방향을 원하시면 말씀해 주세요.",
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
  },
  "params": {
    "topic": "정보/이슈 요약 제목",
    "visualHint": "breaking-news",
    "contentType": "교육 정보형",
    "objective": "정보 전달을 통해 타겟 독자의 소장 및 계정 유입 극대화",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "최신 트렌드/시사 뉴스의 전달력을 높이기 위한 기획",
    "targetEmotion": "새로운 정보를 빠르게 습득했다는 만족감",
    "hookDirection": "놓치기 쉬운 트렌드 변화를 한 번에 요약",
    "recommendedCta": "게시물 저장 및 관련 소식 팔로우 유도",
    "reasonForStyle": "정보성 뉴스의 전달과 신뢰감을 높이기 위한 스타일",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "핵심 헤드라인" }
    ],
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "요즘 대세라는 AI 트렌드, 아직도 모른다면?",
        "body": "빠르게 변화하는 AI 기술의 실상과 대중의 인식을 한눈에 요약해 드립니다.",
        "reasoning": "호기심을 유발하는 질문형 헤드라인 구성"
      }
    ]
  }
}`
  }

  return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 브랜드 콘텐츠 전략가입니다.
사용자가 상품명, 캠페인 주제, 또는 상품 URL을 입력하면, 브랜드 프로필과 감성 선호도를 깊이 분석하여 카드뉴스 전략 기획서와 각 슬라이드별 실제 카피 초안(Headline/Body)을 제안해 주어야 합니다.
${roundGuidance}
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
- **마크다운 서식 절대 사용 금지**: 별표("**" 또는 "*"), 샵("#")을 이용한 타이틀 구성 등 마크다운 스타일은 사용자가 읽기에 불필요한 AI 기계음 느낌을 줍니다. **어떠한 강조 기호도 사용하지 말고**, 오직 일반 텍텍스트, 평이한 문장, 그리고 자연스러운 단락 구분(줄바꿈)만을 활용하십시오. 필요 시 대시("-") 또는 일반 번호를 사용한 목록 형태로만 깔끔하게 나열하십시오.
- 사용자가 상품이나 주제를 말하면, 단순히 레이아웃 추천뿐만 아니라 **실제 각 슬라이드에 들어갈 카피 초안(headline, body)과 그렇게 작성한 의도(reasoning, 공백 포함 30자 이내로 극히 짧게 한글로 작성)**를 "draftSlides" 배열에 담아 함께 돌려주십시오.
- 대화 과정에서 사용자가 카피에 대한 피드백(예: '2장 본문 내용을 더 간결하게 수정해줘', '톤을 더 밝게 해줘')을 준다면, 사용자의 의도를 반영하여 해당 슬라이드들의 "headline"과 "body"를 수정하고, 변경 기획 사유를 "reasoning"에 공백 포함 30자 이내의 아주 짧은 한글 1문장으로 작성하여 "draftSlides"를 실시간 갱신해 반환하세요. 생성 속도를 높이기 위해 기획 사유를 상세하게 설명하지 마십시오.
- 단, 사용자의 입력에 상품·캠페인·고객 문제·핵심 관점이 거의 없어 실제 카드뉴스 품질이 낮아질 경우에는 무리하게 생성하지 말고 ready를 false로 두고 clarification을 반환하세요. 단, 이 때도 지금까지 정해진 정보나 임시 기획에 근거한 "params"와 "draftSlides"는 함께 채워서 내려주어야 유저가 중간 흐름을 파악할 수 있습니다.
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
추천안이 제안되고 생성할 준비가 끝났을 때 (ready: true):
{
  "message": "PYEARCHIVE의 정돈된 감성을 살려, 여백과 제품 실루엣이 돋보이는 에디토리얼 카드뉴스 초안을 제안합니다.\\n\\n슬라이드별 카피와 기획 의도를 확인하시고 수정하고 싶으신 점이 있다면 말씀해 주세요.\\n\\n이대로 카드뉴스를 생성할까요?",
  "ready": true,
  "params": {
    "topic": "상품/주제 이름 (예: PYE Essential Bag 001)",
    "visualHint": "dark-editorial",
    "contentType": "저장형 카드뉴스",
    "objective": "타겟 유저의 소장(저장) 가치를 극대화하여 계정 팔로우 유도",
    "slideCount": 5,
    "productUrl": "http... (사용자가 입력한 URL이 있다면 기입, 없으면 null)",
    "brandAnalysis": "브랜드가 가진 미니멀하고 정돈된 감성을 적극적으로 반영",
    "targetEmotion": "나만 알고 싶은 브랜드에 대한 특별함 및 소유 욕구",
    "hookDirection": "일상의 무질서 속에서 균형을 잡는 에센셜 라이프 제안",
    "recommendedCta": "상세 스토어 이동 및 컬렉션 라인업 탐색 유도",
    "reasonForStyle": "해당 브랜드의 시그니처 정돈감을 극대화하기 위해 여백이 돋보이는 dark-editorial 스타일을 기획했습니다.",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "일상의 질서를 완성하는 파이 에센셜 백 소개" }
    ],
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "일상의 무질서 속에서, 내 삶의 질서를 찾는 법",
        "body": "불필요한 짐은 덜어내고 매 순간 나에게 꼭 필요한 균형을 채워보세요.",
        "reasoning": "브랜드의 미니멀 아이덴티티를 살려 독자가 일상의 질서를 재발견하도록 공감형 문구를 구성함."
      }
    ]
  }
}

정보가 부족하거나 사용자와 피드백을 주고받는 중일 때 (ready: false):
{
  "message": "좋은 카드뉴스를 만들기에는 정보가 아직 조금 넓습니다.\n\n아래 방향 중 하나를 고르거나 직접 의견을 말씀해 주세요. 카피 초안과 기획을 더 정확하게 수정하겠습니다.",
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
  },
  "params": {
    "topic": "상품/주제 이름 (예: PYE Essential Bag 001)",
    "visualHint": "dark-editorial",
    "contentType": "저장형 카드뉴스",
    "objective": "타겟 유저의 소장(저장) 가치를 극대화하여 계정 팔로우 유도",
    "slideCount": 5,
    "productUrl": null,
    "brandAnalysis": "브랜드가 가진 미니멀하고 정돈된 감성을 적극적으로 반영",
    "targetEmotion": "나만 알고 싶은 브랜드에 대한 특별함 및 소유 욕구",
    "hookDirection": "일상의 무질서 속에서 균형을 잡는 에센셜 라이프 제안",
    "recommendedCta": "상세 스토어 이동 및 컬렉션 라인업 탐색 유도",
    "reasonForStyle": "해당 브랜드의 시그니처 정돈감을 극대화하기 위해 여백이 돋보이는 dark-editorial 스타일을 기획했습니다.",
    "structurePreview": [
      { "slideNumber": 1, "role": "Hook", "description": "일상의 질서를 완성하는 파이 에센셜 백 소개" }
    ],
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "일상의 무질서 속에서, 내 삶의 질서를 찾는 법",
        "body": "불필요한 짐은 덜어내고 매 순간 나에게 꼭 필요한 균형을 채워보세요.",
        "reasoning": "브랜드 아이덴티티에 기반한 첫 장 훅 문구 제안"
      }
    ]
  }
}`
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
  roundGuidance: string
}) {
  const isGeneral = params.generationMode === 'general'
  const brandDna = formatBrandDnaForPrompt(params.brand.brandDna)
  const contextBlock = [
    params.rssContext ? `## Real-time relevant context\n${params.rssContext}` : '',
    params.scrapedContext ? `## Collected source or product context\n${params.scrapedContext}` : '',
  ].filter(Boolean).join('\n\n')

  return `You are Shuffla's senior Instagram carousel creative director.
${params.roundGuidance}
## Mode
${isGeneral
    ? 'This is an information, news, or trend carousel. Do not force brand promotion. Ground the plan in the user topic and verified context.'
    : `This is a brand carousel for ${params.brand.name}. Reflect the brand profile without inventing product claims.`}

## Brand/Profile Context
- Brand: ${params.brand.name}
- Industry: ${params.brand.industry}
- Target audience: ${params.brand.targetAudience}
- Tone of voice: ${params.brand.toneOfVoice}
- Brand DNA: ${brandDna || 'Not specified'}

## User style memory
${params.preferencesText || 'No prior style memory.'}

${contextBlock}

## Rules
- Return valid JSON only.
- Write every JSON string value in English.
- Do not use markdown emphasis symbols.
- If the user topic lacks enough audience, angle, evidence, or action detail, return ready:false with a concrete clarification question and 3-4 useful options.
- If enough detail exists, return ready:true with params.
- Keep message under 650 characters across 2-3 short paragraphs.
- Never invent performance metrics, medical claims, rankings, discounts, reviews, or unsupported facts.
- structurePreview must contain exactly slideCount items and each item must describe the slide information role, not finished card copy.

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
    const _allUserText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n')
    const _previousAssistantText = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n')

    const urlMatch = lastUserMessage?.content.match(/https?:\/\/[^\s]+/)
    const userTextClean = lastUserMessage?.content.replace(/https?:\/\/[^\s]+/g, '').trim() || ''
    const keywords = extractGenerationKeywords(userTextClean)

    const [scrapeResult, rssResult] = await Promise.all([
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

      // RSS fetch (only for general mode)
      (lastUserMessage && generationMode === 'general') ? (async () => {
        try {
          return await fetchRssForGeneration({
            category: inferRssCategory(userTextClean, brand.industry || 'information'),
            keywords,
            topic: userTextClean.slice(0, 80),
            limit: 5,
          })
        } catch (err) {
          console.warn('[GenerateAgent] RSS fetch failed:', err)
          return null
        }
      })() : Promise.resolve(null),
    ])

    const scrapedContext = scrapeResult.scraped
    const purchasePersuasionContext = scrapeResult.persuasion
    let rssContext = ''
    if (rssResult && rssResult.matched && rssResult.articles.length > 0) {
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
    const userTurnCount = messages.filter(m => m.role === 'user').length
    const systemPrompt = buildSystemPrompt(
      brand,
      preferencesText,
      [scrapedContext, purchasePersuasionContext].filter(Boolean).join('\n\n'),
      language,
      generationMode,
      rssContext,
      userTurnCount
    )
    logAiDiagnostic({ status: 'start', ...diagnosticContext })
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
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
