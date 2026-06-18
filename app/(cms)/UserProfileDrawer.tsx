'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Key, Copy, Check, RefreshCw, Trash2, X, User, Mail, CreditCard, ExternalLink, LogOut, AlertCircle } from 'lucide-react'

interface Props {
  userName: string | null
  userEmail: string
  userPlan: string
  createdAt: string
  hasSubscription: boolean
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  FREE:      { label: 'Free',      color: 'text-[#71717a] bg-[#f4f4f5]' },
  PRO:       { label: 'Creator',   color: 'text-[#7c3aed] bg-[#f5f3ff]' },
  UNLIMITED: { label: 'Studio',    color: 'text-[#059669] bg-[#ecfdf5]' },
}

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_USER_EMAIL || 'demo@shuffla.ai'

export function UserProfileDrawer({ userName, userEmail, userPlan, createdAt, hasSubscription }: Props) {
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [keyLoaded, setKeyLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const drawerRef = useRef<HTMLDivElement>(null)

  // 구독 취소 버튼 노출 조건: 구독 중이거나 데모 계정
  const showCancelBtn = hasSubscription || userEmail === DEMO_EMAIL

  useEffect(() => {
    if (!open || keyLoaded) return
    fetch('/api/mcp/key')
      .then(r => r.json())
      .then(d => {
        setKey(d.key ?? null)
        setHasKey(Boolean(d.hasKey || d.key))
      })
      .finally(() => setKeyLoaded(true))
  }, [open, keyLoaded])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const generate = async () => {
    setGenerating(true)
    const r = await fetch('/api/mcp/key', { method: 'POST' })
    const d = await r.json()
    setKey(d.key)
    setHasKey(Boolean(d.hasKey || d.key))
    setRevealed(true)
    setGenerating(false)
  }

  const revoke = async () => {
    if (!confirm('API 키를 삭제할까요? 연결된 MCP 클라이언트가 즉시 작동을 멈춥니다.')) return
    await fetch('/api/mcp/key', { method: 'DELETE' })
    setKey(null)
    setHasKey(false)
    setRevealed(false)
  }

  const copy = () => {
    if (!key) return
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cancelSubscription = async () => {
    if (!confirm('구독을 취소하면 즉시 이용권 없는 상태로 전환됩니다. 계속하시겠습니까?')) return
    setCanceling(true)
    setCancelError('')
    try {
      const res = await fetch('/api/polar/cancel', { method: 'POST' })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setCancelError(data.error || '구독 취소에 실패했습니다.')
      } else {
        window.location.reload()
      }
    } catch {
      setCancelError('네트워크 오류가 발생했습니다.')
    } finally {
      setCanceling(false)
    }
  }

  const plan = PLAN_LABELS[userPlan] ?? PLAN_LABELS.FREE
  const displayName = userName || userEmail
  const initials = (userName || userEmail).slice(0, 2).toUpperCase()
  const maskedKey = key ? `${key.slice(0, 12)}${'•'.repeat(20)}` : `shfl_${'•'.repeat(20)}`

  return (
    <>
      {/* 트리거 */}
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[#f0f0f0]"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[10px] font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#111111]">{displayName}</p>
          <p className="truncate text-[11px] text-[#71717a]">{userEmail}</p>
        </div>
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" />}

      {/* 드로어 */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 z-50 flex h-auto max-h-[90vh] w-[280px] flex-col overflow-y-auto rounded-tr-2xl border-r border-t border-[#e4e4e7] bg-white shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full pointer-events-none'
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#e4e4e7] px-4 py-3">
          <span className="text-sm font-bold text-[#111111]">내 계정</span>
          <button onClick={() => setOpen(false)} className="rounded p-1 text-[#71717a] hover:bg-[#f0f0f0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 프로필 */}
        <div className="border-b border-[#e4e4e7] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111111] text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#111111]">{displayName}</p>
              <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${plan.color}`}>
                {plan.label}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] text-[#71717a]">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{userEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#71717a]">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>가입일 {new Date(createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#71717a]">
              <CreditCard className="h-3.5 w-3.5 shrink-0" />
              <Link href="/billing" className="text-[#0066ff] hover:underline">플랜 변경 →</Link>
            </div>
          </div>

          {/* 구독 취소 */}
          {showCancelBtn && (
            <div className="mt-4">
              {cancelError && (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {cancelError}
                </div>
              )}
              <button
                onClick={cancelSubscription}
                disabled={canceling || !hasSubscription}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                {canceling ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {canceling ? '처리 중…' : '구독 취소하기'}
              </button>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#a1a1aa]">
                취소 즉시 유료 기능 이용이 중단됩니다.{' '}
                <a href="/ko/refund" target="_blank" className="underline hover:text-[#71717a]">환불 정책 보기</a>
              </p>
            </div>
          )}
        </div>

        {/* MCP API 키 */}
        <div className="px-4 py-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Key className="h-3.5 w-3.5 text-[#111111]" />
            <span className="text-[12px] font-bold text-[#111111]">MCP API 키</span>
          </div>

          {!keyLoaded ? (
            <div className="h-8 animate-pulse rounded-lg bg-[#f4f4f5]" />
          ) : hasKey ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] bg-[#fafafa] px-3 py-2">
                <code className="flex-1 truncate font-mono text-[11px] text-[#52525b]">
                  {revealed ? key : maskedKey}
                </code>
                {key && (
                  <>
                    <button
                      onClick={() => setRevealed(v => !v)}
                      className="shrink-0 text-[10px] font-medium text-[#71717a] hover:text-[#111111]"
                    >
                      {revealed ? '숨기기' : '보기'}
                    </button>
                    <button onClick={copy} className="shrink-0 rounded p-0.5 text-[#71717a] hover:text-[#111111]">
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-[#71717a]">
                {key ? '지금 복사해 주세요. 이 키는 다시 표시되지 않습니다.' : '활성 키가 있습니다. 새 키가 필요하면 재발급해 주세요.'}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={generate}
                  disabled={generating}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#e4e4e7] py-1.5 text-[11px] font-medium text-[#52525b] hover:bg-[#f4f4f5] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                  재발급
                </button>
                <button
                  onClick={revoke}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-100 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] leading-relaxed text-[#71717a]">
                Claude, Cursor 등 MCP 클라이언트에서 Shuffla를 사용하려면 API 키가 필요합니다.
              </p>
              <button
                onClick={generate}
                disabled={generating}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111111] py-2 text-[12px] font-bold text-white hover:bg-[#333] disabled:opacity-50"
              >
                <Key className="h-3.5 w-3.5" />
                {generating ? '발급 중…' : 'API 키 발급받기'}
              </button>
            </div>
          )}

          <a
            href="/ko/mcp"
            target="_blank"
            className="mt-3 flex items-center gap-1 text-[11px] text-[#0066ff] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            MCP 연동 가이드 보기
          </a>
        </div>

        {/* 로그아웃 */}
        <div className="border-t border-[#e4e4e7] px-4 py-3">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#111111] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
