import { buildRssContext, extractGenerationKeywords, fetchRssForGeneration, inferRssCategory } from '../rss/rssFetcher'

export interface ResearchSource {
  title: string
  url: string
  provider: 'wikipedia' | 'duckduckgo' | 'usda' | 'rss'
}

export interface SlideEvidence {
  slideNumber: number
  role: string
  mustUseFacts: string[]
  avoidClaims: string[]
}

export interface CarouselResearchBrief {
  subject: string
  userIntent: string
  queries: string[]
  verifiedFacts: string[]
  cautions: string[]
  slideEvidence: SlideEvidence[]
  sources: ResearchSource[]
}

interface ResearchInput {
  topic: string
  category?: string
  keyContent?: string
  contentType?: string
  slideCount: number
  language?: 'ko' | 'en'
}

const FOOD_TRANSLATIONS: Record<string, string> = {
  '호두': 'walnut',
  '아몬드': 'almond',
  '캐슈': 'cashew',
  '피스타치오': 'pistachio',
  '견과': 'nuts',
  '견과류': 'nuts',
}

const TOPIC_STOPWORDS = [
  '카드뉴스', '카드 뉴스', '콘텐츠', '컨텐츠', '본문', '소개', '추천', '효능', '효과', '장점',
  '올바른', '섭취', '가이드', '만들어주세요', '만들어줘', '만들어', '제작', '생성',
]

export async function buildCarouselResearchBrief(input: ResearchInput): Promise<CarouselResearchBrief | null> {
  const subject = extractResearchSubject(input.topic)
  if (!subject || subject.length < 2) return null

  const userIntent = inferUserIntent(input.topic, input.contentType)
  const queries = buildQueries(subject, userIntent, input.language || 'ko')
  const [wiki, duck, usda, rss] = await Promise.all([
    fetchWikipediaFacts(subject, input.language || 'ko'),
    fetchDuckDuckGoFacts(queries[0], subject),
    fetchUsdaFacts(subject),
    fetchRssFacts(input, subject),
  ])

  const sources = uniqueSources([...wiki.sources, ...duck.sources, ...usda.sources, ...rss.sources])
  const rawFacts = [
    ...wiki.facts,
    ...duck.facts,
    ...usda.facts,
    ...rss.facts,
  ]
  const verifiedFacts = uniqueStrings(rawFacts)
    .filter(fact => isRelevantFact(fact, subject, input.topic))
    .slice(0, 12)

  if (verifiedFacts.length < 2 && sources.length === 0) return null

  const cautions = buildCautions(input.topic, subject, verifiedFacts)
  const slideEvidence = buildSlideEvidence({
    subject,
    slideCount: input.slideCount,
    facts: verifiedFacts,
    cautions,
    intent: userIntent,
  })

  return {
    subject,
    userIntent,
    queries,
    verifiedFacts,
    cautions,
    slideEvidence,
    sources,
  }
}

export function formatResearchBriefForPrompt(brief: CarouselResearchBrief | null, language: 'ko' | 'en' = 'ko') {
  if (!brief || brief.verifiedFacts.length === 0) return ''

  if (language === 'en') {
    return [
      '[EXTERNAL RESEARCH BRIEF — topic-matched evidence]',
      `Subject: ${brief.subject}`,
      `User intent: ${brief.userIntent}`,
      '',
      'Verified facts to use:',
      ...brief.verifiedFacts.map((fact, index) => `${index + 1}. ${fact}`),
      '',
      'Cautions:',
      ...brief.cautions.map((caution, index) => `${index + 1}. ${caution}`),
      '',
      'Slide evidence allocation:',
      ...brief.slideEvidence.map(slide => `Slide ${slide.slideNumber} [${slide.role}]: use ${slide.mustUseFacts.join(' / ')}; avoid ${slide.avoidClaims.join(' / ')}`),
      '',
      'Sources:',
      ...brief.sources.slice(0, 6).map(source => `- ${source.title} (${source.provider}) ${source.url}`),
      '',
      'Use this brief as factual grounding. Do not introduce unrelated news or unsupported medical claims.',
    ].join('\n')
  }

  return [
    '[외부 리서치 브리프 — 주제 매칭 근거]',
    `핵심 주제: ${brief.subject}`,
    `사용자 의도: ${brief.userIntent}`,
    '',
    '본문에 활용할 검증 정보:',
    ...brief.verifiedFacts.map((fact, index) => `${index + 1}. ${fact}`),
    '',
    '주의할 표현:',
    ...brief.cautions.map((caution, index) => `${index + 1}. ${caution}`),
    '',
    '슬라이드별 근거 배분:',
    ...brief.slideEvidence.map(slide => `슬라이드 ${slide.slideNumber} [${slide.role}]: ${slide.mustUseFacts.join(' / ')} | 피할 내용: ${slide.avoidClaims.join(' / ')}`),
    '',
    '출처:',
    ...brief.sources.slice(0, 6).map(source => `- ${source.title} (${source.provider}) ${source.url}`),
    '',
    '위 리서치 브리프를 사실 근거로 사용하세요. 사용자 주제와 무관한 뉴스/경제/시사 정보나 확인되지 않은 의학적 효능은 넣지 마세요.',
  ].join('\n')
}

function extractResearchSubject(topic: string) {
  const normalized = topic.replace(/\s+/g, ' ').trim()
  const knownFood = normalized.match(/호두|아몬드|캐슈|피스타치오|견과류|견과/u)
  if (knownFood?.[0]) return knownFood[0]

  const beforePossessive = normalized.match(/^([가-힣A-Za-z0-9]{2,})의\s*(?:효능|효과|장점|특징|섭취|활용|추천|정보)/u)
  if (beforePossessive?.[1]) return beforePossessive[1]

  let cleaned = normalized
  for (const stopword of TOPIC_STOPWORDS) {
    cleaned = cleaned.replaceAll(stopword, ' ')
  }
  return cleaned
    .replace(/효능\s*과|효과\s*와|장점\s*과|특징\s*과/g, ' ')
    .replace(/\b(?:과|와|및|에|대한|대해)\b/g, ' ')
    .replace(/의\s*(?:과|와)\b/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/의$/u, '')
    .split(/\s+/)[0] || normalized
}

function inferUserIntent(topic: string, contentType?: string) {
  const text = `${topic} ${contentType || ''}`
  if (/주의|부작용|섭취|먹는|가이드|보관/u.test(text)) return '섭취법과 주의점을 균형 있게 설명'
  if (/효능|효과|영양|성분|건강/u.test(text)) return '효능과 영양 정보를 근거 중심으로 설명'
  if (/비교|체크|구매/u.test(text)) return '구매 전 확인할 기준을 정리'
  return '주제와 관련된 핵심 정보를 카드뉴스로 설명'
}

function buildQueries(subject: string, intent: string, language: 'ko' | 'en') {
  const translated = FOOD_TRANSLATIONS[subject] || subject
  if (language === 'en') {
    return uniqueStrings([
      `${translated} nutrition facts benefits cautions`,
      `${translated} serving size storage`,
      `${translated} practical guide`,
    ])
  }
  return uniqueStrings([
    `${subject} ${intent}`,
    `${subject} 영양 성분 섭취량 주의점`,
    `${translated} nutrition facts serving size`,
  ])
}

async function fetchWikipediaFacts(subject: string, language: 'ko' | 'en') {
  const langOrder = uniqueStrings([language, 'ko', 'en'])
  for (const lang of langOrder) {
    const title = await findWikipediaTitle(subject, lang)
    if (!title) continue
    const summary = await fetchJson<{ title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }>(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
    const extract = summary?.extract || ''
    const facts = splitSentences(extract)
      .filter(sentence => sentence.length >= 24)
      .slice(0, 4)
    if (facts.length > 0) {
      return {
        facts,
        sources: [{
          title: summary?.title || title,
          url: summary?.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
          provider: 'wikipedia' as const,
        }],
      }
    }
  }
  return { facts: [] as string[], sources: [] as ResearchSource[] }
}

async function findWikipediaTitle(subject: string, language: string) {
  const data = await fetchJson<{ query?: { search?: Array<{ title: string }> } }>(
    `https://${language}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=${encodeURIComponent(subject)}`
  )
  return data?.query?.search?.[0]?.title || null
}

async function fetchDuckDuckGoFacts(query: string, subject: string) {
  const data = await fetchJson<{
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
  }>(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`)

  const facts = uniqueStrings([
    ...(data?.AbstractText ? splitSentences(data.AbstractText) : []),
    ...((data?.RelatedTopics || []).map(topic => topic.Text || '').filter(Boolean)),
  ]).filter(fact => fact.includes(subject) || fact.toLowerCase().includes((FOOD_TRANSLATIONS[subject] || subject).toLowerCase())).slice(0, 4)

  return {
    facts,
    sources: data?.AbstractURL ? [{
      title: data.Heading || query,
      url: data.AbstractURL,
      provider: 'duckduckgo' as const,
    }] : [] as ResearchSource[],
  }
}

async function fetchUsdaFacts(subject: string) {
  const query = FOOD_TRANSLATIONS[subject]
  if (!query) return { facts: [] as string[], sources: [] as ResearchSource[] }

  const data = await fetchJson<{
    foods?: Array<{
      description?: string
      fdcId?: number
      foodNutrients?: Array<{ nutrientName?: string; value?: number; unitName?: string }>
    }>
  }>(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=1&query=${encodeURIComponent(query)}`)

  const food = data?.foods?.[0]
  if (!food) return { facts: [] as string[], sources: [] as ResearchSource[] }
  const nutrients = (food.foodNutrients || [])
    .filter(nutrient => typeof nutrient.value === 'number' && nutrient.value > 0)
    .filter(nutrient => /Energy|Total lipid|Fiber|Protein|Magnesium|Potassium|Vitamin E|Fatty acids/i.test(nutrient.nutrientName || ''))
    .slice(0, 5)
    .map(nutrient => `${nutrient.nutrientName}: ${nutrient.value}${nutrient.unitName ? ` ${nutrient.unitName}` : ''}`)

  const facts = nutrients.length > 0
    ? [`USDA FoodData Central 기준 ${subject} 관련 식품 정보에는 ${nutrients.join(', ')} 등의 영양 항목이 확인됩니다.`]
    : []

  return {
    facts,
    sources: [{
      title: `USDA FoodData Central: ${food.description || query}`,
      url: food.fdcId ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients` : 'https://fdc.nal.usda.gov/',
      provider: 'usda' as const,
    }],
  }
}

async function fetchRssFacts(input: ResearchInput, subject: string) {
  try {
    const keywords = extractGenerationKeywords(input.topic, [subject, input.category || '', input.contentType || ''])
    const result = await fetchRssForGeneration({
      category: inferRssCategory(input.topic, input.category || 'information'),
      keywords,
      topic: input.topic,
      limit: 3,
    })
    const context = buildRssContext(result, input.language || 'ko')
    if (!context) return { facts: [] as string[], sources: [] as ResearchSource[] }
    return {
      facts: result.articles.map(article => `${article.title}${article.description ? ` — ${article.description}` : ''}`).slice(0, 3),
      sources: result.articles.map(article => ({
        title: article.title,
        url: article.link,
        provider: 'rss' as const,
      })),
    }
  } catch {
    return { facts: [] as string[], sources: [] as ResearchSource[] }
  }
}

function buildCautions(topic: string, subject: string, facts: string[]) {
  const cautions = [
    '외부 자료에 없는 수치, 순위, 치료 효과, 질병 예방 효과를 새로 만들지 않는다.',
    `${subject}의 장점은 식단 안에서의 활용으로 설명하고 의학적 치료처럼 단정하지 않는다.`,
  ]
  if (/효능|건강|섭취|영양|성분|식품|간식|호두|견과/u.test(topic)) {
    cautions.push('열량, 과다 섭취, 알레르기, 보관법처럼 실제 섭취 시 확인할 주의점을 함께 다룬다.')
  }
  if (facts.some(fact => /\d/.test(fact))) {
    cautions.push('숫자를 사용할 때는 출처가 있는 영양 정보 범위 안에서만 사용한다.')
  }
  return uniqueStrings(cautions).slice(0, 5)
}

function buildSlideEvidence(params: {
  subject: string
  slideCount: number
  facts: string[]
  cautions: string[]
  intent: string
}) {
  const roles = inferRoles(params.slideCount)
  const fallbackFacts = [
    `${params.subject}의 핵심 특징`,
    `${params.subject}를 실제 생활에서 활용하는 장면`,
    `${params.subject}를 선택하거나 섭취할 때 확인할 기준`,
  ]
  const facts = params.facts.length > 0 ? params.facts : fallbackFacts
  return roles.map((role, index) => ({
    slideNumber: index + 1,
    role,
    mustUseFacts: uniqueStrings([
      facts[index % facts.length],
      role === 'save-cta' || role === 'summary' ? params.cautions[0] : facts[(index + 1) % facts.length],
    ]).slice(0, 2),
    avoidClaims: params.cautions.slice(0, 2),
  }))
}

function inferRoles(slideCount: number) {
  const base = ['hook', 'context', 'key-point', 'detail', 'stat', 'detail', 'summary', 'save-cta']
  return Array.from({ length: slideCount }, (_, index) => base[index] || (index === slideCount - 1 ? 'save-cta' : 'detail'))
}

function isRelevantFact(fact: string, subject: string, topic: string) {
  const text = fact.toLowerCase()
  const translated = (FOOD_TRANSLATIONS[subject] || subject).toLowerCase()
  const topicTokens = extractGenerationKeywords(topic, [subject]).map(token => token.toLowerCase())
  const hasSubject = text.includes(subject.toLowerCase()) || text.includes(translated)
  const hasTopicToken = topicTokens.some(token => text.includes(token))
  const financeNoise = /코스피|증시|주가|반도체|금리|환율|상승장|하락장/u.test(fact)
  const financeTopic = /경제|증시|주식|금리|환율|코스피/u.test(topic)
  return (hasSubject || hasTopicToken) && (!financeNoise || financeTopic)
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 },
      headers: {
        'User-Agent': 'ShufflaResearchBot/1.0 (card-news-generation)',
      },
    })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function splitSentences(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/u)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(value => value.replace(/\s+/g, ' ').trim()).filter(Boolean)))
}

function uniqueSources(values: ResearchSource[]) {
  const seen = new Set<string>()
  return values.filter(source => {
    const key = `${source.provider}:${source.url || source.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return Boolean(source.title && source.url)
  }).slice(0, 8)
}
