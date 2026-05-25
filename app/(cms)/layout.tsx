import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, CreditCard, Grid3X3, LogOut, Zap } from 'lucide-react'
import { getSessionUser } from '../actions'
import { dbService } from '../../lib/db-service'

const navItems = [
  { href: '/concept', label: 'Concept', icon: BookOpen, desc: '브랜드 프로필' },
  { href: '/generate', label: 'Generate', icon: Zap, desc: '카드뉴스 생성' },
  { href: '/works', label: 'Works', icon: Grid3X3, desc: '작업 히스토리' },
]

export default async function CmsLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  const hasCompleteBrand = brands.length > 0 && Boolean(brands[0].websiteUrl)

  return (
    <div className="flex h-screen overflow-hidden bg-white text-[#111111]">
      {/* Sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[#e4e4e7] bg-[#fafafa] lg:flex">
        {/* Logo */}
        <div className="flex h-[60px] items-center border-b border-[#e4e4e7] px-5">
          <Link href="/concept" className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#111111]">
              <span className="h-1.5 w-3 rounded-full bg-white" />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-[#111111]">Typova</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const disabled = !hasCompleteBrand && item.href !== '/concept'
            if (disabled) {
              return (
                <span
                  key={item.href}
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm opacity-30"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium leading-none">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-[#71717a]">{item.desc}</p>
                  </div>
                </span>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#52525b] transition-colors hover:bg-[#f0f0f0] hover:text-[#111111]"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium leading-none">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-[#71717a]">{item.desc}</p>
                </div>
              </Link>
            )
          })}
        </nav>

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
            <span className="text-[#0066ff] font-semibold">요금제 →</span>
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
              <button type="submit" className="ml-2 rounded p-1 text-[#71717a] hover:bg-[#e4e4e7] hover:text-[#111111] transition-colors" title="로그아웃">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
