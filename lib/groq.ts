import Groq from 'groq-sdk'

const TONE_OPTIONS = (locale: string) => locale === 'en'
  ? '"Friendly and clear", "Professional and trustworthy", "Young and energetic", "Premium and calm"'
  : '"친근하고 명확한 톤", "전문적이고 신뢰감 있는 톤", "젊고 경쾌한 톤", "고급스럽고 차분한 톤"'

const INDUSTRY_OPTIONS = (locale: string) => locale === 'en'
  ? "'Online store', 'Cafe / F&B', 'Fitness', 'Beauty / Care', 'Education', 'IT / SaaS'"
  : "'온라인 스토어', '카페 / F&B', '피트니스', '뷰티 / 케어', '교육 / 강의', 'IT / SaaS'"

const BRAND_ANALYSIS_PROMPT = (cleanedText: string, locale = 'ko') => {
  const lang = locale === 'en' ? 'English' : '한국어'
  const reportLang = locale === 'en' ? 'English' : 'Korean (한국어)'
  const tones = TONE_OPTIONS(locale)
  const industries = INDUSTRY_OPTIONS(locale)
  const exampleReport = locale === 'en'
    ? 'This is a brand that... (3–4 natural paragraphs, no headers or bullets)'
    : '이 브랜드는... (3~4문단 자연스러운 서술, 제목이나 목록 없이)'

  return `You are an expert brand consultant and digital marketer.
Analyze the following text content scraped from a user's store or brand website, and extract/infer the brand profile fields.
Also, write a professional brand analysis report in Markdown format.

IMPORTANT: All text values in the JSON (name, targetAudience, toneOfVoice, forbiddenWords, ctaStyle, coreProducts, valueProposition, customerPainPoints, differentiators, visualMood, contentPillars, brandKeywords, avoidVisuals, markdownReport) MUST be written in ${lang}.

[Collected Brand URL Context]
${cleanedText}

[Requirements]
1. Identify the brand's name, core products/items, target audience, tone of voice, a recommended primary brand color (HEX code), any words to avoid (forbidden words), and a default Call-to-Action (CTA) style. Prioritize Page Metadata, JSON-LD structured data, headings, image alt text, product/category signals, and important body text. Do not overfit to footer/legal/navigation text.
2. The primary brand color must be a high-quality hex color code (e.g. '#B94718', '#2D3748') that represents the brand's aesthetic.
3. Recommend 2-4 forbidden words that are overused or spammy in this brand's industry. Write them in ${lang}.
4. The tone of voice must match one of these options: ${tones}
5. The industry must fit one of: ${industries}
6. Write a brand analysis summary under "markdownReport". Write it as 3–4 natural prose paragraphs — like a creative strategist explaining this brand to a colleague. Cover: what the brand is and who it's for, what makes it stand out, and what kind of card news content would work best. Do NOT use section headers, bullet points, numbered lists, or markdown bold (**). Plain flowing text only.
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
  "markdownReport": "${exampleReport}"
}
`
}

export async function analyzeBrandWithGroq(apiKey: string, cleanedText: string, locale = 'ko') {
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
        content: BRAND_ANALYSIS_PROMPT(cleanedText, locale),
      },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const text = response.choices[0].message.content?.trim() || ''
  return JSON.parse(text)
}

