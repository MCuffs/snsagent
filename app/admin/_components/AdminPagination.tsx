import Link from 'next/link'

export function AdminPagination({
  basePath,
  page,
  pageSize,
  total,
  query,
}: {
  basePath: string
  page: number
  pageSize: number
  total: number
  query: Record<string, string>
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  function href(nextPage: number) {
    const params = new URLSearchParams(query)
    params.set('page', String(nextPage))
    params.set('pageSize', String(pageSize))
    return `${basePath}?${params.toString()}`
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[#777]">
        전체 <strong className="text-[#111]">{total.toLocaleString()}</strong>건 · {start.toLocaleString()}–{end.toLocaleString()} 표시
      </p>
      <div className="flex items-center gap-2">
        {currentPage > 1 ? (
          <Link href={href(currentPage - 1)} className="rounded-lg border border-[#ddd] px-3 py-1.5 font-semibold hover:bg-[#f5f5f5]">
            이전
          </Link>
        ) : (
          <span className="rounded-lg border border-[#eee] px-3 py-1.5 text-[#ccc]">이전</span>
        )}
        <span className="min-w-20 text-center font-semibold">{currentPage} / {totalPages}</span>
        {currentPage < totalPages ? (
          <Link href={href(currentPage + 1)} className="rounded-lg border border-[#ddd] px-3 py-1.5 font-semibold hover:bg-[#f5f5f5]">
            다음
          </Link>
        ) : (
          <span className="rounded-lg border border-[#eee] px-3 py-1.5 text-[#ccc]">다음</span>
        )}
      </div>
    </div>
  )
}
