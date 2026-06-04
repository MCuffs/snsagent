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
import { evaluateBriefingQuality, type BriefingQualityMissing } from '../../../../src/lib/quality/briefingQuality'

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
사용자가 뉴스 기사, 정보글, 또는 트렌드 글을 입력하면, 이를 깊이 분석하여 일반 정보 전달용 카드뉴스 전략 기획서와 구조 프리뷰를 함께 제안해 주어야 합니다.
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
- 사용자의 입력에 주제·대상·관점이 부족해 실제 카드뉴스 품질이 낮아질 경우에는 ready를 false로 두고 clarification을 반환하세요.
- clarification은 사용자가 바로 고를 수 있는 3~4개의 구체 선택지를 포함해야 합니다.
- message는 세 문단, 총 220자 이내로 작성하십시오.
- 성과 지표나 도달률 등 근거 없는 예측 수치는 작성하지 마십시오.

## 추천안 설정 가이드
1. visualHint: 'breaking-news', 'minimal-clean', 'trend-feed', 'community-style', 'dark-editorial' 중 하나
2. contentType: '교육 정보형', '저장형 카드뉴스', '계정 유입형' 중 하나
3. objective: 정보 전달과 유저 소장 욕구를 고려한 단문
4. slideCount: 5, 7, 10 중 하나

## 응답 형식 (반드시 JSON)
주제나 본문 정보가 제공되어 기획안을 추천할 수 있을 때:
{
  "message": "수집된 정보의 특성을 살려, 명확한 팩트가 강조되는 카드뉴스로 제안합니다.\\n\\n첫 장에서 핵심 이슈를 던지고, 배경 설명과 구체적 근거를 거쳐 요약으로 이어지는 흐름입니다.\\n\\n이 방향으로 카드뉴스를 생성할까요?",
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
    ]
  }
}

정보가 부족해 추가 수집이 필요할 때:
{
  "message": "좋은 카드뉴스를 만들기에는 정보가 아직 조금 넓습니다.\\n\\n아래 방향 중 하나를 고르거나 직접 답변해 주세요.",
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
}`
  }

  return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 브랜드 콘텐츠 전략가입니다.
사용자가 상품명, 캠페인 주제, 또는 상품 URL을 입력하면, 브랜드 프로필과 감성 선호도를 깊이 분석하여 카드뉴스 전략 기획서와 구조 프리뷰를 함께 제안해 주어야 합니다.
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

function hasQualityBriefDetails(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const signals = [
    /타겟|대상|누구|초보자|직장인|주부|학생|부모|고객|구매자|건강 관심|다이어트|운동/u,
    /목적|저장|교육|구매|전환|인지도|팔로우|공유|체크리스트|정보형/u,
    /관점|중심|루틴|섭취법|먹는 법|주의점|비교|근거|성분|오메가|식이섬유|포만감|하루/u,
    /포함|다뤄|설명|균형|구체|실생활|장보기|간식/u,
  ]
  return signals.filter(pattern => pattern.test(normalized)).length >= 2
}

function needsQualityClarification(text: string) {
  const withoutUrl = text.replace(/https?:\/\/[^\s]+/g, '').trim()
  if (!withoutUrl || hasQualityBriefDetails(withoutUrl)) return false
  const infoTopic = /(효능|효과|장점|건강|섭취|먹는 법|추천|비교|주의점|영양|성분)/u.test(withoutUrl)
  const productOrFood = /(호두|견과|아몬드|캐슈|피스타치오|식품|간식|영양제|비타민|프로틴|선크림|화장품|가방|의류|상품)/u.test(withoutUrl)
  const shortBrief = withoutUrl.length < 40
  return infoTopic && (productOrFood || shortBrief)
}

function buildClarificationResponse(input: {
  userText: string
  allUserText?: string
  previousAssistantText?: string
  brand: { name: string; industry: string }
  language?: 'ko' | 'en'
  generationMode?: 'brand' | 'general'
}): AgentResponse | null {
  const hasUrl = /https?:\/\/[^\s]+/.test(input.userText)
  if (hasUrl) return null
  const briefingText = input.allUserText?.trim() || input.userText
  const quality = evaluateBriefingQuality({
    text: briefingText,
    language: input.language,
    generationMode: input.generationMode,
    hasUrl,
  })
  const shouldClarifyForQuality = quality.shouldClarify || needsQualityClarification(briefingText)
  if (!shouldClarifyForQuality && !isGenericCardNewsRequest(briefingText) && !isBroadTopic(briefingText)) return null

  if (input.language === 'en') {
    const clarification = buildEnglishClarification({
      latestUserText: input.userText,
      briefingText,
      missing: quality.missing,
      generationMode: input.generationMode,
      brandName: input.brand.name,
      previousAssistantText: input.previousAssistantText,
    })
    return {
      ready: false,
      message: `I need one more detail to avoid a generic carousel.\n\nMissing briefing signals: ${quality.missing.slice(0, 3).join(', ') || 'specific angle'}. Pick a direction below or type your own answer.`,
      clarification,
    }
  }

  const question = input.generationMode === 'general'
    ? '이번 카드뉴스에서 어떤 관점을 가장 강조할까요?'
    : `${input.brand.name} 카드뉴스에서 무엇을 가장 강조할까요?`

  if (shouldClarifyForQuality) {
    return {
      ready: false,
      message: `주제는 좋지만, 이대로 만들면 일반적인 설명에 그칠 가능성이 큽니다.\n\n부족한 정보: ${quality.missing.slice(0, 3).join(', ') || '구체 관점'}. 아래에서 독자와 관점을 먼저 골라주세요.`,
      clarification: {
        question: '이번 카드뉴스를 어떤 방향으로 깊게 만들까요?',
        allowCustom: true,
        skipLabel: 'AI가 최적 방향 선택',
        options: buildTopicAwareClarificationOptions(input.userText, input.generationMode),
      },
    }
  }

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

function buildTopicAwareClarificationOptions(
  topic: string,
  generationMode?: 'brand' | 'general',
): { label: string; value: string }[] {
  const t = topic.trim()

  // Category detection
  const isFood = /(호두|견과|아몬드|캐슈|피스타치오|식품|간식|영양제|비타민|프로틴|음식|푸드|요리|레시피|다이어트|칼로리|영양|식이)/u.test(t)
  const isBeauty = /(선크림|화장품|스킨케어|뷰티|향수|세럼|토너|로션|크림|마스크팩)/u.test(t)
  const isFashion = /(가방|의류|패션|옷|신발|악세서리|코디|스타일)/u.test(t)
  const isPolitic = /(선거|정치|후보|투표|정당|공약|지방선거|대선|총선|국회|정부|정책)/u.test(t)
  const isEcon = /(주식|경제|금리|부동산|투자|환율|코스피|증시|재테크|펀드)/u.test(t)
  const isTech = /(ai|인공지능|it|기술|앱|소프트웨어|챗gpt|llm|반도체|스타트업)/ui.test(t)
  const isHealth = /(건강|운동|헬스|요가|필라테스|수면|스트레스|면역|의료|병원)/u.test(t)
  const isTravel = /(여행|관광|해외|국내여행|숙소|항공|제주|서울|부산)/u.test(t)
  const isCulture = /(영화|드라마|음악|공연|전시|책|독서|문화|콘텐츠)/u.test(t)

  // Politics / elections
  if (isPolitic) {
    return [
      { label: '핵심 이슈 정리', value: `${t}의 핵심 이슈를 유권자가 빠르게 파악할 수 있도록 중립적으로 정리한 정보형 카드뉴스` },
      { label: '후보/정책 비교', value: `${t}에서 주요 후보나 정책을 비교해 유권자가 판단하기 쉽게 정리한 카드뉴스` },
      { label: '투표 방법 안내', value: `${t} 관련 투표 일정·방법·절차를 알기 쉽게 안내하는 실용 정보형 카드뉴스` },
      { label: '배경과 맥락 설명', value: `${t}가 왜 중요한지 역사적 맥락과 사회적 의미를 쉽게 설명한 교육 정보형 카드뉴스` },
    ]
  }

  // Economy / finance
  if (isEcon) {
    return [
      { label: '핵심 용어 해설', value: `${t}의 핵심 개념과 용어를 일반인도 이해할 수 있게 풀어 설명한 교육형 카드뉴스` },
      { label: '실생활 영향 분석', value: `${t}가 일반 소비자와 직장인의 실생활에 어떤 영향을 주는지 분석한 카드뉴스` },
      { label: '전문가 관점 정리', value: `${t}에 대한 전문가 분석과 향후 전망을 중립적으로 정리한 시사 카드뉴스` },
      { label: '체크리스트형', value: `${t} 관련해서 내가 지금 당장 확인해야 할 것들을 체크리스트로 정리한 저장형 카드뉴스` },
    ]
  }

  // Tech / AI
  if (isTech) {
    return [
      { label: '초보자 입문 설명', value: `${t}를 기술에 익숙하지 않은 일반인도 이해할 수 있게 쉽게 풀어 설명한 카드뉴스` },
      { label: '실사용 사례 중심', value: `${t}가 실제 업무와 일상에서 어떻게 쓰이는지 사례 중심으로 소개하는 카드뉴스` },
      { label: '트렌드와 전망', value: `${t} 최신 트렌드와 앞으로의 방향을 정리한 시사 정보형 카드뉴스` },
      { label: '비교/선택 가이드', value: `${t} 관련 주요 서비스·도구를 비교해 선택 기준을 제시하는 저장형 카드뉴스` },
    ]
  }

  // Food / nutrition
  if (isFood) {
    return [
      { label: '효능·장점 정리', value: `${t}의 주요 효능과 일상적 장점을 교육 정보형으로 정리한 카드뉴스` },
      { label: '올바른 섭취법 가이드', value: `${t}의 하루 권장량, 섭취 타이밍, 주의점을 균형 있게 담은 저장형 카드뉴스` },
      { label: '구매 전 체크리스트', value: `${t} 고를 때 확인할 원산지·성분·보관법 체크리스트 카드뉴스` },
      { label: '일상 루틴 연결', value: `${t}를 바쁜 일상 속 루틴에 자연스럽게 녹이는 방법을 소개하는 라이프스타일 카드뉴스` },
    ]
  }

  // Beauty
  if (isBeauty) {
    return [
      { label: '성분·효과 분석', value: `${t}의 핵심 성분과 피부 효과를 전문적으로 분석한 교육형 카드뉴스` },
      { label: '올바른 사용법', value: `${t}의 사용 순서, 양, 주의사항을 단계별로 정리한 저장형 카드뉴스` },
      { label: '피부 타입별 추천', value: `${t}가 어떤 피부 타입에 맞는지 비교 정리한 선택 가이드형 카드뉴스` },
      { label: '구매 전 비교', value: `${t}와 유사 제품을 비교해 구매 결정에 도움을 주는 카드뉴스` },
    ]
  }

  // Health / fitness
  if (isHealth) {
    return [
      { label: '초보자 입문 가이드', value: `${t}를 처음 시작하는 분들을 위한 핵심 정보와 시작 방법 안내 카드뉴스` },
      { label: '효과적인 실천법', value: `${t}를 일상에서 꾸준히 실천할 수 있는 구체적인 방법과 루틴 카드뉴스` },
      { label: '주의점과 균형', value: `${t}의 효과와 함께 알아야 할 주의사항을 균형 있게 다룬 카드뉴스` },
      { label: '전문가 팁 정리', value: `${t}에 대한 전문가 조언과 흔히 하는 실수를 정리한 저장형 카드뉴스` },
    ]
  }

  // Fashion
  if (isFashion) {
    return [
      { label: '스타일링 가이드', value: `${t}를 활용한 다양한 스타일링 방법을 소개하는 라이프스타일 카드뉴스` },
      { label: '구매 전 체크포인트', value: `${t} 구매 전 확인할 소재·사이즈·관리법 체크리스트 카드뉴스` },
      { label: '트렌드 분석', value: `${t} 관련 이번 시즌 트렌드와 키 아이템을 정리한 정보형 카드뉴스` },
      { label: '실착 활용법', value: `${t}를 다양한 상황에서 실제로 활용하는 방법을 담은 저장형 카드뉴스` },
    ]
  }

  // Travel
  if (isTravel) {
    return [
      { label: '필수 정보 가이드', value: `${t} 여행을 위한 일정·예산·준비물 핵심 정보를 정리한 저장형 카드뉴스` },
      { label: '숨은 명소 소개', value: `${t}의 알려지지 않은 숨은 명소와 현지인 추천 코스를 소개하는 카드뉴스` },
      { label: '주의사항·팁 정리', value: `${t} 여행 시 주의할 점과 알면 유용한 팁을 정리한 실용 카드뉴스` },
      { label: '비용 절약 방법', value: `${t} 여행 비용을 절약하는 구체적인 방법과 꿀팁을 담은 저장형 카드뉴스` },
    ]
  }

  // Culture / entertainment
  if (isCulture) {
    return [
      { label: '핵심 내용 정리', value: `${t}의 주요 내용과 관전 포인트를 쉽게 정리한 입문형 카드뉴스` },
      { label: '추천 이유 소개', value: `${t}를 꼭 봐야·읽어야 하는 이유를 구체적으로 소개하는 카드뉴스` },
      { label: '배경·맥락 설명', value: `${t}를 더 깊이 이해하기 위한 배경 지식과 맥락을 설명한 교육형 카드뉴스` },
      { label: '비교·선택 가이드', value: `${t}와 유사 작품·콘텐츠를 비교해 취향에 맞게 선택할 수 있도록 안내하는 카드뉴스` },
    ]
  }

  // Generic brand mode
  if (generationMode === 'brand') {
    return [
      { label: '신상품·대표 상품 소개', value: `${t} 신상품 또는 대표 상품을 소개하는 카드뉴스` },
      { label: '고객 고민 해결', value: `${t} 고객의 고민을 해결하는 정보형 카드뉴스` },
      { label: '브랜드 스토리', value: `${t}의 차별점과 브랜드 스토리를 보여주는 카드뉴스` },
      { label: '이벤트/프로모션', value: `${t} 관련 이벤트 또는 프로모션을 안내하는 카드뉴스` },
    ]
  }

  // General fallback
  return [
    { label: '핵심 정보 요약', value: `${t}의 핵심 정보를 빠르게 파악할 수 있도록 정리한 교육 정보형 카드뉴스` },
    { label: '체크리스트형', value: `${t}와 관련해 알아야 할 핵심을 체크리스트로 정리한 저장형 카드뉴스` },
    { label: '요즘 이슈 연결', value: `${t}를 최신 트렌드 및 사회적 이슈와 연결한 시사 정보형 카드뉴스` },
    { label: '주의점·균형 있게', value: `${t}의 장점과 함께 알아야 할 주의사항을 균형 있게 다룬 카드뉴스` },
  ]
}

function buildEnglishClarification(input: {
  latestUserText: string
  briefingText: string
  missing: BriefingQualityMissing[]
  generationMode?: 'brand' | 'general'
  brandName: string
  previousAssistantText?: string
}): ClarificationPrompt {
  const asked = (input.previousAssistantText || '').toLowerCase()
  const missing = input.missing
  const baseTopic = input.briefingText || input.latestUserText
  const brandPrefix = input.generationMode === 'brand' ? `${input.brandName}: ` : ''

  if (missing.includes('audience') && !asked.includes('who should')) {
    return {
      question: 'Who should this carousel be written for?',
      allowCustom: true,
      skipLabel: 'Use current audience',
      options: [
        { label: 'Beginners', value: `${baseTopic} for beginners who need a simple practical explanation` },
        { label: 'Busy professionals', value: `${baseTopic} for busy professionals who want quick useful takeaways` },
        { label: 'Purchase checkers', value: `${brandPrefix}${baseTopic} for people comparing options before they decide` },
        { label: 'Fans / followers', value: `${brandPrefix}${baseTopic} for existing followers who want a deeper story` },
      ],
    }
  }

  if ((missing.includes('angle') || missing.includes('evidence')) && !asked.includes('which angle')) {
    return {
      question: 'Which angle should this carousel focus on?',
      allowCustom: true,
      skipLabel: 'Use current angle',
      options: input.generationMode === 'general'
        ? [
            { label: 'Benefits with proof', value: `${baseTopic} focusing on concrete benefits, evidence, and practical examples` },
            { label: 'Step-by-step guide', value: `${baseTopic} as a step-by-step guide with clear do and do not points` },
            { label: 'Checklist', value: `${baseTopic} as a checklist with decision points readers can save` },
            { label: 'Balanced cautions', value: `${baseTopic} explaining benefits, limits, and cautions without exaggeration` },
          ]
        : [
            { label: 'Customer problem', value: `${brandPrefix}${baseTopic} focused on the customer problem and the brand solution` },
            { label: 'Product proof', value: `${brandPrefix}${baseTopic} focused on product details, proof points, and reasons to trust` },
            { label: 'Brand story', value: `${brandPrefix}${baseTopic} focused on brand story and differentiation` },
            { label: 'Use case', value: `${brandPrefix}${baseTopic} focused on real usage scenes and buying context` },
          ],
    }
  }

  return {
    question: 'What should readers do after seeing this carousel?',
    allowCustom: true,
    skipLabel: 'Choose the best outcome',
    options: [
      { label: 'Save it', value: `${baseTopic} with a save-worthy structure and a clear bookmark CTA` },
      { label: 'Share it', value: `${baseTopic} with relatable points that make readers want to share it` },
      { label: 'Visit profile', value: `${brandPrefix}${baseTopic} designed to move readers to the profile for more details` },
      { label: 'Buy / compare', value: `${brandPrefix}${baseTopic} designed to help readers compare and take purchase action` },
    ],
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
    const allUserText = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n')
    const previousAssistantText = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n')
    if (lastUserMessage) {
      const clarification = buildClarificationResponse({
        userText: lastUserMessage.content,
        allUserText,
        previousAssistantText,
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

    // Ask follow-up questions only when the accumulated briefing is still weak.
    if (parsed.ready && userTurnCount < 3) {
      const briefingQuality = evaluateBriefingQuality({
        text: allUserText,
        language,
        generationMode,
      })
      const fallbackClarification = briefingQuality.shouldClarify && lastUserMessage
        ? buildClarificationResponse({
            userText: lastUserMessage.content,
            allUserText,
            previousAssistantText,
            brand,
            language,
            generationMode,
          })?.clarification
        : null
      if (!fallbackClarification) {
        return NextResponse.json(parsed)
      }
      return NextResponse.json({
        message: parsed.message,
        ready: false,
        clarification: fallbackClarification,
      })
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
