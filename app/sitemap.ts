import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'
const LOCALES = ['ko', 'en'] as const

const staticPages = ['', '/pricing', '/blog', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = []

  for (const page of staticPages) {
    entries.push({
      url: `${BASE_URL}/ko${page}`,
      lastModified: new Date(),
      changeFrequency: page === '' ? 'weekly' : 'monthly',
      priority: page === '' ? 1.0 : page === '/pricing' ? 0.9 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map(locale => [locale, `${BASE_URL}/${locale}${page}`])
        ),
      },
    })

    if (page !== '') {
      entries.push({
        url: `${BASE_URL}/en${page}`,
        lastModified: new Date(),
        changeFrequency: page === '/pricing' ? 'monthly' : 'monthly',
        priority: page === '/pricing' ? 0.9 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map(locale => [locale, `${BASE_URL}/${locale}${page}`])
          ),
        },
      })
    }
  }

  return entries
}
