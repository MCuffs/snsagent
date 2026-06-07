import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

function getRequestCountry(request: NextRequest) {
  const geoCountry = (request as unknown as { geo?: { country?: string } }).geo?.country
  const headerCountry =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    request.headers.get('cloudfront-viewer-country')

  return (geoCountry || headerCountry || '').toUpperCase()
}

function getRootLocale(request: NextRequest) {
  const country = getRequestCountry(request)
  if (country) return country === 'KR' ? 'ko' : 'en'

  const acceptLanguage = request.headers.get('accept-language')?.toLowerCase() || ''
  if (acceptLanguage.startsWith('ko') || acceptLanguage.includes(',ko')) return 'ko'
  if (acceptLanguage) return 'en'

  return routing.defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through API routes, static files, Next.js internals, and admin routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  ) {
    return NextResponse.next()
  }

  // Root path: geo-based locale redirect
  if (pathname === '/') {
    const locale = getRootLocale(request)
    return NextResponse.redirect(new URL(`/${locale}`, request.url))
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
}
