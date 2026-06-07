import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { CreditCard, LogOut } from 'lucide-react'
import { getSessionUser, getCachedBrands } from '../../../lib/auth/user'
import { TabProvider } from '../../(cms)/TabContext'
import SidebarNav from '../../(cms)/SidebarNav'
import ThinkingDataProvider from '../../components/ThinkingDataProvider'
import LocaleSwitcher from '../../components/LocaleSwitcher'
import { getTranslations } from 'next-intl/server'
import MobileHeader from '../../(cms)/MobileHeader'

export default async function CmsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login`)

  const t = await getTranslations('cms')
  const brands = await getCachedBrands(user.id)
  const hasCompleteBrand = brands.length > 0 && Boolean(brands[0].websiteUrl)

  return (
    <TabProvider>
      <ThinkingDataProvider
        userId={user.id}
        userEmail={user.email ?? undefined}
        userPlan={user.plan ?? 'FREE'}
        userName={user.name ?? undefined}
        locale={locale}
      />
      <div className="flex h-screen overflow-hidden bg-white text-[#111111]">
        {/* Sidebar */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e4e4e7] bg-[#fafafa] lg:flex">
          {/* Logo */}
          <div className="flex h-[60px] items-center border-b border-[#e4e4e7] px-5">
            <Link href={`/${locale}/concept`} className="flex items-center gap-2.5">
              <Image src="/shuffla-logo-mark.png" width={27} height={27} alt="Shuffla 로고" />
              <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
            </Link>
          </div>

          {/* Nav */}
          <SidebarNav hasCompleteBrand={hasCompleteBrand} userEmail={user.email} locale={locale} />

          {/* User + Plan */}
          <div className="border-t border-[#e4e4e7] p-3 space-y-1.5">
            <Link
              href={`/${locale}/billing`}
              className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#71717a] hover:bg-[#f0f0f0] transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="font-medium uppercase tracking-wide">{user.plan}</span>
              </span>
              <span className="text-[#0066ff] font-semibold">{t('plan_label')}</span>
            </Link>

            <div className="flex items-center justify-between rounded-md px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#111111]">{user.name || user.email}</p>
                <p className="truncate text-[11px] text-[#71717a]">{user.email}</p>
              </div>
              <form
                action={async () => {
                  'use server'
                  const { logoutAction } = await import('../../actions')
                  await logoutAction()
                  const { redirect: serverRedirect } = await import('next/navigation')
                  serverRedirect(`/${locale}/login`)
                }}
              >
                <button type="submit" className="ml-2 rounded p-1 text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors" title={t('logout')}>
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>

            <div className="px-3 pb-1 flex items-center justify-between">
              <p className="text-[10px] text-[#d4d4d8]">CMS v2 · a8f0d32</p>
              <LocaleSwitcher />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Mobile Header Drawer */}
          <MobileHeader locale={locale}>
            <div className="flex flex-col h-full justify-between pb-4">
              <SidebarNav hasCompleteBrand={hasCompleteBrand} userEmail={user.email} locale={locale} />
              
              <div className="border-t border-[#e4e4e7] p-3 space-y-1.5 mt-auto">
                <Link
                  href={`/${locale}/billing`}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#71717a] hover:bg-[#f0f0f0] transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-wide">{user.plan}</span>
                  </span>
                  <span className="text-[#0066ff] font-semibold">{t('plan_label')}</span>
                </Link>

                <div className="flex items-center justify-between rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[#111111]">{user.name || user.email}</p>
                    <p className="truncate text-[11px] text-[#71717a]">{user.email}</p>
                  </div>
                  <form
                    action={async () => {
                      'use server'
                      const { logoutAction } = await import('../../actions')
                      await logoutAction()
                      const { redirect: serverRedirect } = await import('next/navigation')
                      serverRedirect(`/${locale}/login`)
                    }}
                  >
                    <button type="submit" className="ml-2 rounded p-1 text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors" title={t('logout')}>
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>

                <div className="px-3 pb-1 flex items-center justify-between">
                  <p className="text-[10px] text-[#d4d4d8]">CMS v2 · a8f0d32</p>
                  <LocaleSwitcher />
                </div>
              </div>
            </div>
          </MobileHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </TabProvider>
  )
}
