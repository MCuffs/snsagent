export function formatDate(value?: Date | string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value))
}

export function formatCurrency(value?: number | null, currency = 'krw') {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value || 0)
}

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  YOUTUBE_PROMO: 'YouTube',
  PRO: 'Creator',
  UNLIMITED: 'Studio',
  ENTERPRISE: 'Enterprise',
  AGENCY: 'Enterprise (legacy)',
  LITE: 'Free (legacy)',
  STARTER: 'Free (legacy)',
}

/**
 * Keep persisted plan codes stable while the product-facing names evolve.
 * A data migration can replace the legacy codes after every consumer is ready.
 */
export function formatPlan(plan?: string | null, includeCode = false) {
  const code = (plan || 'FREE').toUpperCase()
  const label = PLAN_LABELS[code] || code
  return includeCode && label !== code ? `${label} (${code})` : label
}

export function parseAdminPage(value?: string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

export function parseAdminPageSize(value?: string) {
  const parsed = Number(value)
  return [25, 50, 100].includes(parsed) ? parsed : 50
}

export function dateRange(from?: string, to?: string) {
  const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00+09:00`) : undefined
  const end = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999+09:00`) : undefined
  const gte = start && !Number.isNaN(start.getTime()) ? start : undefined
  const lte = end && !Number.isNaN(end.getTime()) ? end : undefined
  return gte || lte ? { gte, lte } : undefined
}

export function statusPill(status?: string | null) {
  const s = (status || '').toLowerCase()
  const color =
    s.includes('fail') || s.includes('past') || s.includes('block') || s.includes('error')
      ? 'bg-red-50 text-red-600 border-red-100'
      : s.includes('paid') || s.includes('active') || s.includes('generated') || s.includes('success') || s === 'posted'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
        : s.includes('review') || s.includes('pending') || s.includes('approval')
          ? 'bg-amber-50 text-amber-600 border-amber-100'
          : 'bg-[#f3f3f3] text-[#666] border-[#e8e8e8]'
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${color}`
}

export const inputCls = 'w-full rounded-lg border border-[#ddd] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/5'
export const btnCls = 'rounded-lg bg-[#111] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#333] active:scale-[0.98]'
export const btnOutlineCls = 'rounded-lg border border-[#ddd] bg-white px-4 py-2 text-sm font-bold text-[#333] transition hover:bg-[#f5f5f5]'
