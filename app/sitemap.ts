import type { MetadataRoute } from 'next'

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

  return entries
}
