import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Briefcase,
  Calendar,
  CreditCard,
  Home,
  LogOut,
  Sparkles,
} from 'lucide-react'
import { getSessionUser } from '../actions'
import InstagramIcon from '../components/InstagramIcon'
import { dbService } from '../../lib/db-service'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: Home },
  { href: '/brand', label: '브랜드', icon: Briefcase },
  { href: '/instagram', label: '인스타그램', icon: InstagramIcon },
  { href: '/campaign/new', label: '새 캠페인', icon: Sparkles, primary: true },
  { href: '/calendar', label: '캘린더', icon: Calendar },
  { href: '/pricing', label: '요금제', icon: CreditCard },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const brands = await dbService.getBrands(user.id)
  const activeBrandName = brands[0]?.name || '브랜드 미설정'

  return (
    <div className="app-shell flex h-screen overflow-hidden text-[#1f1512]">
      <aside className="hidden w-72 shrink-0 border-r border-[#e8dfd4] bg-[#fffdf8]/92 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center border-b border-[#e8dfd4] px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="h-1.5 w-7 rounded-full bg-[#ff4f0a]" />
            <span className="text-xl font-black tracking-[-0.05em] text-[#1f1512]">InstaAgent</span>
            <span className="rounded-full border border-[#e8dfd4] px-2 py-0.5 text-[10px] font-bold text-[#746a62]">
              MVP
            </span>
          </Link>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-[8px] border border-[#e8dfd4] bg-white p-4 shadow-[0_14px_40px_rgba(31,21,18,0.05)]">
            <p className="eyebrow">Active Brand</p>
            <p className="mt-2 truncate text-sm font-bold text-neutral-950">{activeBrandName}</p>
            <p className="mt-1 truncate text-xs text-[#6f6a61]">{user.email}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.primary
                    ? 'mt-3 flex items-center gap-3 rounded-full bg-[#1f1512] px-4 py-3 text-sm font-black text-white transition hover:bg-[#352521]'
                    : 'flex items-center gap-3 rounded-full px-4 py-3 text-sm font-black text-[#5d584f] transition hover:bg-white hover:text-[#1f1512]'
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-[#e8dfd4] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-neutral-950">{user.name || 'Demo User'}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#b94718]">
                {user.plan} plan
              </p>
            </div>
          </div>
          <form
            action={async () => {
              'use server'
              const { logoutAction } = await import('../actions')
              await logoutAction()
              const { redirect } = await import('next/navigation')
              redirect('/login')
            }}
          >
            <button
              type="submit"
              className="btn-secondary min-h-10 w-full text-xs"
            >
              <LogOut className="h-4 w-4" />
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#e8dfd4] bg-[#fffdf8]/86 px-5 backdrop-blur-xl md:px-8">
          <Link href="/dashboard" className="font-black tracking-tight text-[#1f1512] lg:hidden">
            InstaAgent
          </Link>
          <div className="hidden lg:block">
            <p className="eyebrow">AI Operations Desk</p>
          </div>
          <div className="status-pill">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            데모 환경 실행 중
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
