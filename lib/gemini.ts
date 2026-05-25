import { GoogleGenerativeAI } from '@google/generative-ai'

const BRAND_ANALYSIS_PROMPT = (cleanedText: string) => `
You are an expert brand consultant and digital marketer.
Analyze the following text content scraped from a user's store or brand website, and extract/infer the brand profile fields.
Also, write a professional brand analysis report in Markdown format.

[Collected Brand URL Context]
${cleanedText}

[Requirements]
1. Identify the brand's name, core products/items, target audience, tone of voice, a recommended primary brand color (HEX code), any words to avoid (forbidden words), and a default Call-to-Action (CTA) style for Instagram. Prioritize Page Metadata, JSON-LD structured data, headings, image alt text, product/category signals, and important body text. Do not overfit to footer/legal/navigation text.
2. The primary brand color must be a high-quality hex color code (e.g. '#B94718', '#2D3748', etc.) that represents the brand's aesthetic.
3. Recommend 2-4 forbidden words that are overused or spammy in this brand's industry.
4. The tone of voice must match one of these pre-defined options or a custom short variant:
   - "친근하고 명확한 톤" (Friendly and clear)
   - "전문적이고 신뢰감 있는 톤" (Professional and trustworthy)
   - "젊고 경쾌한 톤" (Young and cheerful)
   - "고급스럽고 차분한 톤" (Premium and calm)
5. The industry must fit one of: '온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS'.
6. Write a brand identity report in Markdown (under "markdownReport"). Keep it professional, informative, and written in Korean (한국어). The report should outline the Brand Identity, Key Strengths, and SNS content strategy suggestions.
7. CRITICAL: Do NOT use markdown bold syntax like '**' or '***' anywhere in the "markdownReport". Write section items in plain text.
8. Extract brand-specific DNA fields for downstream card-news generation. These must be concrete to the website, not generic industry labels.

You MUST respond ONLY with a valid JSON object (no markdown code fences) matching this structure:
{
  "name": "Brand Name (Korean/English)",
  "industry": "One of the 6 industries listed above",
  "targetAudience": "Target customers description (e.g. 2030 여성 직장인)",
  "toneOfVoice": "One of the 4 tones listed above",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "word1, word2, word3",
  "ctaStyle": "A short call-to-action recommendation (e.g. 프로필 링크에서 만나보기)",
  "coreProducts": ["specific product/service names"],
  "valueProposition": "specific brand promise",
  "customerPainPoints": ["specific customer problem"],
  "differentiators": ["specific differentiator"],
  "visualMood": "specific background-image mood",
  "contentPillars": ["SNS pillar"],
  "brandKeywords": ["brand-specific keyword"],
  "avoidVisuals": ["generic visual trope to avoid"],
  "markdownReport": "# 브랜드 분석 보고서\\n\\n## 1. 브랜드 정체성\\n..."
}
`

export async function analyzeBrandWithGemini(apiKey: string, cleanedText: string) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  })

  const result = await model.generateContent(BRAND_ANALYSIS_PROMPT(cleanedText))
  const text = result.response.text().trim()

  // JSON 펜스 제거 (모델이 가끔 ```json ... ``` 형태로 감쌀 때 대비)
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonText)
}
