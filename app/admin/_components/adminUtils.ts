export function formatDate(value?: Date | string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(value))
}

export function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value || 0)
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
