import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { CreditCard, LogOut } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { getSessionUser, getCachedBrands } from '../../lib/auth/user'
import { TabProvider } from './TabContext'
import SidebarNav from './SidebarNav'
import ThinkingDataProvider from '../components/ThinkingDataProvider'

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await getCachedBrands(user.id)
  const hasCompleteBrand = brands.length > 0 && Boolean(brands[0].websiteUrl)
  const t = await getTranslations('cms_layout')
  const tCms = await getTranslations('cms')

  return (
    <TabProvider>
      <ThinkingDataProvider
        userId={user.id}
        userEmail={user.email ?? undefined}
        userPlan={user.plan ?? 'FREE'}
        userName={user.name ?? undefined}
      />
      <div className="flex h-screen overflow-hidden bg-white text-[#111111]">
        {/* Sidebar */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e4e4e7] bg-[#fafafa] lg:flex">
          {/* Logo */}
          <div className="flex h-[60px] items-center border-b border-[#e4e4e7] px-5">
            <Link href="/concept" className="flex items-center gap-2.5">
              <Image src="/shuffla-logo-mark.png" width={27} height={27} alt={t('logo_alt')} />
              <span className="text-[15px] font-bold tracking-tight text-[#111111]">Shuffla</span>
            </Link>
          </div>

          {/* Nav */}
          <SidebarNav hasCompleteBrand={hasCompleteBrand} />

        {/* User + Plan */}
        <div className="border-t border-[#e4e4e7] p-3 space-y-1.5">
          <Link
            href="/billing"
            className="flex items-center justify-between rounded-md px-3 py-2 text-xs text-[#71717a] hover:bg-[#f0f0f0] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="font-medium uppercase tracking-wide">{user.plan}</span>
            </span>
            <span className="text-[#0066ff] font-semibold">{t('plan_link')}</span>
          </Link>

          <div className="flex items-center justify-between rounded-md px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[#111111]">{user.name || user.email}</p>
              <p className="truncate text-[11px] text-[#71717a]">{user.email}</p>
            </div>
            <form
              action={async () => {
                'use server'
                const { logoutAction } = await import('../actions')
                await logoutAction()
                const { redirect: serverRedirect } = await import('next/navigation')
                serverRedirect('/login')
              }}
            >
              <button type="submit" className="ml-2 rounded p-1 text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors" title={tCms('logout')}>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
          <p className="px-3 pb-1 text-[10px] text-[#d4d4d8]">CMS v2 · a8f0d32</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  </TabProvider>
  )
}
