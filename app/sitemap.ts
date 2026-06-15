import type { MetadataRoute } from 'next'
import { getAllBlogPostPaths } from '../lib/blog-posts'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
const LOCALES = ['ko', 'en'] as const

const staticPages = ['', '/pricing', '/blog', '/terms', '/privacy', '/login']

// 실제 페이지 콘텐츠 마지막 수정일 — 배포할 때마다 업데이트
const LAST_MODIFIED: Record<string, string> = {
  '': '2026-06-15',
  '/pricing': '2026-06-15',
  '/blog': '2026-06-15',
  '/terms': '2026-05-20',
  '/privacy': '2026-05-20',
  '/login': '2026-05-20',
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const page of staticPages) {
    for (const locale of LOCALES) {
      const url = `${BASE_URL}/${locale}${page}`
      const priority = page === '' ? 1.0 : page === '/pricing' ? 0.9 : page === '/blog' ? 0.8 : 0.6
      const changeFrequency = page === '' ? 'weekly' : page === '/blog' ? 'weekly' : 'monthly'

      entries.push({
        url,
        lastModified: new Date(LAST_MODIFIED[page] ?? '2026-05-20'),
        changeFrequency,
        priority,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map(l => [l, `${BASE_URL}/${l}${page}`])
          ),
        },
      })
    }
  }

  for (const { locale, slug } of getAllBlogPostPaths()) {
    entries.push({
      url: encodeURI(`${BASE_URL}/${locale}/blog/${slug}`),
      lastModified: new Date('2026-05-20'),
      changeFrequency: 'monthly',
      priority: 0.7,
    })
  }

  return entries
}
