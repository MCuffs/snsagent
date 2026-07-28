import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { isAdminEmail } from './lib/auth/admin-emails'
import { readSessionEmailEdge, SESSION_COOKIE_NAME } from './lib/auth/session-edge'

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname === '/sync_js' ||
    pathname === '/data_debug' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.match(/\.[a-zA-Z0-9]+$/) ||
    request.headers.get('next-action') !== null
  ) {
    return NextResponse.next()
  }

  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/')
  const localeAdminMatch = pathname.match(/^\/(ko|en)(\/admin(?:\/.*)?)?$/)
  const isLocaleAdminPath = localeAdminMatch && localeAdminMatch[2] !== undefined

  if (isAdminPath || isLocaleAdminPath) {
    if (isLocaleAdminPath) {
      const adminSuffix = localeAdminMatch![2] ?? '/admin'
      return NextResponse.redirect(new URL(adminSuffix, request.url))
    }
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

  const protectedRoutes = ['/billing']
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

  if (pathname === '/') {
    const locale = getRootLocale(request)
    return NextResponse.redirect(new URL(`/${locale}`, request.url))
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next|_vercel|\\.well-known/workflow|.*\\..*).*)'],
}
