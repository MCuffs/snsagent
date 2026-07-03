'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { BarChart2, CreditCard, LayoutDashboard, LayoutTemplate, Smartphone, Users, Zap } from 'lucide-react'

const navItems = [
  { href: '/admin/youtube-shorts-templates', label: 'YouTube Shorts 템플릿', icon: Smartphone },
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: '사용자', icon: Users },
  { href: '/admin/generations', label: '생성 내역', icon: Zap },
  { href: '/admin/templates', label: '템플릿 관리', icon: LayoutTemplate },
  { href: '/admin/payments', label: '결제 관리', icon: CreditCard },
]

function NavItem({ href, label, icon: Icon, exact }: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f3f3f3] hover:text-[#111]'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

export function AdminShell({ children, adminEmail }: { children: ReactNode; adminEmail: string }) {
  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#111]">
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-[#e8e8e8] bg-white lg:flex">
        <div className="px-4 pt-5 pb-3">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111] text-white">
              <BarChart2 className="h-4 w-4" />
            </div>
            <span className="text-sm font-black tracking-tight">Shuffla 어드민</span>
          </Link>
          <p className="mt-1.5 truncate text-[11px] text-[#aaa]">{adminEmail}</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {navItems.map(item => <NavItem key={item.href} {...item} />)}
        </nav>
        <div className="border-t border-[#f0f0f0] px-4 py-4">
          <Link href="/" className="text-[11px] text-[#aaa] hover:text-[#111]">← 사이트로</Link>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#e8e8e8] bg-white px-4 py-3 lg:hidden">
        <span className="text-sm font-black">어드민</span>
        <div className="flex gap-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#f3f3f3]">
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="lg:pl-56">
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-[#777]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white p-4">
      <p className="text-xs font-semibold text-[#999]">{label}</p>
      <p className="mt-1.5 text-2xl font-black">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#bbb]">{hint}</p>}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e8e8e8] bg-white">
      <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-3.5">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#ddd] bg-[#fafafa] px-5 py-8 text-center text-sm text-[#aaa]">
      {children}
    </div>
  )
}

export function AdminFlash({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null
  const isError = Boolean(error)
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
        isError
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {error || message}
    </div>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#aaa]">{children}</th>
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className ?? ''}`}>{children}</td>
}
