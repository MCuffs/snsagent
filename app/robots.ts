import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/ko/', '/en/', '/ko/pricing', '/en/pricing', '/ko/blog', '/en/blog'],
        disallow: [
          '/ko/concept',
          '/en/concept',
          '/ko/generate',
          '/en/generate',
          '/ko/works',
          '/en/works',
          '/ko/billing',
          '/en/billing',
          '/ko/campaign',
          '/en/campaign',
          '/ko/painter',
          '/en/painter',
          '/api/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
