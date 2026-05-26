export default function CampaignDetailsLoading() {
  return (
    <div className="flex h-full min-h-screen bg-[#fbfaf7]">
      <aside className="hidden w-72 shrink-0 border-r border-[#ebe6dd] bg-white p-5 lg:block">
        <div className="h-3 w-24 animate-pulse rounded bg-[#e9e5dc]" />
        <div className="mt-4 h-7 w-48 animate-pulse rounded bg-[#dfd9cf]" />
        <div className="mt-10 space-y-3">
          {[1, 2, 3, 4].map(item => (
            <div key={item} className="h-16 animate-pulse rounded-xl bg-[#f1eee8]" />
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <div className="aspect-[4/5] w-full animate-pulse rounded-2xl border border-[#ebe6dd] bg-[#f1eee8]" />
          <div className="h-3 w-48 animate-pulse rounded bg-[#e4dfd5]" />
          <p className="text-sm font-semibold text-[#81786d]">작업물을 불러오는 중입니다.</p>
        </div>
      </main>
    </div>
  )
}
