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

const FEEDS: Record<string, string[]> = {
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

export async function fetchRssForGeneration(params: {
  category: string
  keywords: string[]
  topic?: string
  limit?: number
}): Promise<RssFetchResult> {
  const { category, keywords, topic, limit = 5 } = params
  const feedUrls = FEEDS[category] || FEEDS['current-affairs']

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

    const articles = unique.slice(0, limit)
    return { articles, matched: false, topArticle: articles[0] ?? null }
  } catch {
    return { articles: [], matched: false, topArticle: null }
  }
}

// Build a rich context string from fetched articles to inject into the LLM pipeline
export function buildRssContext(result: RssFetchResult, language: 'ko' | 'en' = 'ko'): string {
  if (result.articles.length === 0) return ''

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
