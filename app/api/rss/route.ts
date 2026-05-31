import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Industry → multiple RSS feeds (more sources = better keyword matching)
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
  // Brand industry mappings
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

const DEFAULT_FEEDS = FEEDS['current-affairs']

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

async function fetchFeed(url: string): Promise<Array<{ title: string; link: string; description: string; pubDate: string }>> {
  try {
    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) return []
    const xml = await res.text()
    const itemsMatch = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    return itemsMatch.map(item => {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/)
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/)
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/)
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
      return {
        title: cleanText(titleMatch?.[1] || ''),
        link: cleanText(linkMatch?.[1] || ''),
        description: cleanText(descMatch?.[1] || ''),
        pubDate: cleanText(pubDateMatch?.[1] || ''),
      }
    }).filter(a => a.title.length > 0)
  } catch {
    return []
  }
}

// Score articles against keywords — higher weight for title matches
function scoreArticle(article: { title: string; description: string }, keywords: string[]): number {
  if (keywords.length === 0) return 0
  let score = 0
  const titleLower = article.title.toLowerCase()
  const descLower = article.description.toLowerCase()
  for (const kw of keywords) {
    const k = kw.toLowerCase()
    score += (titleLower.split(k).length - 1) * 3  // title hit = 3x weight
    score += (descLower.split(k).length - 1)
  }
  return score
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'current-affairs'
  const keywordsParam = searchParams.get('keywords') || ''
  const limitParam = parseInt(searchParams.get('limit') || '5', 10)

  const feedUrls = FEEDS[category] || DEFAULT_FEEDS
  const keywords = keywordsParam
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0)

  try {
    // Fetch all feeds in parallel
    const feedResults = await Promise.all(feedUrls.map(fetchFeed))
    const allArticles = feedResults.flat()

    if (allArticles.length === 0) {
      return NextResponse.json({ articles: [], matched: false })
    }

    // Deduplicate by title
    const seen = new Set<string>()
    const unique = allArticles.filter(a => {
      if (seen.has(a.title)) return false
      seen.add(a.title)
      return true
    })

    let articles = unique
    let matched = false

    if (keywords.length > 0) {
      // Score each article
      const scored = unique.map(a => ({ ...a, score: scoreArticle(a, keywords) }))
      const withScore = scored.filter(a => a.score > 0).sort((a, b) => b.score - a.score)

      if (withScore.length > 0) {
        articles = withScore.slice(0, limitParam)
        matched = true
      } else {
        // No keyword match: return recents but flag as unmatched
        articles = unique.slice(0, limitParam)
        matched = false
      }
    } else {
      articles = unique.slice(0, limitParam)
    }

    return NextResponse.json({ articles, matched, total: unique.length })
  } catch (error) {
    console.error('[RSS API] Failed to fetch feed:', error)
    return NextResponse.json({ error: 'RSS 데이터를 처리하는 과정에서 오류가 발생했습니다.' }, { status: 500 })
  }
}
