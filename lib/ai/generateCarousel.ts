import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey } from '../env'

export interface BrandProfile {
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
}

export interface CampaignInput {
  productName: string
  productDescription: string
  keyBenefits: string
  objective: string
}

export interface CarouselSlidePlan {
  slideNumber: number
  headline: string
  body: string
  designPrompt: string
}

export interface GeneratedCarousel {
  title: string
  contentStrategy: string
  slides: CarouselSlidePlan[]
  caption: string
  hashtags: string[]
  recommendedPostTime: string
}

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!isConfiguredOpenAIKey(apiKey)) {
    return null
  }
  return new OpenAI({ apiKey })
}

export async function generateCarousel(
  brand: BrandProfile,
  campaign: CampaignInput,
  slideCount: number
): Promise<GeneratedCarousel> {
  const openai = getOpenAIClient()

  if (openai) {
    try {
      const prompt = `
You are an expert Instagram content marketing AI Agent, playing the combined roles of SNS manager, content strategist, copywriter, and performance marketer.
Create a highly engaging Instagram Carousel (Card News) outline in JSON format based on the following brand profile and campaign inputs.

[Brand Profile]
- Brand Name: ${brand.name}
- Industry: ${brand.industry}
- Target Audience: ${brand.targetAudience}
- Tone of Voice: ${brand.toneOfVoice}
- Main Brand Color: ${brand.mainColor}
- Forbidden Words (DO NOT USE THESE): ${brand.forbiddenWords}
- CTA Style: ${brand.ctaStyle}

[Campaign Details]
- Product Name: ${campaign.productName}
- Product Description: ${campaign.productDescription}
- Key Benefits: ${campaign.keyBenefits}
- Campaign Objective: ${campaign.objective}
- Number of Slides: ${slideCount}

[Requirements & Rules]
1. First Slide (Slide 1) MUST have a powerful, curiosity-piquing Hook to stop users from scrolling.
2. Each slide must contain EXACTLY ONE single message to maintain high readability.
3. Keep sentences short, concise, and impact-driven. Perfect for mobile screens.
4. Strictly avoid forbidden words: "${brand.forbiddenWords}".
5. No exaggerated or spammy advertising phrases. Keep it authentic.
6. Slide ${slideCount} (the last slide) MUST be a clear Call-to-Action (CTA) slide designed in the specified CTA style: "${brand.ctaStyle}".
7. Generate between 8 to 15 relevant hashtags that are aligned with the audience. Do not spam.
8. Design prompt for each slide should describe a background-only visual direction. It must not ask the image model to create text, letters, numbers, logos, buttons, captions, labels, or typography. Leave clean negative space for app-rendered copy.
9. Recommended post time should suggest the best hour of the day (e.g. "12:30 PM" or "7:45 PM") based on the target audience.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "title": "Campaign content title",
  "contentStrategy": "Brief description of the angle and strategic approach chosen for this card news",
  "slides": [
    {
      "slideNumber": 1,
      "headline": "Hook Title (Under 20 chars)",
      "body": "Brief body copy (Under 60 chars)",
      "designPrompt": "Image prompt describing a background-only visual composition with no text, labels, logos, or typography"
    }
  ],
  "caption": "Instagram caption copy including emojis, written in the specified tone (${brand.toneOfVoice})",
  "hashtags": ["hashtag1", "hashtag2"],
  "recommendedPostTime": "12:30 PM"
}
`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an Instagram content marketing AI Agent. Output JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      })

      const rawJson = response.choices[0].message.content
      if (rawJson) {
        return JSON.parse(rawJson) as GeneratedCarousel
      }
    } catch (err) {
      console.error('OpenAI generation failed, falling back to mock generation', err)
    }
  }

  // Fallback rich Mock AI content generation based on industry
  return generateMockCarousel(brand, campaign, slideCount)
}

function generateMockCarousel(
  brand: BrandProfile,
  campaign: CampaignInput,
  slideCount: number
): GeneratedCarousel {
  const isGym = brand.industry.includes('헬스') || brand.industry.includes('피트니스') || campaign.productDescription.includes('헬스')
  const isCafe = brand.industry.includes('카페') || brand.industry.includes('커피') || campaign.productDescription.includes('카페')
  const isClinic = brand.industry.includes('병원') || brand.industry.includes('의원') || brand.industry.includes('피부')
  
  let hookTitle = `아직도 ${campaign.productName} 없이 고민하시나요?`
  let subTitle = `SNS 담당 직원이 몰래 쓰는 꿀팁 대공개!`
  let contentStrategy = `${brand.name} 브랜드 톤앤매너에 맞추어 타겟 고객(${brand.targetAudience})의 핵심 고충을 해결하는 정보성 카드뉴스 기획입니다.`
  
  if (isGym) {
    hookTitle = '운동은 장비빨? 진짜 몸짱들의 3가지 비밀'
    subTitle = '바쁜 직장인도 하루 15분으로 완성하는 탄탄한 루틴'
    contentStrategy = '헬스/피트니스 관심 고객을 겨냥하여 시간 대비 최대 효율을 내는 루틴과 마인드셋을 강조합니다.'
  } else if (isCafe) {
    hookTitle = '아침을 깨우는 인생 커피의 조건 3가지'
    subTitle = '바리스타가 직접 전하는 향긋한 원두 이야기'
    contentStrategy = '감성적인 카페 브랜딩을 위해 깊은 맛의 디테일과 아늑한 공간 톤을 강조하는 비주얼 기획입니다.'
  } else if (isClinic) {
    hookTitle = '피부과 가기 전, 이것 모르면 돈 낭비합니다!'
    subTitle = '전문의가 알려주는 홈케어와 피부 장벽 강화 공식'
    contentStrategy = '신뢰감이 생명인 병의원/뷰티 타겟을 위해 전문 의학 지식을 쉽게 요약하고 신뢰감을 주는 톤으로 기획했습니다.'
  }

  const slides: CarouselSlidePlan[] = []

  // Slide 1: Hook
  slides.push({
    slideNumber: 1,
    headline: hookTitle,
    body: subTitle,
    designPrompt: `Background-only editorial image for an Instagram card cover. Minimal composition, no text, no letters, no numbers, no logo, no typography, clean empty space for app-rendered copy later, subtle brand color ${brand.mainColor}. High contrast layout.`
  })

  // Body slides
  for (let i = 2; i < slideCount; i++) {
    let headline = `비밀 ${i - 1}: ${campaign.keyBenefits.split(',')[i - 2] || '더 나은 가치 전달'}`
    let body = `${campaign.productName}은(는) 고객님의 일상을 더욱 풍요롭고 편리하게 만들기 위해 설계되었습니다.`
    
    if (isGym) {
      if (i === 2) {
        headline = '첫째, 점진적 과부하'
        body = '어제보다 딱 1회만 더! 무리하지 않고 조금씩 강도를 높이세요.'
      } else if (i === 3) {
        headline = '둘째, 충분한 영양과 수면'
        body = '근육은 누워있을 때 성장합니다. 7시간 숙면은 필수!'
      } else {
        headline = '셋째, 흔들리지 않는 꾸준함'
        body = '일주일에 단 2번이라도 포기하지 않고 헬스장에 발도장 찍기!'
      }
    } else if (isCafe) {
      if (i === 2) {
        headline = '1. 신선한 스페셜티 원두'
        body = '로스팅 후 7일 이내의 원두만이 선사하는 풍부한 크레마와 아로마.'
      } else if (i === 3) {
        headline = '2. 물과 추출의 미학'
        body = '92도의 적정 온도와 균일한 유속이 빚어내는 잡미 없는 깔끔함.'
      } else {
        headline = '3. 완벽한 페어링 푸드'
        body = '커피의 쌉싸름함을 감싸줄 달콤한 디저트와의 완벽한 조화.'
      }
    } else if (isClinic) {
      if (i === 2) {
        headline = '규칙 1. 자극적인 성분 차단'
        body = '알코올이나 강한 산성 세안제는 약해진 피부 장벽을 무너뜨립니다.'
      } else if (i === 3) {
        headline = '규칙 2. 3중 보습막 형성'
        body = '스킨, 세럼 위에 반드시 세라마이드 성분의 크림으로 잠가주세요.'
      } else {
        headline = '규칙 3. 365일 자외선 차단'
        body = '노화의 주범인 UV 차단제를 실내에서도 아낌없이 바르기.'
      }
    }

    slides.push({
      slideNumber: i,
      headline,
      body,
      designPrompt: `Background-only Instagram card image inspired by ${headline}. Minimal editorial composition, no text, no letters, no numbers, no labels, no logo, clean negative space for app-rendered copy later, subtle color ${brand.mainColor} in details.`
    })
  }

  // Slide Last: CTA
  slides.push({
    slideNumber: slideCount,
    headline: `지금 바로 시작해 보세요!`,
    body: `${brand.ctaStyle || '프로필 링크 클릭 후 예약하기'}`,
    designPrompt: `Background-only Instagram card news ending slide. Clean premium composition with blank negative space for app-rendered call-to-action later, no text, no letters, no numbers, no button, no logo, subtle brand color ${brand.mainColor}.`
  })

  // Emojis for tone
  const toneEmoji = brand.toneOfVoice.includes('친근') ? '😊✨' : '💼🔥'

  return {
    title: `${campaign.productName} 홍보 카드뉴스`,
    contentStrategy,
    slides,
    caption: `📢 [${campaign.productName} 소식]
${campaign.productDescription}

${campaign.keyBenefits}

${toneEmoji} 인스타그램 카드뉴스를 쉽고 편리하게 관리하는 방법!
많은 관심 부탁드립니다.

📍 ${brand.ctaStyle}`,
    hashtags: [
      brand.name.replace(/\s+/g, ''),
      campaign.productName.replace(/\s+/g, ''),
      brand.industry.replace(/\s+/g, ''),
      '인스타운영',
      '카드뉴스',
      '마케팅꿀팁',
      'AI디자인',
      '인스타대행',
      '비즈니스성장'
    ].slice(0, 10),
    recommendedPostTime: '06:30 PM'
  }
}
