'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  analytics,
  getAnonymousId,
  identifyUser,
  initThinkingData,
  setSuperProperties,
  unsetSuperProperty,
} from '../../lib/analytics/thinkingdata'

interface ThinkingDataProviderProps {
  userId?: string
  userEmail?: string
  userPlan?: string
  userName?: string
  locale?: string
  trackPageViews?: boolean
}

let lastTrackedPageKey: string | null = null

function getPathLocale(pathname: string, explicitLocale?: string) {
  if (explicitLocale) return explicitLocale
  const segment = pathname.split('/').filter(Boolean)[0]
  return segment === 'ko' || segment === 'en' ? segment : 'ko'
}

function stripLocale(pathname: string) {
  return pathname.replace(/^\/(ko|en)(?=\/|$)/, '') || '/'
}

function isProtectedPath(pathname: string) {
  const normalized = stripLocale(pathname)
  return [
    '/billing',
    '/campaign',
    '/concept',
    '/generate',
    '/instagram',
    '/painter',
    '/works',
  ].some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
}

function getPageName(pathname: string) {
  const normalized = stripLocale(pathname)

  if (normalized === '/') return 'home'
  if (normalized === '/pricing') return 'pricing'
  if (normalized === '/blog') return 'blog'
  if (normalized.startsWith('/blog/')) return 'blog_post'
  if (normalized === '/login') return 'login'
  if (normalized === '/privacy') return 'privacy'
  if (normalized === '/terms') return 'terms'
  if (normalized === '/concept') return 'concept'
  if (normalized === '/generate') return 'generate'
  if (normalized === '/works') return 'works'
  if (normalized === '/billing') return 'billing'
  if (normalized.startsWith('/campaign/')) return 'campaign'

  return normalized.split('/').filter(Boolean)[0] || 'unknown'
}

export default function ThinkingDataProvider({
  userId,
  userEmail,
  userPlan,
  userName,
  locale,
  trackPageViews = true,
}: ThinkingDataProviderProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  useEffect(() => {
    initThinkingData().then(() => {
      if (userId) {
        identifyUser(userId, {
          email: userEmail,
          plan: userPlan,
          name: userName,
        })
        setSuperProperties({
          is_authenticated: true,
          user_status: 'authenticated',
          user_id: userId,
          plan: userPlan ?? 'FREE',
        })
      } else {
        unsetSuperProperty('user_id')
        setSuperProperties({
          is_authenticated: false,
          user_status: 'anonymous',
          plan: 'ANONYMOUS',
        })
      }
    })
  }, [userId, userEmail, userPlan, userName])

  useEffect(() => {
    if (!trackPageViews || !pathname) return
    if (!userId && isProtectedPath(pathname)) return

    const pageKey = `${pathname}?${search}`
    if (lastTrackedPageKey === pageKey) return
    lastTrackedPageKey = pageKey

    initThinkingData().then(() => {
      const url = `${window.location.pathname}${window.location.search}`
      const pageLocale = getPathLocale(pathname, locale)
      const anonymousId = getAnonymousId()

      analytics.pageView(getPageName(pathname), {
        path: pathname,
        search,
        url,
        full_url: window.location.href,
        title: document.title,
        referrer: document.referrer || undefined,
        locale: pageLocale,
        is_authenticated: Boolean(userId),
        user_status: userId ? 'authenticated' : 'anonymous',
        user_id: userId,
        anonymous_id: userId ? undefined : anonymousId,
        plan: userId ? userPlan ?? 'FREE' : 'ANONYMOUS',
      })
    })
  }, [locale, pathname, search, trackPageViews, userId, userPlan])

  return null
}
