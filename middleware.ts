import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { readSessionEmailEdge, SESSION_COOKIE_NAME } from './lib/auth/session-edge'
import { isAdminEmail } from './lib/auth/admin-emails'
import { checkRateLimit, RATE_LIMIT_PRESETS } from './lib/rateLimiter'

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. IP-based Rate Limiting for Auth and Payment API paths
  const isAuthRoute = pathname.startsWith('/api/auth/')
  const isPaymentRoute =
    pathname === '/api/nicepay/approve' ||
    pathname === '/api/nicepay/card-register' ||
    pathname === '/api/paypal/activate'

  if (isAuthRoute || isPaymentRoute) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1'
    const preset = isAuthRoute ? RATE_LIMIT_PRESETS.auth : RATE_LIMIT_PRESETS.payment
    const keyPrefix = isAuthRoute ? 'auth' : 'payment'

    const rateLimitResult = await checkRateLimit(`rate_limit:${keyPrefix}:${ip}`, preset)
    if (rateLimitResult.limited) {
      return new NextResponse(
        JSON.stringify({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
          }
        }
      )
    }
  }

  // Pass through API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  ) {
    return NextResponse.next()
  }

  // 1. Admin route authentication guard
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const email = await readSessionEmailEdge(token)
    if (!email) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!isAdminEmail(email)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  // 2. Protected user routes guard (concept, generate, works, billing)
  const protectedRoutes = ['/concept', '/generate', '/works', '/billing']
  let relativePath = pathname
  let locale = 'ko'

  for (const loc of routing.locales) {
    if (pathname === `/${loc}`) {
      relativePath = '/'
      locale = loc
      break
    } else if (pathname.startsWith(`/${loc}/`)) {
      relativePath = pathname.slice(loc.length + 1)
      locale = loc
      break
    }
  }

  const isProtected = protectedRoutes.some(route =>
    relativePath === route || relativePath.startsWith(route + '/')
  )

  if (isProtected) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const email = await readSessionEmailEdge(token)
    if (!email) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
    }
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
