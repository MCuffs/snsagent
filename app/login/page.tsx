'use server'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loginAction, getSessionUser } from '../actions'
import { Sparkles, ArrowRight, ShieldCheck, Mail } from 'lucide-react'

export default async function LoginPage() {
  // If already logged in, redirect to dashboard
  const user = await getSessionUser()
  if (user) {
    redirect('/dashboard')
  }

  // Handle form submission inside server component using inline server action
  async function handleSubmit(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const name = formData.get('name') as string
    
    const res = await loginAction(email, name)
    if (res.success) {
      redirect('/dashboard')
    }
  }

  async function handleDemoLogin() {
    'use server'
    const demoEmail = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || 'demo@instaagent.ai'
    const res = await loginAction(demoEmail, 'Insta Demo User')
    if (res.success) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#1e1e1e] flex flex-col justify-between overflow-hidden relative font-sans">
      
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white/50 z-10">
        <Link href="/" className="flex items-center gap-1.5 group">
          <span className="text-[#ff4f00] font-black text-xl tracking-tighter">_insta</span>
          <span className="font-extrabold text-xl tracking-tighter text-slate-800">agent</span>
        </Link>
        
        <Link href="/" className="text-xs font-bold text-slate-500 hover:text-black transition-colors">
          랜딩페이지로 돌아가기
        </Link>
      </header>

      {/* Login Box */}
      <div className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md p-8 rounded-xl border border-slate-200 bg-white shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-lg bg-[#ff4f00]/10 flex items-center justify-center mx-auto text-[#ff4f00]">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">InstaAgent 시작하기</h1>
            <p className="text-xs font-medium text-slate-500">인스타그램 운영을 대신해주는 AI 직원</p>
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                이메일 주소 *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-450" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                이름 / 브랜드명 (선택)
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="홍길동 마케팅"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#ff4f00] transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-sm font-extrabold bg-[#ff4f00] hover:bg-[#e04500] active:scale-[0.98] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <span>계정 생성 및 로그인</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6 text-[10px] text-slate-450 font-bold uppercase">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-3">또는 데모체험</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          {/* Quick Demo Login */}
          <form action={handleDemoLogin}>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg text-sm font-bold bg-slate-55 border border-slate-200 hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
            >
              <ShieldCheck className="w-5 h-5 text-[#ff4f00]" />
              <span>데모 계정으로 1초 만에 로그인</span>
            </button>
          </form>

          <p className="text-center text-[10px] text-slate-400 font-semibold leading-relaxed">
            별도의 카드 등록이나 번거로운 연동 과정 없이<br />
            모든 AI 기능을 즉시 체험할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-14 flex items-center justify-center text-xs text-slate-450 border-t border-slate-200/60 bg-white/30">
        © 2026 InstaAgent. All rights reserved.
      </footer>
    </div>
  )
}
