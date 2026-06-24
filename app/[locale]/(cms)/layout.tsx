import Link from 'next/link'
import Image from 'next/image'
import { CreditCard, LogIn } from 'lucide-react'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import { TabProvider } from '../../(cms)/TabContext'
import SidebarNav from '../../(cms)/SidebarNav'
import ThinkingDataProvider from '../../components/ThinkingDataProvider'
import LocaleSwitcher from '../../components/LocaleSwitcher'
import { getTranslations } from 'next-intl/server'
import MobileHeader from '../../(cms)/MobileHeader'
import { UserProfileDrawer } from '../../(cms)/UserProfileDrawer'
import { SidebarUsageWidget } from '../../(cms)/SidebarUsageWidget'
import { isAdminEmail } from '../../../lib/auth/admin-emails'
import { getUsageSummaryForUser } from '../../../lib/usage-summary'
import { normalizePlan } from '../../../lib/limits-types'

export default async function CmsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getSessionUser()

  const t = await getTranslations('cms')
  const brands = user ? await getCachedBrands(user.id) : []
  const hasCompleteBrand = brands.length > 0 && Boolean(brands[0].websiteUrl)
  const hasSubscription = Boolean(user?.polarSubscriptionId && user.polarSubscriptionStatus === 'active')
  const isAdminUser = isAdminEmail(user?.email)
  const planLabel = isAdminUser ? 'ADMIN' : user?.plan
  const navAccessPlan = isAdminUser ? 'ADMIN' : user ? normalizePlan(user.plan || 'FREE') : null
  const usageSummary = user ? await getUsageSummaryForUser(user) : null

  return (
    <TabProvider>
      <ThinkingDataProvider
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        userPlan={user?.plan ?? undefined}
        userName={user?.name ?? undefined}
        locale={locale}
      />
      <div className="flex h-screen overflow-hidden bg-[#f9fafb] text-[#111111]">
        {/* Sidebar */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e5e7eb] bg-white lg:flex">
          {/* Logo */}
          <div className="flex h-[60px] items-center border-b border-[#e5e7eb] px-5">
            <Link href={`/${locale}/concept`} className="flex items-center gap-2.5">
              <Image src="/shuffla-logo-mark.png" width={27} height={27} alt="Shuffla logo" />
              <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
            </Link>
          </div>

          {/* Nav */}
          <SidebarNav hasCompleteBrand={hasCompleteBrand} locale={locale} userPlan={navAccessPlan} />

          {/* User + Plan */}
          <div className="border-t border-[#e5e7eb] p-3 space-y-1.5">
            {user ? (
              <>
                <Link
                  href={`/${locale}/billing`}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-wide">{planLabel}</span>
                  </span>
                  <span className="text-[#3b82f6] font-semibold">{t('plan_label')}</span>
                </Link>

                <SidebarUsageWidget initialData={usageSummary} />

                <UserProfileDrawer
                  userName={user.name ?? null}
                  userEmail={user.email}
                  userPlan={planLabel ?? user.plan}
                  createdAt={user.createdAt.toISOString()}
                  hasSubscription={hasSubscription}
                />
              </>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#3b82f6] hover:bg-[#eff6ff] transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                {locale === 'en' ? 'Log in' : '로그인'}
              </Link>
            )}

            <div className="px-3 pb-1 flex items-center justify-between">
              <p className="text-[10px] text-[#d1d5db]">CMS v2 · a8f0d32</p>
              <LocaleSwitcher />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile Header Drawer */}
          <MobileHeader locale={locale}>
            <div className="flex flex-col h-full justify-between pb-4">
              <SidebarNav hasCompleteBrand={hasCompleteBrand} locale={locale} userPlan={navAccessPlan} />

              <div className="border-t border-[#e5e7eb] p-3 space-y-1.5 mt-auto">
                {user ? (
                  <>
                    <Link
                      href={`/${locale}/billing`}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span className="font-medium uppercase tracking-wide">{planLabel}</span>
                      </span>
                      <span className="text-[#3b82f6] font-semibold">{t('plan_label')}</span>
                    </Link>

                    <SidebarUsageWidget initialData={usageSummary} />

                    <UserProfileDrawer
                      userName={user.name ?? null}
                      userEmail={user.email}
                      userPlan={planLabel ?? user.plan}
                      createdAt={user.createdAt.toISOString()}
                      hasSubscription={hasSubscription}
                    />
                  </>
                ) : (
                  <Link
                    href={`/${locale}/login`}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#3b82f6] hover:bg-[#eff6ff] transition-colors"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {locale === 'en' ? 'Log in' : '로그인'}
                  </Link>
                )}

                <div className="px-3 pb-1 flex items-center justify-between">
                  <p className="text-[10px] text-[#d1d5db]">CMS v2 · a8f0d32</p>
                  <LocaleSwitcher />
                </div>
              </div>
            </div>
          </MobileHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f9fafb]">
            {children}
          </div>
        </main>
      </div>
    </TabProvider>
  )
}
