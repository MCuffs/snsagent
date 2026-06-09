'use client'

import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, Mail, User } from 'lucide-react'

interface Props {
  locale: string
  defaultTab: 'login' | 'signup'
  loginAction: (formData: FormData) => Promise<void>
  registerAction: (formData: FormData) => Promise<void>
}

export default function LoginForm({ locale, defaultTab, loginAction, registerAction }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [showPw, setShowPw] = useState(false)
  const isEn = locale === 'en'

  return (
    <div>
      {/* 탭 */}
      <div className="mb-6 flex rounded-[6px] border border-[#e8dfd4] bg-[#f5f0ea] p-1">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`flex-1 rounded-[4px] py-2.5 text-sm font-bold transition ${
            tab === 'login' ? 'bg-white text-[#171714] shadow-sm' : 'text-[#7d756c] hover:text-[#171714]'
          }`}
        >
          {isEn ? 'Log in' : '로그인'}
        </button>
        <button
          type="button"
          onClick={() => setTab('signup')}
          className={`flex-1 rounded-[4px] py-2.5 text-sm font-bold transition ${
            tab === 'signup' ? 'bg-white text-[#171714] shadow-sm' : 'text-[#7d756c] hover:text-[#171714]'
          }`}
        >
          {isEn ? 'Sign up' : '신규 가입'}
        </button>
      </div>

      {tab === 'login' ? (
        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Email' : '이메일'}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746a62]" />
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder={isEn ? 'you@example.com' : 'example@email.com'}
                required
                className="field h-13 pl-11 pr-4"
              />
            </div>
          </div>
          <div>
            <label htmlFor="login-pw" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Password' : '비밀번호'}
            </label>
            <div className="relative">
              <input
                id="login-pw"
                name="password"
                type={showPw ? 'text' : 'password'}
                placeholder={isEn ? 'Your password' : '비밀번호 입력'}
                required
                className="field h-13 pl-4 pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a29a91] hover:text-[#171714]"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full rounded-[5px] text-base">
            {isEn ? 'Log in' : '로그인'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <form action={registerAction} className="space-y-4">
          <div>
            <label htmlFor="reg-name" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Name or brand' : '이름 또는 브랜드명'}
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746a62]" />
              <input
                id="reg-name"
                name="name"
                type="text"
                placeholder={isEn ? 'Your name or brand' : '이름 또는 브랜드명'}
                className="field h-13 pl-11 pr-4"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Email' : '이메일'}
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#746a62]" />
              <input
                id="reg-email"
                name="email"
                type="email"
                placeholder={isEn ? 'you@example.com' : 'example@email.com'}
                required
                className="field h-13 pl-11 pr-4"
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-pw" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Password' : '비밀번호'}
              <span className="ml-1.5 text-xs font-normal text-[#a29a91]">
                {isEn ? '8 characters minimum' : '8자 이상'}
              </span>
            </label>
            <div className="relative">
              <input
                id="reg-pw"
                name="password"
                type={showPw ? 'text' : 'password'}
                placeholder={isEn ? 'Create a password' : '비밀번호 설정 (8자 이상)'}
                minLength={8}
                required
                className="field h-13 pl-4 pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a29a91] hover:text-[#171714]"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full rounded-[5px] text-base">
            {isEn ? 'Create account' : '가입하기'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}
    </div>
  )
}
