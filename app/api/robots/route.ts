import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export async function GET() {
  const content = `User-agent: *
Allow: /
Allow: /ko/
Allow: /en/
Allow: /ko/pricing
Allow: /en/pricing
Allow: /ko/blog
Allow: /en/blog
Allow: /ko/terms
Allow: /en/terms
Allow: /ko/privacy
Allow: /en/privacy
Disallow: /ko/concept
Disallow: /en/concept
Disallow: /ko/generate
Disallow: /en/generate
Disallow: /ko/works
Disallow: /en/works
Disallow: /ko/billing
Disallow: /en/billing
Disallow: /ko/campaign
Disallow: /en/campaign
Disallow: /ko/painter
Disallow: /en/painter
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml`

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
