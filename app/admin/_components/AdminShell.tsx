import Link from 'next/link'
import { ReactNode } from 'react'

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/generations', label: 'Generations' },
  { href: '/admin/payments', label: 'Payments' },
]

export function AdminShell({ children, adminEmail }: { children: ReactNode; adminEmail: string }) {
  return (
    <div className="min-h-screen bg-[#f6f5f1] text-[#171412]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#e5ded5] bg-[#fbfaf7] px-5 py-6 lg:block">
        <Link href="/admin" className="block text-xl font-black tracking-tight">Shuffla Admin</Link>
        <p className="mt-1 truncate text-xs font-semibold text-[#81756d]">{adminEmail}</p>
        <nav className="mt-8 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-bold text-[#514943] transition hover:bg-[#eee8df]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-[#e5ded5] bg-[#fbfaf7]/90 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className="text-lg font-black">Shuffla Admin</Link>
            {navItems.map(item => (
              <Link key={item.href} href={item.href} className="text-xs font-bold text-[#635951]">
                {item.label}
              </Link>
            ))}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a06f50]">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-black tracking-tight text-[#171412]">{title}</h1>
      {description && <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#706760]">{description}</p>}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-[#e6dfd5] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#97897d]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#171412]">{value}</p>
      {hint && <p className="mt-1 text-xs font-semibold text-[#81756d]">{hint}</p>}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[#e6dfd5] bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-[#171412]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-[#d8cec1] bg-[#fbfaf7] p-6 text-sm font-semibold text-[#81756d]">{children}</div>
}

export function formatDate(value?: Date | string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value))
}

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value || 0)
}

export function statusPill(status?: string | null) {
  const normalized = (status || 'unknown').toLowerCase()
  const tone = normalized.includes('fail') || normalized.includes('past') || normalized.includes('blocked')
    ? 'bg-red-50 text-red-700 border-red-100'
    : normalized.includes('paid') || normalized.includes('active') || normalized.includes('generated') || normalized.includes('success')
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-[#f4f1eb] text-[#6e6258] border-[#e4dbcf]'
  return `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black ${tone}`
}
