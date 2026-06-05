import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

const pages = [
  { path: '', priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing', priority: '0.9', changefreq: 'monthly' },
  { path: '/blog', priority: '0.7', changefreq: 'monthly' },
  { path: '/terms', priority: '0.5', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.5', changefreq: 'yearly' },
]

const locales = ['ko', 'en']

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const revalidate = 86400

export async function GET() {
  const now = new Date().toISOString()

  const urls = pages.flatMap(page =>
    locales.map(locale => {
      const loc = `${BASE_URL}/${locale}${page.path}`
      const alternates = locales
        .map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${BASE_URL}/${l}${page.path}"/>`)
        .join('\n')
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${alternates}
  </url>`
    })
  )

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
