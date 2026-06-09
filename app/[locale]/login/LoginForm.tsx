'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Check, Eye, EyeOff, Mail, User, X } from 'lucide-react'

interface Props {
  locale: string
  defaultTab: 'login' | 'signup'
  loginAction: (formData: FormData) => Promise<void>
  registerAction: (formData: FormData) => Promise<void>
}

function strengthScore(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0–5
}

function StrengthBar({ pw, isEn }: { pw: string; isEn: boolean }) {
  const score = strengthScore(pw)
  const labels = isEn
    ? ['', 'Weak', 'Weak', 'Fair', 'Strong', 'Very strong']
    : ['', '매우 약함', '약함', '보통', '강함', '매우 강함']
  const colors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500']
  if (!pw) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-[#e8dfd4]'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${score >= 4 ? 'text-emerald-600' : score >= 3 ? 'text-yellow-600' : 'text-red-500'}`}>
        {labels[score]}
      </p>
    </div>
  )
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs transition-colors ${ok ? 'text-emerald-600' : 'text-[#a29a91]'}`}>
      {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </li>
  )
}

export default function LoginForm({ locale, defaultTab, loginAction, registerAction }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [clientError, setClientError] = useState('')
  const [isPending, startTransition] = useTransition()
  const isEn = locale === 'en'

  const pwRules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
  }
  const pwValid = pwRules.length && pwRules.upper && pwRules.number
  const confirmMatch = pw === confirm && confirm.length > 0

  function handleRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setClientError('')
    if (!pwValid) {
      setClientError(isEn ? 'Password does not meet the requirements.' : '비밀번호 조건을 확인해 주세요.')
      return
    }
    if (!confirmMatch) {
      setClientError(isEn ? 'Passwords do not match.' : '비밀번호가 일치하지 않습니다.')
      return
    }
    const formData = new FormData(e.currentTarget)
    startTransition(() => { void registerAction(formData) })
  }

  function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setClientError('')
    const formData = new FormData(e.currentTarget)
    startTransition(() => { void loginAction(formData) })
  }

  return (
    <div>
      {/* 탭 */}
      <div className="mb-6 flex rounded-[6px] border border-[#e8dfd4] bg-[#f5f0ea] p-1">
        <button
          type="button"
          onClick={() => { setTab('login'); setClientError('') }}
          className={`flex-1 rounded-[4px] py-2.5 text-sm font-bold transition ${
            tab === 'login' ? 'bg-white text-[#171714] shadow-sm' : 'text-[#7d756c] hover:text-[#171714]'
          }`}
        >
          {isEn ? 'Log in' : '로그인'}
        </button>
        <button
          type="button"
          onClick={() => { setTab('signup'); setClientError('') }}
          className={`flex-1 rounded-[4px] py-2.5 text-sm font-bold transition ${
            tab === 'signup' ? 'bg-white text-[#171714] shadow-sm' : 'text-[#7d756c] hover:text-[#171714]'
          }`}
        >
          {isEn ? 'Sign up' : '신규 가입'}
        </button>
      </div>

      {clientError && (
        <div className="mb-4 rounded-[5px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {clientError}
        </div>
      )}

      {tab === 'login' ? (
        <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                autoComplete="email"
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
                autoComplete="current-password"
                placeholder={isEn ? 'Your password' : '비밀번호 입력'}
                required
                className="field h-13 pl-4 pr-11"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a29a91] hover:text-[#171714]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isPending}
            className="btn-primary w-full rounded-[5px] text-base disabled:opacity-60">
            {isPending ? (isEn ? 'Logging in…' : '로그인 중…') : (isEn ? 'Log in' : '로그인')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          {/* 이름 */}
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
                autoComplete="name"
                placeholder={isEn ? 'Your name or brand' : '이름 또는 브랜드명'}
                className="field h-13 pl-11 pr-4"
              />
            </div>
          </div>

          {/* 이메일 */}
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
                autoComplete="email"
                placeholder={isEn ? 'you@example.com' : 'example@email.com'}
                required
                className="field h-13 pl-11 pr-4"
              />
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label htmlFor="reg-pw" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Password' : '비밀번호'}
            </label>
            <div className="relative">
              <input
                id="reg-pw"
                name="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={isEn ? 'Create a password' : '비밀번호 설정'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                required
                className="field h-13 pl-4 pr-11"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a29a91] hover:text-[#171714]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pw && <StrengthBar pw={pw} isEn={isEn} />}
            {pw && (
              <ul className="mt-2 space-y-1 pl-0.5">
                <Rule ok={pwRules.length} label={isEn ? 'At least 8 characters' : '8자 이상'} />
                <Rule ok={pwRules.upper} label={isEn ? 'At least one uppercase letter' : '영문 대문자 1개 이상'} />
                <Rule ok={pwRules.number} label={isEn ? 'At least one number' : '숫자 1개 이상'} />
              </ul>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label htmlFor="reg-pw-confirm" className="mb-1.5 block text-sm font-black">
              {isEn ? 'Confirm password' : '비밀번호 확인'}
            </label>
            <div className="relative">
              <input
                id="reg-pw-confirm"
                name="passwordConfirm"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={isEn ? 'Repeat your password' : '비밀번호 다시 입력'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className={`field h-13 pl-4 pr-11 transition-colors ${
                  confirm ? (confirmMatch ? 'border-emerald-400 focus:border-emerald-500' : 'border-red-300 focus:border-red-400') : ''
                }`}
              />
              <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a29a91] hover:text-[#171714]">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm && (
              <p className={`mt-1.5 text-xs font-medium ${confirmMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                {confirmMatch
                  ? (isEn ? '✓ Passwords match' : '✓ 비밀번호가 일치합니다')
                  : (isEn ? 'Passwords do not match' : '비밀번호가 일치하지 않습니다')}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !pwValid || !confirmMatch}
            className="btn-primary w-full rounded-[5px] text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (isEn ? 'Creating account…' : '가입 처리 중…') : (isEn ? 'Create account' : '가입하기')}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      )}
    </div>
  )
}
