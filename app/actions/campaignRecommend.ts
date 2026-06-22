'use server'

import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../../lib/env'
import { getCopywritingModel } from '../../src/lib/ai/llmClient'
import { formatBrandDnaForPrompt } from '../../lib/brand-dna'
import {
  getSessionUser,
  unauthenticated,
  failed,
  getOwnedBrandOrFallback,
  removeMarkdownBold,
  readAiText,
  readRecommendedKeyContent,
} from './_shared'

export async function recommendCampaignAction(brandId: string, topic: string) {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!brandId) {
    return failed('브랜드를 선택해 주세요.')
  }
  if (!topic || topic.trim().length === 0) {
    return failed('카드뉴스 주제를 입력해 주세요.')
  }

  try {
    const brand = await getOwnedBrandOrFallback(user.id, brandId)
    if (!brand) return failed('브랜드를 찾을 수 없습니다.')

    const apiKey = process.env.OPENAI_API_KEY
    const useRealAI = isConfiguredOpenAIKey(apiKey)

    if (useRealAI) {
      const openai = new OpenAI({ apiKey })
      const prompt = `
You are an expert AI Marketing Planner.
Based on the following brand profile and a raw topic/idea for a social card-news campaign, generate optimized configuration values and slide content for the campaign.

[Brand Profile]
- Brand Name: ${brand.name}
- Industry: ${brand.industry}
- Target Audience: ${brand.targetAudience}
- Tone of Voice: ${brand.toneOfVoice}
- Main Color: ${brand.mainColor}
- Forbidden Words: ${brand.forbiddenWords || 'None'}
- CTA Style: ${brand.ctaStyle || 'None'}

[Brand DNA Harness]
${formatBrandDnaForPrompt(brand.brandDna)}

[Campaign Topic/Idea]
${topic}

[Requirements]
1. Select the most matching option for each field:
   - "contentType": One of ['신상품 홍보', '베스트셀러 추천', '고객 리얼 리뷰', '브랜드 스토리', '세일/이벤트 안내', '꿀팁/큐레이션']
   - "category": One of ['패션/의류', '뷰티/화장품', '리빙/인테리어', '푸드/식품', '디지털/가전', '라이프스타일', '반려동물', '기타']
   - "tone": One of ['감성적이고 따뜻하게', '시크하고 고급스럽게', '톡톡 튀고 트렌디하게', '정보가 쏙쏙 들어오게', '신뢰감 있고 전문적이게']
   - "slideCount": Recommended total number of slides (Must be exactly one of [5, 7, 10])
2. Generate:
   - "title": A concise Korean archive-card headline (under 18 Korean chars, no emoji, no markdown bold, do not prepend brand name unless the topic explicitly asks for it).
   - "keyContent": Detailed copy for each slide. Write one line per slide. The number of lines must match "slideCount". Each line should contain a short headline and sub-content separated by ":". Use the brand's industry, target audience, tone of voice, forbidden words, CTA style, and Brand DNA. At least 70% of slides must mention or imply the Brand DNA's product/service, differentiator, customer pain, or value proposition. Do not include markdown bold syntax (**).
   - "visualHint": A premium archive-card background prompt. It must match the Brand DNA's core products, visual mood, differentiators, and avoidVisuals. It should not ask for text in the image. Prefer product/editorial photography, muted archive layout, and enough lower-left blank negative space for app-rendered copy.
   - "source": Recommended brand label/watermark (e.g. brand website, brand handle, or simply "${brand.name}")
3. CRITICAL: Do NOT use markdown bold syntax (** or ***) anywhere in the text. Keep all text plain and clean.
4. Avoid forbidden words exactly: ${brand.forbiddenWords || 'None'}.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "contentType": "...",
  "category": "...",
  "tone": "...",
  "title": "...",
  "keyContent": "...",
  "visualHint": "...",
  "source": "...",
  "slideCount": 7
}
`

      const aiResponse = await openai.chat.completions.create({
        model: getCopywritingModel(),
        messages: [
          {
            role: 'system',
            content: 'You are a professional marketing planner AI agent. Return JSON only. Never use markdown bold (**).'
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
        const parsed = JSON.parse(rawJson) as Record<string, unknown>
        const fallbackTitle = `[${brand.name}] ${topic}`
        const fallbackContent = `- 핵심가치 소개: ${topic} 관련 브랜드 스토리\n- 주요 특징 안내: 스토어만의 강점`
        const recommendedSlideCount = Number(parsed.slideCount)
        return {
          success: true as const,
          recommendation: {
            contentType: readAiText(parsed.contentType, '신상품 홍보'),
            category: readAiText(parsed.category, '기타'),
            tone: readAiText(parsed.tone, '감성적이고 따뜻하게'),
            title: removeMarkdownBold(readAiText(parsed.title, fallbackTitle)),
            keyContent: removeMarkdownBold(readRecommendedKeyContent(parsed.keyContent, fallbackContent)),
            visualHint: readAiText(parsed.visualHint, `minimalist design matching brand color ${brand.mainColor}`),
            source: readAiText(parsed.source, brand.name),
            slideCount: [5, 7, 10].includes(recommendedSlideCount) ? recommendedSlideCount : 7
          }
        }
      } else {
        throw new Error('추천 생성에 실패했습니다.')
      }

    } else {
      // Mock simulation logic
      console.log('Using Mock Campaign Recommendation Engine (OpenAI key not configured)')
      await new Promise(resolve => setTimeout(resolve, 1500)) // Simulation delay

      const lowerTopic = topic.toLowerCase()
      const lowerIndustry = brand.industry.toLowerCase()

      const brandTone = brand.toneOfVoice || '차분하고 명확한 톤'
      const audience = brand.targetAudience || '브랜드 고객'
      const cta = brand.ctaStyle || '프로필 링크에서 자세히 보기'
      const forbidden = brand.forbiddenWords
        .split(',')
        .map(word => word.trim())
        .filter(Boolean)

      // Default values
      let contentType = '신상품 홍보'
      let category = '라이프스타일'
      let tone = mapBrandToneToCampaignTone(brandTone)
      let title = archiveTitleFromTopic(topic)
      let keyContent = buildBrandKeyContent({
        topic,
        brandName: brand.name,
        industry: brand.industry,
        audience,
        tone: brandTone,
        cta,
      })
      let visualHint = buildBrandVisualHint(brand.industry, brand.mainColor, brandTone)
      const slideCount = 5

      // Matching based on topic and industry
      if (lowerTopic.includes('세일') || lowerTopic.includes('할인') || lowerTopic.includes('이벤트') || lowerTopic.includes('쿠폰')) {
        contentType = '세일/이벤트 안내'
        title = '놓치기 전 확인'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'limited-offer' })
      } else if (lowerTopic.includes('리뷰') || lowerTopic.includes('후기') || lowerTopic.includes('추천') || lowerTopic.includes('베스트')) {
        contentType = '고객 리얼 리뷰'
        title = '써본 뒤 남은 것'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'review' })
      } else if (lowerTopic.includes('꿀팁') || lowerTopic.includes('정보') || lowerTopic.includes('방법') || lowerTopic.includes('큐레이션')) {
        contentType = '꿀팁/큐레이션'
        title = '필요한 것만'
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'curation' })
      }

      // Category matching by Industry
      if (lowerIndustry.includes('온라인') || lowerIndustry.includes('스토어') || lowerIndustry.includes('셀렉')) {
        category = lowerTopic.includes('원피스') || lowerTopic.includes('의류') || lowerTopic.includes('패션') ? '패션/의류' : '라이프스타일'
      } else if (lowerIndustry.includes('뷰티') || lowerIndustry.includes('화장') || lowerIndustry.includes('헤어') || lowerIndustry.includes('에스테틱')) {
        category = '뷰티/화장품'
        tone = '시크하고 고급스럽게'
        if (contentType === '신상품 홍보') {
          title = '피부가 쉬는 방식'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'beauty' })
        }
      } else if (lowerIndustry.includes('카페') || lowerIndustry.includes('푸드') || lowerIndustry.includes('식품') || lowerIndustry.includes('커피')) {
        category = '푸드/식품'
        tone = '톡톡 튀고 트렌디하게'
        if (contentType === '신상품 홍보') {
          title = '오늘의 맛 기록'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'food' })
        }
      } else if (lowerIndustry.includes('피트니스') || lowerIndustry.includes('헬스') || lowerIndustry.includes('운동')) {
        category = '라이프스타일'
        tone = '정보가 쏙쏙 들어오게'
        if (contentType === '신상품 홍보') {
          title = '몸이 기억하는 루틴'
          keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'wellness' })
        }
      } else if (lowerIndustry.includes('it') || lowerIndustry.includes('saas') || lowerIndustry.includes('소프트웨어')) {
        category = '디지털/가전'
        tone = '신뢰감 있고 전문적이게'
      }

      // Add visual hint based on category & color
      if (category === '패션/의류') {
        visualHint = buildBrandVisualHint('패션/의류', brand.mainColor, brandTone)
      } else if (category === '뷰티/화장품') {
        visualHint = buildBrandVisualHint('뷰티/화장품', brand.mainColor, brandTone)
      } else if (category === '푸드/식품') {
        visualHint = buildBrandVisualHint('푸드/식품', brand.mainColor, brandTone)
      } else {
        visualHint = buildBrandVisualHint(brand.industry, brand.mainColor, brandTone)
      }

      // Custom adjustments based on user input
      if (lowerTopic.includes('원피스') || lowerTopic.includes('리넨')) {
        category = '패션/의류'
        tone = '감성적이고 따뜻하게'
        title = `여름에 남는 옷`
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'fashion' })
      } else if (lowerTopic.includes('건강식품') || lowerTopic.includes('웰빙') || lowerTopic.includes('영양제')) {
        category = '푸드/식품'
        tone = '신뢰감 있고 전문적이게'
        title = `매일 챙기는 기준`
        keyContent = buildBrandKeyContent({ topic, brandName: brand.name, industry: brand.industry, audience, tone: brandTone, cta, angle: 'wellness' })
      }

      keyContent = removeForbiddenTerms(keyContent, forbidden)

      return {
        success: true as const,
        recommendation: {
          contentType,
          category,
          tone,
          title,
          keyContent,
          visualHint,
          source: brand.name,
          slideCount
        }
      }
    }

  } catch (err: unknown) {
    console.error('Campaign recommendation failed:', err)
    return failed(err instanceof Error ? err.message : '추천 데이터를 기획하는 도중 오류가 발생했습니다.')
  }
}

function mapBrandToneToCampaignTone(toneOfVoice: string) {
  const text = toneOfVoice.toLowerCase()
  if (/고급|차분|프리미엄|시크|minimal|premium/.test(text)) return '시크하고 고급스럽게'
  if (/전문|신뢰|명확|정보|분석/.test(text)) return '신뢰감 있고 전문적이게'
  if (/젊|경쾌|트렌디|톡톡|재치/.test(text)) return '톡톡 튀고 트렌디하게'
  if (/친근|따뜻|감성|부드/.test(text)) return '감성적이고 따뜻하게'
  return '정보가 쏙쏙 들어오게'
}

function archiveTitleFromTopic(topic: string) {
  const clean = topic
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[!?.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (/가방|백|bag/i.test(clean)) return '정돈된 가방'
  if (/책|독서|문장|글/i.test(clean)) return '가방 속 물건'
  if (/옷|원피스|리넨|패션/i.test(clean)) return '오래 입는 기준'
  if (/피부|뷰티|케어|화장/i.test(clean)) return '피부가 쉬는 방식'
  if (/식품|건강|영양|웰빙/i.test(clean)) return '매일 챙기는 기준'
  return clean.length > 14 ? clean.slice(0, 14) : clean || '저장해두세요'
}

function buildBrandKeyContent(input: {
  topic: string
  brandName: string
  industry: string
  audience: string
  tone: string
  cta: string
  angle?: string
}) {
  const subject = archiveTitleFromTopic(input.topic)
  const context = `${input.industry} 고객인 ${input.audience}`
  const angleLine = input.angle === 'limited-offer'
    ? '오늘만 확인할 것: 필요한 혜택과 조건을 차분히 정리합니다'
    : input.angle === 'review'
      ? '써본 뒤 남은 것: 실제 선택 이유와 만족 포인트를 정리합니다'
      : input.angle === 'curation'
        ? '필요한 것만: 복잡한 정보에서 바로 쓸 내용만 남깁니다'
        : `${subject}: ${context}에게 필요한 기준을 먼저 보여줍니다`

  return [
    `${subject}: ${input.tone}으로 브랜드가 제안하는 핵심 기준`,
    angleLine,
    `선택 기준: ${input.industry} 맥락에서 놓치기 쉬운 디테일`,
    `사용 장면: ${input.audience}가 실제로 떠올릴 수 있는 상황`,
    `저장 포인트: ${input.cta}`,
  ].join('\n')
}

function buildBrandVisualHint(industry: string, mainColor: string, toneOfVoice: string) {
  const context = `${industry} ${toneOfVoice}`.toLowerCase()
  const base = 'Korean premium archive social card photography, no generated text, no logo, no watermark, object centered in upper-middle, quiet lower-left typography space'

  if (/패션|의류|리빙|스토어|셀렉|온라인|bag|가방/.test(context)) {
    return `${base}, product archive still life, soft off-white studio background, fabric texture, black object details, subtle brand color ${mainColor}`
  }
  if (/뷰티|화장|케어|스킨/.test(context)) {
    return `${base}, cosmetic product archive still life, translucent packaging, soft bathroom or vanity light, muted gray-white palette, subtle brand color ${mainColor}`
  }
  if (/푸드|식품|카페|커피/.test(context)) {
    return `${base}, editorial food or cafe object still life, neutral table surface, natural window light, muted warm gray palette, subtle brand color ${mainColor}`
  }
  if (/건강|웰빙|피트니스|운동/.test(context)) {
    return `${base}, wellness object still life, clean towel, bottle, notebook, calm natural light, muted gray palette, subtle brand color ${mainColor}`
  }
  if (/it|saas|디지털|가전|소프트웨어/.test(context)) {
    return `${base}, minimal tech desk still life, device and notebook, soft gray background, calm product documentation mood, subtle brand color ${mainColor}`
  }
  return `${base}, muted editorial product still life, clean background, calm archive mood, subtle brand color ${mainColor}`
}

function removeForbiddenTerms(value: string, forbiddenWords: string[]) {
  return forbiddenWords.reduce((text, word) => {
    if (!word) return text
    return text.replaceAll(word, '')
  }, value).replace(/\s{2,}/g, ' ').trim()
}
