import type { MetadataRoute } from 'next'
import { getAllBlogPostPaths } from '../lib/blog-posts'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
const LOCALES = ['ko', 'en'] as const

const staticPages = ['', '/pricing', '/blog', '/terms', '/privacy', '/login']

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []
  const now = new Date()

  for (const page of staticPages) {
    for (const locale of LOCALES) {
      const url = `${BASE_URL}/${locale}${page}`
      const priority = page === '' ? 1.0 : page === '/pricing' ? 0.9 : page === '/blog' ? 0.8 : 0.6
      const changeFrequency = page === '' ? 'weekly' : page === '/blog' ? 'daily' : 'monthly'

      entries.push({
        url,
        lastModified: now,
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
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    })
  }

  return entries
}
