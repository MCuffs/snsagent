'use server'

import { OpenAI } from 'openai'
import { isConfiguredOpenAIKey, getGroqApiKey, isConfiguredGroqKey, getPerplexityApiKey, isConfiguredPerplexityKey } from '../../lib/env'
import { getTextGenerationModel, temperatureOption } from '../../src/lib/ai/llmClient'
import {
  getSessionUser,
  unauthenticated,
  failed,
} from './_shared'

export async function analyzeGeneralProfileCoreWordAction(coreWord: string, locale = 'ko') {
  const user = await getSessionUser()
  if (!user) return unauthenticated()

  if (!coreWord || coreWord.trim().length === 0) {
    return failed(locale === 'en' ? 'Please enter a core word.' : '핵심 단어를 입력해 주세요.')
  }

  const prompt = locale === 'en'
    ? `You are a creative social media content strategist. Analyze the following core topic word and suggest profile details for a carousel card news channel.

Core word: "${coreWord.trim()}"

Respond ONLY with a valid JSON object matching this structure:
{
  "industry": "Choose one of: 'current-affairs', 'information', or 'trends'",
  "keywords": "4-5 search keywords to gather relevant articles, separated by commas (e.g. 'walnut benefits, healthy nuts, omega-3 foods, clean eating')",
  "targetAudience": "The primary target readers for this topic (e.g., 'Health-conscious adults, home cooks, and wellness enthusiasts aged 25-50')",
  "toneOfVoice": "The tone of voice for the news feed (e.g., 'Informative, trustworthy, warm and educational')",
  "mainColor": "#HEXCODE representing the topic's theme (e.g., '#8C6239' for walnut)"
}`
    : `당신은 한국의 트렌디하고 분석적인 마케팅 컨설턴트이자 에디터입니다.
입력된 핵심 단어를 바탕으로 카드뉴스 채널 프로필 정보를 분석 및 제안해주세요.

핵심 단어: "${coreWord.trim()}"

다음 JSON 형식으로만 응답해야 합니다. 다른 텍스트는 절대 금지합니다.
{
  "industry": "current-affairs, information, trends 중 가장 적절한 하나 선택",
  "keywords": "관련 뉴스나 정보를 수집하기 위한 핵심 검색어 4-5개 (쉼표로 구분. 예: '호두 효능, 견과류 영양, 불포화지방산, 웰빙 건강식품')",
  "targetAudience": "이 주제에 관심이 많고 반응할 만한 핵심 타겟 고객층 (구체적이고 트렌디하게 서술. 예: '웰빙과 건강 관리에 관심이 많은 3050 직장인 및 주부')",
  "toneOfVoice": "이 주제를 다루는 카드뉴스 채널에 알맞은 말투와 톤앤매너 (예: '신뢰감을 주며 차분하고 명확한 정보 전달의 어조')",
  "mainColor": "#HEX코드 (주제의 분위기를 가장 잘 대변하는 핵심 테마 색상. 예: '#8C6239')"
}`

  try {
    const perplexityKey = getPerplexityApiKey()
    const groqKey = getGroqApiKey()
    const openaiKey = process.env.OPENAI_API_KEY
    const usePerplexity = isConfiguredPerplexityKey(perplexityKey)
    const useGroq = !usePerplexity && isConfiguredGroqKey(groqKey)
    const useOpenAI = !usePerplexity && !useGroq && isConfiguredOpenAIKey(openaiKey)

    let jsonText = ''

    if (usePerplexity) {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      jsonText = data.choices?.[0]?.message?.content || ''
    } else if (useGroq) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
      jsonText = data.choices?.[0]?.message?.content || ''
    } else if (useOpenAI) {
      const openai = new OpenAI({ apiKey: openaiKey })
      const model = getTextGenerationModel()
      const response = await openai.chat.completions.create({
        model,
        ...temperatureOption(model, 0.1),
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
      jsonText = response.choices[0]?.message?.content || ''
    } else {
      return failed(locale === 'en' ? 'AI configuration missing.' : 'AI API 키 설정이 되어있지 않습니다.')
    }

    const parsed = JSON.parse(jsonText.trim()) as {
      industry?: string
      keywords?: string
      targetAudience?: string
      toneOfVoice?: string
      mainColor?: string
    }

    return {
      success: true as const,
      profile: {
        industry: parsed.industry || 'current-affairs',
        forbiddenWords: parsed.keywords || '',
        targetAudience: parsed.targetAudience || '',
        toneOfVoice: parsed.toneOfVoice || '',
        mainColor: parsed.mainColor || '#0f172a',
      }
    }
  } catch (err: unknown) {
    console.error('Core word analysis failed:', err)
    return failed(locale === 'en' ? 'AI analysis failed.' : 'AI 분석에 실패했습니다.')
  }
}
