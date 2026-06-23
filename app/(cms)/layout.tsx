import Link from 'next/link'
import Image from 'next/image'
import { CreditCard, LogIn } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedBrands } from '../../lib/auth/user'
import { TabProvider } from './TabContext'
import SidebarNav from './SidebarNav'
import ThinkingDataProvider from '../components/ThinkingDataProvider'
import MobileHeader from './MobileHeader'
import { UserProfileDrawer } from './UserProfileDrawer'

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  const brands = user ? await getCachedBrands(user.id) : []
  const hasCompleteBrand = brands.length > 0 && Boolean(brands[0].websiteUrl)
  const hasSubscription = Boolean(user?.polarSubscriptionId && user.polarSubscriptionStatus === 'active')
  const t = await getTranslations('cms_layout')

  return (
    <TabProvider>
      <ThinkingDataProvider
        userId={user?.id}
        userEmail={user?.email ?? undefined}
        userPlan={user?.plan ?? undefined}
        userName={user?.name ?? undefined}
      />
      <div className="flex h-screen overflow-hidden bg-[#f9fafb] text-[#111111]">
        {/* Sidebar */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e5e7eb] bg-white lg:flex">
          {/* Logo */}
          <div className="flex h-[60px] items-center border-b border-[#e5e7eb] px-5">
            <Link href="/concept" className="flex items-center gap-2.5">
              <Image src="/shuffla-logo-mark.png" width={27} height={27} alt={t('logo_alt')} />
              <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
            </Link>
          </div>

          {/* Nav */}
          <SidebarNav hasCompleteBrand={hasCompleteBrand} />

        {/* User + Plan */}
        <div className="border-t border-[#e5e7eb] p-3 space-y-1.5">
          {user ? (
            <>
              <Link
                href="/billing"
                className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="font-medium uppercase tracking-wide">{user.plan}</span>
                </span>
                <span className="text-[#3b82f6] font-semibold">{t('plan_link')}</span>
              </Link>

              <UserProfileDrawer
                userName={user.name ?? null}
                userEmail={user.email}
                userPlan={user.plan}
                createdAt={user.createdAt.toISOString()}
                hasSubscription={hasSubscription}
              />
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#3b82f6] hover:bg-[#eff6ff] transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              로그인
            </Link>
          )}
          <p className="px-3 pb-1 text-[10px] text-[#d1d5db]">CMS v2 · a8f0d32</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile Header Drawer */}
        <MobileHeader>
          <div className="flex flex-col h-full justify-between pb-4">
            <SidebarNav hasCompleteBrand={hasCompleteBrand} />

            <div className="border-t border-[#e5e7eb] p-3 space-y-1.5 mt-auto">
              {user ? (
                <>
                  <Link
                    href="/billing"
                    className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span className="font-medium uppercase tracking-wide">{user.plan}</span>
                    </span>
                    <span className="text-[#3b82f6] font-semibold">{t('plan_link')}</span>
                  </Link>

                  <UserProfileDrawer
                    userName={user.name ?? null}
                    userEmail={user.email}
                    userPlan={user.plan}
                    createdAt={user.createdAt.toISOString()}
                    hasSubscription={hasSubscription}
                  />
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#3b82f6] hover:bg-[#eff6ff] transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  로그인
                </Link>
              )}
              <p className="px-3 pb-1 text-[10px] text-[#d1d5db]">CMS v2 · a8f0d32</p>
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
