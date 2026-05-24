import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Briefcase,
  CreditCard,
  Home,
  LogOut,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { getSessionUser } from '../actions'
import { dbService } from '../../lib/db-service'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: Home },
  { href: '/brand', label: '브랜드', icon: Briefcase },
  { href: '/campaign/new', label: '카드 만들기', icon: Sparkles, primary: true },
  { href: '/instagram', label: 'SNS 자동 업로드', icon: UploadCloud },
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
  const hasBrand = brands.length > 0
  const activeBrandName = brands[0]?.name || '브랜드 미설정'

  return (
    <div className="app-shell flex h-screen overflow-hidden text-[#1f1512]">
      <aside className="hidden w-72 shrink-0 border-r border-[#e8dfd4] bg-[#fffdf8]/92 backdrop-blur-xl lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center border-b border-[#e8dfd4] px-6">
          <Link href="/" className="flex items-center gap-2" title="메인으로 이동">
            <span className="h-1.5 w-7 rounded-full bg-[#ff4f0a]" />
            <span className="text-xl font-black tracking-[-0.05em] text-[#1f1512]">Shuffla</span>
            <span className="rounded-full border border-[#e8dfd4] px-2 py-0.5 text-[10px] font-bold text-[#746a62]">
              Studio
            </span>
          </Link>
        </div>

        <div className="px-4 py-5">
          <div className="rounded-[8px] border border-[#e8dfd4] bg-white p-4 shadow-[0_14px_40px_rgba(31,21,18,0.05)]">
            <p className="eyebrow">{hasBrand ? 'Active Brand' : 'Setup Required'}</p>
            <p className="mt-2 truncate text-sm font-bold text-neutral-950">
              {hasBrand ? activeBrandName : '브랜드 사이트 분석부터 시작하세요'}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#6f6a61]">
              {hasBrand ? user.email : 'URL을 입력해 브랜드 프로필을 저장하면 CMS 메뉴가 열립니다.'}
            </p>
          </div>
        </div>

        {hasBrand ? (
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
        ) : (
          <nav className="flex-1 px-3">
            <Link
              href="/brand"
              className="flex items-center gap-3 rounded-full bg-[#1f1512] px-4 py-3 text-sm font-black text-white"
            >
              <ArrowRight className="h-4 w-4" />
              <span>브랜드 URL 입력</span>
            </Link>
          </nav>
        )}

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
          <Link href={hasBrand ? '/dashboard' : '/brand'} className="font-black tracking-tight text-[#1f1512] lg:hidden">
            Shuffla
          </Link>
          <div className="hidden lg:block">
            <p className="eyebrow">{hasBrand ? 'Card News Studio' : 'Brand Onboarding'}</p>
          </div>
          <div className="status-pill">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            {hasBrand ? '다운로드 중심 모드' : '브랜드 설정 필요'}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
