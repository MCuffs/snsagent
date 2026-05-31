import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const FEEDS = {
  'current-affairs': 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
  'information': 'https://news.hadong.me/rss',
  'trends': 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko'
}

function cleanText(text: string): string {
  if (!text) return ''
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/gi, '$1')
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'current-affairs'
  
  const feedUrl = FEEDS[category as keyof typeof FEEDS] || FEEDS['current-affairs']
  
  try {
    const res = await fetch(feedUrl, {
      next: { revalidate: 600 } // cache for 10 minutes
    })
    
    if (!res.ok) {
      return NextResponse.json({ error: 'RSS 피드를 가져오는데 실패했습니다.' }, { status: res.status })
    }
    
    const xml = await res.text()
    
    // Extract item blocks
    const itemsMatch = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    
    const articles = itemsMatch.map(item => {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/)
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/)
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/)
      const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
      
      const title = cleanText(titleMatch?.[1] || '')
      const link = cleanText(linkMatch?.[1] || '')
      const description = cleanText(descMatch?.[1] || '')
      const pubDate = cleanText(pubDateMatch?.[1] || '')
      
      return { title, link, description, pubDate }
    }).slice(0, 15) // limit to 15 articles
    
    return NextResponse.json({ articles })
  } catch (error) {
    console.error('[RSS API] Failed to fetch feed:', error)
    return NextResponse.json({ error: 'RSS 데이터를 처리하는 과정에서 오류가 발생했습니다.' }, { status: 500 })
  }
}
