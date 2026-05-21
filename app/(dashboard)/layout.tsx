import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '../actions'
import { 
  Home, 
  Sparkles, 
  Calendar, 
  CreditCard, 
  Briefcase, 
  LogOut 
} from 'lucide-react'
import InstagramIcon from '../components/InstagramIcon'
import { dbService } from '../../lib/db-service'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  
  // Guard clause: redirect to login if no session user found
  if (!user) {
    redirect('/login')
  }

  // Fetch brands to display brand status
  const brands = await dbService.getBrands(user.id)
  const activeBrandName = brands.length > 0 ? brands[0].name : '등록된 브랜드 없음'

  return (
    <div className="flex h-screen bg-[#fcfbfa] text-[#1e1e1e] font-sans antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col justify-between flex-shrink-0 z-10">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-200">
            <Link href="/dashboard" className="flex items-center gap-1 group">
              <span className="text-[#ff4f00] font-black text-lg tracking-tighter">_insta</span>
              <span className="font-extrabold text-lg tracking-tighter text-slate-800">agent</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-bold ml-1.5">MVP</span>
            </Link>
          </div>

          {/* User profile brief */}
          <div className="p-4 mx-3 my-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#ff4f00]/10 flex items-center justify-center text-[#ff4f00] font-black text-sm">
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] text-slate-400 font-bold leading-none mb-1">AI 직원의 브랜드</p>
              <p className="text-xs font-bold truncate text-slate-800">{activeBrandName}</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="px-3 space-y-1">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition-all"
            >
              <Home className="w-4 h-4 text-slate-400 group-hover:text-black" />
              <span>대시보드</span>
            </Link>

            <Link 
              href="/brand" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition-all"
            >
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span>브랜드 설정</span>
            </Link>

            <Link 
              href="/instagram" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition-all"
            >
              <InstagramIcon className="w-4 h-4 text-slate-400" />
              <span>인스타그램 연동</span>
            </Link>

            <Link 
              href="/campaign/new" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-extrabold text-white bg-[#ff4f00] hover:bg-[#e04500] shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>새 카드뉴스 캠페인</span>
            </Link>

            <Link 
              href="/calendar" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition-all"
            >
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>콘텐츠 캘린더</span>
            </Link>

            <Link 
              href="/pricing" 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-black hover:bg-slate-50 transition-all"
            >
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span>요금제 & 멤버십</span>
            </Link>
          </nav>
        </div>

        {/* Footer Area with Sign Out */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex flex-col overflow-hidden max-w-[90%]">
              <span className="text-[10px] font-bold text-slate-800 truncate">{user.email}</span>
              <span className="text-[9px] font-black text-[#ff4f00] tracking-wider uppercase mt-0.5">{user.plan} PLAN</span>
            </div>
          </div>
          <form action={async () => {
            'use server'
            const { logoutAction } = await import('../actions')
            await logoutAction()
            const { redirect } = await import('next/navigation')
            redirect('/login')
          }}>
            <button 
              type="submit" 
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-650 text-slate-500 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Header Bar */}
        <header className="h-16 border-b border-slate-200/80 flex items-center justify-between px-8 bg-white/50 backdrop-blur-md flex-shrink-0">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">InstaAgent AI Operations Desk</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50/50 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold text-emerald-700">AI 직원이 상시 대기중</span>
            </div>
          </div>
        </header>

        {/* Scrollable Sub-pages Container */}
        <div className="flex-1 overflow-y-auto bg-[#fcfbfa]">
          {children}
        </div>
      </main>
    </div>
  )
}
