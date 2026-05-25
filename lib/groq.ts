import Groq from 'groq-sdk'

const BRAND_ANALYSIS_PROMPT = (cleanedText: string) => `
You are an expert brand consultant and digital marketer.
Analyze the following text content scraped from a user's store or brand website, and extract/infer the brand profile fields.
Also, write a professional brand analysis report in Markdown format.

[Collected Brand URL Context]
${cleanedText}

[Requirements]
1. Identify the brand's name, core products/items, target audience, tone of voice, a recommended primary brand color (HEX code), any words to avoid (forbidden words), and a default Call-to-Action (CTA) style for Instagram. Prioritize Page Metadata, JSON-LD structured data, headings, image alt text, product/category signals, and important body text. Do not overfit to footer/legal/navigation text.
2. The primary brand color must be a high-quality hex color code (e.g. '#B94718', '#2D3748') that represents the brand's aesthetic.
3. Recommend 2-4 forbidden words that are overused or spammy in this brand's industry.
4. The tone of voice must match one of these options:
   - "친근하고 명확한 톤"
   - "전문적이고 신뢰감 있는 톤"
   - "젊고 경쾌한 톤"
   - "고급스럽고 차분한 톤"
5. The industry must fit one of: '온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS'.
6. Write a brand identity report under "markdownReport" in Korean (한국어). Cover Brand Identity, Key Strengths, and SNS content strategy. Do NOT use markdown bold syntax (**).
7. Extract brand-specific DNA fields. These must be concrete to the website, not generic industry labels.

Respond ONLY with valid JSON (no code fences) matching this exact structure:
{
  "name": "Brand Name",
  "industry": "one of the 6 industries",
  "targetAudience": "target customers description",
  "toneOfVoice": "one of the 4 tones",
  "mainColor": "#HEXCODE",
  "forbiddenWords": "word1, word2",
  "ctaStyle": "short CTA recommendation",
  "coreProducts": ["product name"],
  "valueProposition": "specific brand promise",
  "customerPainPoints": ["specific customer problem"],
  "differentiators": ["specific differentiator"],
  "visualMood": "specific visual mood description",
  "contentPillars": ["SNS content pillar"],
  "brandKeywords": ["brand-specific keyword"],
  "avoidVisuals": ["visual trope to avoid"],
  "markdownReport": "# 브랜드 분석 보고서\\n\\n## 1. 브랜드 정체성\\n..."
}
`

export async function analyzeBrandWithGroq(apiKey: string, cleanedText: string) {
  const groq = new Groq({ apiKey })

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a brand analysis AI. Return valid JSON only. No markdown code fences. No bold syntax (**).',
      },
      {
        role: 'user',
        content: BRAND_ANALYSIS_PROMPT(cleanedText),
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const text = response.choices[0].message.content?.trim() || ''
  return JSON.parse(text)
}
