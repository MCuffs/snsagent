// Server-side RSS fetcher used by the campaign generation pipeline.
// Fetches and keyword-scores articles so real news context flows into copy/hook generation.

interface RssArticle {
  title: string
  link: string
  description: string
  pubDate: string
}

interface RssFetchResult {
  articles: RssArticle[]
  matched: boolean
  topArticle: RssArticle | null
}

const FEEDS_KO: Record<string, string[]> = {
  'current-affairs': [
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko',
  ],
  'information': [
    'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ko&gl=KR&ceid=KR:ko',
  ],
  'trends': [
    'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko',
  ],
  '온라인 스토어': [
    'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
  '카페 / F&B': [
    'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
  '피트니스': [
    'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
  '뷰티 / 케어': [
    'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
  '교육 / 강의': [
    'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
  'IT / SaaS': [
    'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  ],
}

const FEEDS_EN: Record<string, string[]> = {
  'current-affairs': [
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en',
  ],
  'information': [
    'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-US&gl=US&ceid=US:en',
  ],
  'trends': [
    'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en',
  ],
  'tech': [
    'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
  ],
  'business': [
    'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
  ],
}

// Legacy default — Korean
const FEEDS = FEEDS_KO

const TOPIC_STOPWORDS = new Set([
  '카드뉴스', '카드', '뉴스', '만들어주세요', '만들어줘', '만들어', '제작해주세요', '제작해줘',
  '대한', '대해', '관련', '정보', '알려주세요', '알려줘', '해주세요', '해줘', '요청',
  'the', 'a', 'an', 'about', 'for', 'make', 'create', 'carousel', 'card', 'news',
])

const CATEGORY_HINTS: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'information', patterns: [/효능|건강|영양|식단|질병|예방|증상|운동|피로|면역|수면|혈당|콜레스테롤|다이어트/] },
  { category: 'trends', patterns: [/트렌드|기술|ai|인공지능|it|앱|플랫폼|소셜|콘텐츠|마케팅/i] },
  { category: 'current-affairs', patterns: [/정책|경제|증시|코스피|금리|환율|선거|사회|국제|정치|사건/] },
]

function cleanText(text: string): string {
  if (!text) return ''
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/gi, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim()
}

async function fetchOneFeed(url: string): Promise<RssArticle[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) return []
    const xml = await res.text()
    const itemsMatch = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    return itemsMatch.map(item => ({
      title: cleanText(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''),
      link: cleanText(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || ''),
      description: cleanText(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || ''),
      pubDate: cleanText(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || ''),
    })).filter(a => a.title.length > 0)
  } catch {
    return []
  }
}

function scoreArticle(article: RssArticle, keywords: string[]): number {
  if (keywords.length === 0) return 0
  let score = 0
  const titleLower = article.title.toLowerCase()
  const descLower = article.description.toLowerCase()
  for (const kw of keywords) {
    const k = kw.toLowerCase()
    score += (titleLower.split(k).length - 1) * 3
    score += (descLower.split(k).length - 1)
  }
  return score
}

export function extractGenerationKeywords(topic?: string, extraKeywords: string[] = []): string[] {
  const source = [topic || '', ...extraKeywords].join(' ')
  return Array.from(new Set(
    source
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length > 1 && !TOPIC_STOPWORDS.has(word))
  )).slice(0, 8)
}

export function inferRssCategory(topic?: string, fallback = 'information') {
  const normalized = (topic || '').toLowerCase()
  for (const hint of CATEGORY_HINTS) {
    if (hint.patterns.some(pattern => pattern.test(normalized))) return hint.category
  }
  return fallback
}

export async function fetchRssForGeneration(params: {
  category: string
  keywords: string[]
  topic?: string
  limit?: number
  language?: 'ko' | 'en'
}): Promise<RssFetchResult> {
  const { category, keywords, topic, limit = 5, language = 'ko' } = params
  const feedMap = language === 'en' ? FEEDS_EN : FEEDS_KO
  const feedUrls = feedMap[category] || feedMap['current-affairs'] || FEEDS_KO['current-affairs']

  try {
    const feedResults = await Promise.all(feedUrls.map(fetchOneFeed))
    const allArticles = feedResults.flat()

    if (allArticles.length === 0) return { articles: [], matched: false, topArticle: null }

    // Deduplicate
    const seen = new Set<string>()
    const unique = allArticles.filter(a => {
      if (seen.has(a.title)) return false
      seen.add(a.title)
      return true
    })

    // Combine keywords + topic words for scoring
    const allKeywords = [
      ...keywords,
      ...(topic ? topic.split(/\s+/).filter(w => w.length > 1) : []),
    ]

    if (allKeywords.length > 0) {
      const scored = unique
        .map(a => ({ article: a, score: scoreArticle(a, allKeywords) }))
        .sort((a, b) => b.score - a.score)

      const matched = scored.filter(s => s.score > 0)
      if (matched.length > 0) {
        const articles = matched.slice(0, limit).map(s => s.article)
        return { articles, matched: true, topArticle: articles[0] }
      }
    }

    return { articles: [], matched: false, topArticle: null }
  } catch {
    return { articles: [], matched: false, topArticle: null }
  }
}

// Build a rich context string from fetched articles to inject into the LLM pipeline
export function buildRssContext(result: RssFetchResult, language: 'ko' | 'en' = 'ko'): string {
  if (!result.matched || result.articles.length === 0) return ''

  if (language === 'en') {
    const lines = [
      `[Real-Time News Context — ${result.matched ? 'Keyword Matched' : 'Latest News'}]`,
      `Use the following ${result.articles.length} real news articles as the factual foundation for hooks, headlines, and body copy.`,
      `Write card news based on genuine trending topics — not fabricated content.`,
      '',
    ]
    result.articles.forEach((a, i) => {
      lines.push(`Article ${i + 1}: ${a.title}`)
      if (a.description) lines.push(`  → ${a.description.slice(0, 200)}`)
    })
    lines.push('', 'The hook must reference actual news angles from the articles above.')
    return lines.join('\n')
  }

  const lines = [
    `[실시간 뉴스 컨텍스트 — ${result.matched ? '키워드 매칭 기사' : '최신 뉴스'}]`,
    `아래 ${result.articles.length}개의 실제 최신 뉴스 기사를 카드뉴스 훅·헤드라인·본문 작성의 사실적 근거로 활용하세요.`,
    `실제로 사람들이 관심을 갖고 있는 트렌드와 이슈를 기반으로 카드뉴스를 만들어야 합니다. 억지 내용 금지.`,
    '',
  ]
  result.articles.forEach((a, i) => {
    lines.push(`기사 ${i + 1}: ${a.title}`)
    if (a.description) lines.push(`  → ${a.description.slice(0, 200)}`)
  })
  lines.push('', '훅 문구는 반드시 위 기사들의 실제 뉴스 앵글을 반영해야 합니다.')
  return lines.join('\n')
}
