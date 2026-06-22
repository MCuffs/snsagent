'use server'

import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey, getNaverClientId, getNaverClientSecret, isConfiguredNaverApi } from '../../lib/env'
import { fetchNaverStoreProducts, buildStoreContext, extractSmartStoreId } from '../../lib/naver-shopping'
import { getCopywritingModel, getTextGenerationModel, temperatureOption } from '../../src/lib/ai/llmClient'
import { buildBrandDnaFromProfile } from '../../lib/brand-dna'
import { collectBrandUrlContext } from '../../lib/brand-url-collector'
import { analyzePurchasePersuasionWithOpenAI, formatPurchasePersuasionForPrompt } from '../../lib/purchase-persuasion'
import { analyzeBrandViaWebSearch } from '../../lib/brand-web-search'
import {
  getSessionUser,
  unauthenticated,
  failed,
  withBrandDna,
  removeMarkdownBold,
} from './_shared'
import { getGenericWebsiteFallback, getNaverSmartstoreFallback } from './brand'

export async function analyzeBrandWebsiteAction(url: string, locale = 'ko') {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!url || !url.startsWith('http')) {
    return failed(locale === 'en'
      ? 'Please enter a valid URL starting with http:// or https://'
      : '올바른 URL 형식(http:// 또는 https://)을 입력해 주세요.')
  }

  const targetUrl = url
  const isSmartStore = url.includes('smartstore.naver.com')
  const shopId = isSmartStore ? extractSmartStoreId(url) : null
  let naverStoreContext = ''

  if (isSmartStore && shopId) {
    const naverClientId = getNaverClientId()
    const naverClientSecret = getNaverClientSecret()
    const hasNaverApi = isConfiguredNaverApi(naverClientId, naverClientSecret)

    if (hasNaverApi) {
      try {
        console.log(`[SmartStore] Collecting Naver API context: ${shopId}`)
        const storeData = await fetchNaverStoreProducts(naverClientId, naverClientSecret, shopId)
        const storeContext = buildStoreContext(storeData)
        naverStoreContext = storeContext
      } catch (e) {
        console.error('[SmartStore] Naver API context failed, continuing with URL collection:', e)
      }
    } else {
      console.warn('[SmartStore] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured, continuing with URL collection')
    }
  }

  try {
    console.log(`Collecting brand URL context: ${targetUrl}`)
    const collected = await collectBrandUrlContext(targetUrl, { isNaverStore: isSmartStore })
    const cleanedText = collected.promptContext
    console.log(`Brand URL collection complete: ${collected.finalUrl} | ${collected.diagnostics.join(', ')}`)

    const openaiKey = process.env.OPENAI_API_KEY
    const useOpenAI = isConfiguredOpenAIKey(openaiKey)

    if (useOpenAI) {
      let parsed: Record<string, unknown>

      {
        console.log('Using GPT-4o 2-stage harness for brand analysis')
        const openai = new OpenAI({ apiKey: openaiKey })
        const isEn = locale === 'en'
        const purchasePersuasion = await analyzePurchasePersuasionWithOpenAI({
          openai,
          collected: {
            ...collected,
            promptContext: naverStoreContext
              ? `${collected.promptContext}\n\n[Naver SmartStore API Context]\n${naverStoreContext}`
              : collected.promptContext,
            sourceText: naverStoreContext
              ? `${collected.sourceText}\n\n${naverStoreContext}`
              : collected.sourceText,
          },
          locale,
        })
        const purchasePersuasionText = formatPurchasePersuasionForPrompt(purchasePersuasion)

        const signalPrompt = isEn
          ? `You are a digital marketing expert. Extract brand analysis signals from the following website scraped data.

[Scraped Data]
${cleanedText.slice(0, 6000)}

${purchasePersuasionText}

Respond ONLY with valid JSON:
{
  "brandName": "exact brand name (official name preferred)",
  "platformType": "smartstore|coupang|brandsite|cafe|instagram|other",
  "topProducts": ["up to 5 core products/services"],
  "priceRange": "budget|mid|premium",
  "primaryColor": "#HEXCODE (extracted from metadata, logo, header)",
  "targetSignals": "target customer signals (age, gender, lifestyle)",
  "uniqueSellingPoints": ["up to 3 differentiators"],
  "categoryKeywords": ["up to 5 industry keywords"]
}`
          : `당신은 한국 디지털 마케팅 전문가입니다. 아래 웹사이트 스크랩 데이터에서 브랜드 분석에 필요한 핵심 신호를 추출하세요.

[스크랩 데이터]
${cleanedText.slice(0, 6000)}

${purchasePersuasionText}

다음 JSON 형식으로만 응답하세요:
{
  "brandName": "정확한 브랜드명 (공식 명칭 우선)",
  "platformType": "smartstore|coupang|brandsite|cafe|instagram|other",
  "topProducts": ["최대 5개 핵심 상품/서비스"],
  "priceRange": "저가/중가/고가/프리미엄",
  "primaryColor": "#HEXCODE (메타데이터, 로고, 헤더에서 추출한 주요 컬러)",
  "targetSignals": "타겟 고객 신호 (나이대, 성별, 라이프스타일)",
  "uniqueSellingPoints": ["차별화 포인트 최대 3개"],
  "categoryKeywords": ["업종 관련 키워드 최대 5개"]
}`
        const signalModel = getTextGenerationModel()
        const signalResponse = await openai.chat.completions.create({
          model: signalModel,
          messages: [{ role: 'user', content: signalPrompt }],
          response_format: { type: 'json_object' },
          ...temperatureOption(signalModel, 0),
          max_completion_tokens: 600,
        })
        const signals = JSON.parse(signalResponse.choices[0].message.content || '{}')

        const toneOptions = isEn
          ? '"Friendly and clear", "Professional and trustworthy", "Young and energetic", "Premium and calm"'
          : '"친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤"'
        const industryOptions = isEn
          ? '"Online store", "Cafe / F&B", "Fitness", "Beauty / Care", "Education", "IT / SaaS"'
          : '"온라인 스토어", "카페 / F&B", "피트니스", "뷰티 / 케어", "교육 / 강의", "IT / SaaS"'
        const lang = isEn ? 'English' : '한국어'

        const synthPrompt = isEn
          ? `You are a brand strategist specializing in SNS card news.
Generate a complete brand profile and content DNA based on the following signal analysis and original data.
IMPORTANT: All text values in the JSON MUST be written in English.

[Signal Analysis]
${JSON.stringify(signals, null, 2)}

[Original Website Data (supplemental)]
${cleanedText.slice(0, 5000)}

[Structured Purchase Persuasion Context]
${purchasePersuasionText}

Rules:
- name: official brand name, no platform names (Smartstore, Coupang, etc.)
- industry: one of: ${industryOptions}
- targetAudience: age+gender+lifestyle (max 50 chars, e.g. "Working women in their 20s–30s")
- toneOfVoice: one of: ${toneOptions}
- mainColor: HEX code matching brand identity (avoid extreme whites/blacks)
- forbiddenWords: 2–4 overused/spammy words in this industry, comma-separated
- ctaStyle: short CTA phrase matching brand tone
- brandDescription: 2–3 sentence brand intro for first-time readers
- coreProducts: specific product/service names (max 5)
- valueProposition: core brand promise (1 sentence)
- customerPainPoints: problems this brand solves (max 4)
- differentiators: specific competitive advantages (max 4)
- visualMood: card news image direction
- contentPillars: SNS card news content themes (max 5)
- brandKeywords: keywords for AI card news generation (max 8)
- avoidVisuals: visual styles that don't fit this brand (max 4)

Respond ONLY with valid JSON:`
          : `당신은 한국 SNS 카드뉴스 전문 브랜드 전략가입니다.
아래 1차 신호 분석 결과와 원본 데이터를 기반으로 완전한 브랜드 프로필과 콘텐츠 DNA를 생성하세요.
IMPORTANT: JSON의 모든 텍스트 값은 반드시 ${lang}으로 작성하세요.

[1차 신호 분석 결과]
${JSON.stringify(signals, null, 2)}

[원본 웹사이트 데이터 (보충 참고용)]
${cleanedText.slice(0, 5000)}

[구매 설득 구조화 정보]
${purchasePersuasionText}

[생성 규칙]
- name: 공식 브랜드명. 플랫폼명(스마트스토어, 쿠팡 등)은 포함하지 않음
- industry: 반드시 아래 6개 중 하나 선택: ${industryOptions}
- targetAudience: "20~30대 직장인 여성" 처럼 나이+성별+라이프스타일 조합 (50자 이내)
- toneOfVoice: 반드시 아래 4개 중 하나: ${toneOptions}
- mainColor: 브랜드 아이덴티티에 맞는 HEX 코드. 너무 밝거나(#ffffff 계열) 너무 어두운(#000000 계열) 극단값 금지
- forbiddenWords: 이 업종에서 남용/스팸으로 여겨지는 표현 2~4개, 쉼표 구분
- ctaStyle: 콘텐츠에서 실제 사용할 짧은 CTA 문구
- brandDescription: 브랜드를 처음 보는 사람에게 설명하는 한국어 2~3문장 소개
- coreProducts: 실제 판매/제공하는 구체적 상품명/서비스명 (최대 5개)
- valueProposition: 브랜드가 고객에게 제공하는 핵심 약속 (1문장)
- customerPainPoints: 이 브랜드가 해결하는 고객 고민 (최대 4개)
- differentiators: 경쟁사 대비 구체적 차별점 (최대 4개)
- visualMood: 카드뉴스 이미지 방향
- contentPillars: SNS 카드뉴스 콘텐츠 주제 축 (최대 5개)
- brandKeywords: AI 카드뉴스 생성 시 반드시 반영할 키워드 (최대 8개)
- avoidVisuals: 이 브랜드에 어울리지 않는 비주얼 스타일 (최대 4개)

JSON 형식으로만 응답하세요:`
        const copyModel = getCopywritingModel()
        const aiResponse = await openai.chat.completions.create({
          model: copyModel,
          messages: [
            { role: 'system', content: isEn
              ? 'You are a brand strategy AI. Return ONLY valid JSON. No markdown bold (**).'
              : '당신은 한국 브랜드 전략 AI입니다. 반드시 유효한 JSON만 반환하세요. 마크다운 볼드(**) 사용 금지.' },
            { role: 'user', content: synthPrompt },
          ],
          response_format: { type: 'json_object' },
          ...temperatureOption(copyModel, 0.2),
        })
        const rawJson = aiResponse.choices[0].message.content
        if (!rawJson) throw new Error('AI analysis failed: empty response.')
        parsed = JSON.parse(rawJson)
        parsed.purchasePersuasion = purchasePersuasion
        const industryStr = String(parsed.industry || '')
        const toneStr = String(parsed.toneOfVoice || '')
        const diffArr = Array.isArray(parsed.differentiators) ? parsed.differentiators as string[] : []
        const pillarsArr = Array.isArray(parsed.contentPillars) ? parsed.contentPillars as string[] : []
        parsed.markdownReport = isEn
          ? `${String(parsed.name || signals.brandName)} is a ${industryStr.toLowerCase() || 'brand'} focused on ${String(parsed.targetAudience || 'its target customers')}. ${String(parsed.valueProposition || '')}\n\n${diffArr.length ? diffArr.join(' ') + ' ' : ''}The brand communicates with a ${toneStr.toLowerCase() || 'distinctive'} voice that resonates with its audience.\n\nFor card news, the strongest angle is to lead with ${pillarsArr[0] || 'product stories'} and close with ${String(parsed.ctaStyle || 'a clear call to action')}.`
          : `${String(parsed.name || signals.brandName)}은(는) ${String(parsed.targetAudience || '고객')}을 위한 ${industryStr || '브랜드'}입니다. ${String(parsed.valueProposition || '')}\n\n${diffArr.length ? diffArr.join(', ') + ' 등의 차별점이 있으며, ' : ''}${toneStr || '브랜드만의'} 톤으로 고객과 소통합니다.\n\n카드뉴스는 ${pillarsArr[0] || '핵심 가치'}를 앞세우고, "${String(parsed.ctaStyle || '자세히 보기')}"로 마무리하는 구성이 가장 효과적입니다.`
      }

      if (parsed) {
        return {
          success: true as const,
          brandProfile: {
            name: String(parsed.name || (locale === 'en' ? 'Unknown' : '알 수 없음')),
            industry: String(parsed.industry || (locale === 'en' ? 'Online store' : '온라인 스토어')),
            targetAudience: String(parsed.targetAudience || (locale === 'en' ? 'General customers' : '대중 고객')),
            toneOfVoice: String(parsed.toneOfVoice || (locale === 'en' ? 'Friendly and clear' : '친근하고 명확한 톤')),
            mainColor: String(parsed.mainColor || '#b94718'),
            forbiddenWords: String(parsed.forbiddenWords || ''),
            ctaStyle: String(parsed.ctaStyle || (locale === 'en' ? 'Learn more via profile link' : '프로필 링크에서 확인하기')),
            brandDna: buildBrandDnaFromProfile({
              name: String(parsed.name || 'Unknown brand'),
              industry: String(parsed.industry || 'Online store'),
              targetAudience: String(parsed.targetAudience || 'Target customers'),
              toneOfVoice: String(parsed.toneOfVoice || 'Friendly and clear'),
              mainColor: String(parsed.mainColor || '#b94718'),
              ctaStyle: String(parsed.ctaStyle || ''),
              sourceText: collected.sourceText,
              parsed,
            })
          },
          markdownReport: removeMarkdownBold(String(parsed.markdownReport || (locale === 'en' ? '# Analysis Failed\n\nCould not load AI analysis results.' : '# 분석 실패\n\nAI 분석 결과를 불러오지 못했습니다.')))
        }
      }

    } else {
      console.log('Using Mock Brand Website Analyzer (no AI key configured — set OPENAI_API_KEY in .env)')
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (isSmartStore && shopId) {
        const result = await getNaverSmartstoreFallback(shopId, targetUrl)
        return {
          success: true as const,
          brandProfile: withBrandDna(result.brandProfile, `${shopId} ${targetUrl}`),
          markdownReport: result.markdownReport
        }
      }

      const lowerUrl = url.toLowerCase()
      let mockProfile: {
        name: string
        industry: '온라인 스토어' | '카페 / F&B' | '피트니스' | '뷰티 / 케어' | '교육 / 강의' | 'IT / SaaS'
        targetAudience: string
        toneOfVoice: string
        mainColor: string
        forbiddenWords: string
        ctaStyle: string
      } = {
        name: '모카 숍 (Mock)',
        industry: '온라인 스토어',
        targetAudience: '2030 트렌디한 쇼핑족',
        toneOfVoice: '젊고 경쾌한 톤',
        mainColor: '#E28743',
        forbiddenWords: '최저가, 100% 보장, 광고',
        ctaStyle: '스토어에서 자세히 보기'
      }
      let typeLabel = '온라인 셀렉트숍'
      let strengths = '트렌디한 아이템 큐레이션 및 빠른 고객 응대'
      let colorDesc = '따뜻하고 활력 있는 오렌지 브라운 계열 (#E28743)'

      if (lowerUrl.includes('cafe') || lowerUrl.includes('coffee') || lowerUrl.includes('roast')) {
        mockProfile = {
          name: '카페 모카 (Mock)',
          industry: '카페 / F&B',
          targetAudience: '아늑한 휴식을 찾는 카공족 및 커피 애호가',
          toneOfVoice: '고급스럽고 차분한 톤',
          mainColor: '#6F4E37',
          forbiddenWords: '존맛, 최고존엄, 절대 실패없는',
          ctaStyle: '프로필 링크에서 예약하기'
        }
        typeLabel = '스페셜티 커피 전문 F&B'
        strengths = '매일 볶는 신선한 원두와 아늑한 인테리어 분위기'
        colorDesc = '커피 향을 담은 깊고 부드러운 브라운 계열 (#6F4E37)'
      } else if (lowerUrl.includes('fit') || lowerUrl.includes('gym') || lowerUrl.includes('health') || lowerUrl.includes('pilates')) {
        mockProfile = {
          name: '에너지 피트니스 (Mock)',
          industry: '피트니스',
          targetAudience: '체력 증진과 바디프로필을 목표로 하는 직장인',
          toneOfVoice: '친근하고 명확한 톤',
          mainColor: '#1A365D',
          forbiddenWords: '단기간 폭풍감량, 부작용 제로, 기적',
          ctaStyle: '무료 상담 신청하기'
        }
        typeLabel = '체계적 PT 전문 헬스센터'
        strengths = '개인 맞춤 피드백과 과학적 운동 데이터 제공'
        colorDesc = '신뢰감과 에너지를 부여하는 네이비 블루 계열 (#1A365D)'
      } else if (lowerUrl.includes('beauty') || lowerUrl.includes('skin') || lowerUrl.includes('salon') || lowerUrl.includes('care')) {
        mockProfile = {
          name: '라벨 뷰티 (Mock)',
          industry: '뷰티 / 케어',
          targetAudience: '자연스러운 스킨케어와 이너뷰티를 지향하는 고객',
          toneOfVoice: '고급스럽고 차분한 톤',
          mainColor: '#D9A5B3',
          forbiddenWords: '기적의 피부, 즉각 효과, 무조건 성공',
          ctaStyle: 'DM으로 문의하기'
        }
        typeLabel = '토탈 에스테틱 뷰티 살롱'
        strengths = '피부 저자극 프리미엄 천연 아로마 케어 및 1:1 예약제 관리'
        colorDesc = '우아하고 세련된 더스티 핑크 계열 (#D9A5B3)'
      } else if (lowerUrl.includes('tech') || lowerUrl.includes('saas') || lowerUrl.includes('software') || lowerUrl.includes('app')) {
        mockProfile = {
          name: '센스 에이전트 (Mock)',
          industry: 'IT / SaaS',
          targetAudience: '업무 자동화와 스마트 워크를 지향하는 1인 기업 및 소상공인',
          toneOfVoice: '전문적이고 신뢰감 있는 톤',
          mainColor: '#4A5568',
          forbiddenWords: '세계 1등, 절대 깨지지 않는, 무한 기능',
          ctaStyle: '프로필 링크에서 자세히 알아보기'
        }
        typeLabel = 'AI 기반 업무 자동화 SaaS 솔루션'
        strengths = '반복 업무 90% 이상 절감 및 사용자 친화적 대시보드'
        colorDesc = '스마트하고 정돈된 슬레이트 그레이 계열 (#4A5568)'
      }

      const markdownReport = `# 🏷️ 브랜드 분석 및 구도 기획서 (시뮬레이터)

본 보고서는 사용자가 입력한 사이트 URL(\`${url}\`)을 AI 기반으로 분석하여 추출한 브랜드 정체성 및 SNS 콘텐츠 가이드라인입니다. *(현재 로컬 시뮬레이션 모드로 분석되었습니다)*

## 1. 브랜드 기본 프로필
* 브랜드명: \`${mockProfile.name}\`
* 업종: \`${mockProfile.industry}\` (${typeLabel})
* 메인 컬러: ${colorDesc}

## 2. 브랜드 정체성 & 강점
* 핵심 타겟: ${mockProfile.targetAudience}
* 브랜드 경쟁력: ${strengths}
* 권장 톤앤매너: ${mockProfile.toneOfVoice} (일관된 콘텐츠 브랜딩에 도움을 줍니다)

## 3. SNS 카드뉴스 콘텐츠 전략
* 콘텐츠 포커스:
  1. 정보성 콘텐츠 위주로 전문성과 신뢰도를 확보합니다.
  2. 고객 피드백과 비포/애프터(혹은 후기)를 가공해 캐러셀 카드뉴스로 구성합니다.
* 사용 지양 용어 (금칙어): \`${mockProfile.forbiddenWords}\` (콘텐츠 신뢰 유지를 위해 사용을 삼가세요)
* 피드 전환율 상승을 위한 CTA: \`${mockProfile.ctaStyle}\`
`

      return {
        success: true as const,
        brandProfile: withBrandDna(mockProfile, `${url} ${markdownReport}`),
        markdownReport: removeMarkdownBold(markdownReport)
      }
    }
  } catch (err: unknown) {
    console.error('Brand Website Analysis failed, trying fallback:', err)

    console.log(`[BrandFallback] Trying web_search for: ${url}`)
    try {
      const webResult = await analyzeBrandViaWebSearch(url, locale as 'ko' | 'en')
      if (webResult) {
        const parsed = webResult as unknown as Record<string, unknown>
        return {
          success: true as const,
          brandProfile: {
            name: String(webResult.name || (locale === 'en' ? 'Unknown' : '알 수 없음')),
            industry: String(webResult.industry || (locale === 'en' ? 'Online store' : '온라인 스토어')),
            targetAudience: String(webResult.targetAudience || (locale === 'en' ? 'General customers' : '대중 고객')),
            toneOfVoice: String(webResult.toneOfVoice || (locale === 'en' ? 'Friendly and clear' : '친근하고 명확한 톤')),
            mainColor: String(webResult.mainColor || '#03C75A'),
            forbiddenWords: String(webResult.forbiddenWords || ''),
            ctaStyle: String(webResult.ctaStyle || (locale === 'en' ? 'Learn more via profile link' : '프로필 링크에서 확인하기')),
            brandDna: buildBrandDnaFromProfile({
              name: String(webResult.name || 'Unknown brand'),
              industry: String(webResult.industry || 'Online store'),
              targetAudience: String(webResult.targetAudience || 'Target customers'),
              toneOfVoice: String(webResult.toneOfVoice || 'Friendly and clear'),
              mainColor: String(webResult.mainColor || '#03C75A'),
              ctaStyle: String(webResult.ctaStyle || ''),
              sourceText: `${webResult.name} ${url}`,
              parsed,
            }),
          },
          markdownReport: removeMarkdownBold(webResult.markdownReport || (locale === 'en' ? '# Analysis Complete' : '# 분석 완료'))
        }
      }
    } catch (webSearchErr) {
      console.warn('[BrandFallback] web_search failed, continuing to next fallback:', webSearchErr)
    }

    if (isSmartStore && shopId) {
      console.log(`Executing Graceful Fallback for Smartstore: ${shopId}`)

      const apiKey = process.env.OPENAI_API_KEY
      const useRealAI = isConfiguredOpenAIKey(apiKey)

      if (useRealAI) {
        try {
          const openai = new OpenAI({ apiKey })
          const isHu100 = shopId.toLowerCase() === 'hu100'
          const hint = isHu100 ? '이 상점은 한글 브랜드명이 "휴100" 혹은 "휴백"일 가능성이 높으며, 카테고리는 건강 식품, 친환경 웰빙 라이프스타일, 오가닉 푸드/굿즈 관련 웰니스 샵입니다.' : ''

          const prompt = `
You are an expert brand consultant and digital marketer.
We tried to scrape the user's Naver SmartStore but were blocked (HTTP 429/403 or timeout).
However, we know the SmartStore shop ID is "${shopId}" and the URL is "${url}".
${hint}

Based on this information, infer/predict a highly relevant brand profile.

[Requirements]
1. Since we couldn't scrape, predict the brand profile values based on the shop ID "${shopId}". For "hu100", match it to a Wellness/Healthy food/Eco-friendly curated lifestyle store. For other IDs, generate a plausible modern online store profile.
2. The tone of voice must match one of: "친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤".
3. The industry must fit '온라인 스토어'.
4. Write the "markdownReport" as 3–4 natural prose paragraphs in Korean — like a creative strategist describing this brand to a colleague. No section headers (##), no bullet points (-), no bold (**). Plain flowing sentences only.
5. CRITICAL: No markdown formatting in "markdownReport". Just natural paragraph text separated by blank lines.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "name": "Brand Name (Korean/English)",
  "industry": "온라인 스토어",
  "targetAudience": "Target customers description",
  "toneOfVoice": "One of the 4 tones",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "word1, word2, word3",
  "ctaStyle": "CTA style recommendation",
  "markdownReport": "이 브랜드는... (3~4문단 자연스러운 서술)"
}
`
          const aiResponse = await openai.chat.completions.create({
            model: getCopywritingModel(),
            messages: [
              {
                role: 'system',
                content: 'You are a brand analysis AI agent. Return JSON only. Never use markdown bold syntax (**).'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            response_format: { type: 'json_object' }
          })

          const rawJson = aiResponse.choices[0].message.content
          if (rawJson) {
            const parsed = JSON.parse(rawJson)
            return {
              success: true as const,
              brandProfile: {
                name: parsed.name || `${shopId} 스토어`,
                industry: '온라인 스토어' as const,
                targetAudience: parsed.targetAudience || '대중 고객',
                toneOfVoice: parsed.toneOfVoice || '친근하고 명확한 톤',
                mainColor: parsed.mainColor || '#03C75A',
                forbiddenWords: parsed.forbiddenWords || '',
                ctaStyle: parsed.ctaStyle || '프로필 링크에서 확인하기',
                brandDna: buildBrandDnaFromProfile({
                  name: parsed.name || `${shopId} store`,
                  industry: '온라인 스토어',
                  targetAudience: parsed.targetAudience || 'Target customers',
                  toneOfVoice: parsed.toneOfVoice || 'Friendly and clear',
                  mainColor: parsed.mainColor || '#03C75A',
                  ctaStyle: parsed.ctaStyle || '',
                  sourceText: `${shopId} ${url}`,
                  parsed,
                })
              },
              markdownReport: removeMarkdownBold(parsed.markdownReport || '# 분석 복원 완료\n\n브랜드 분석 결과를 성공적으로 생성했습니다.')
            }
          }
        } catch (aiErr) {
          console.error('Fallback AI generation failed, using local fallback:', aiErr)
        }
      }

      const localResult = await getNaverSmartstoreFallback(shopId, url)
      return {
        success: true as const,
        brandProfile: withBrandDna(localResult.brandProfile, `${shopId} ${url}`),
        markdownReport: removeMarkdownBold(localResult.markdownReport)
      }
    }

    const fallback = await getGenericWebsiteFallback(url, locale)
    return {
      success: true as const,
      brandProfile: withBrandDna(fallback.brandProfile, url),
      markdownReport: removeMarkdownBold(fallback.markdownReport)
    }
  }
}
