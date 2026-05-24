import Link from 'next/link'

export function MarketingNav() {
    return (
        <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-gray-900 hover:opacity-80 transition-opacity">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0066ff] text-white">
                        <span className="text-xs font-black">IA</span>
                    </div>
                    Shuffla
                </Link>
                <nav className="hidden items-center gap-9 text-[15px] font-medium text-gray-500 md:flex">
                    <Link href="/" className="hover:text-gray-900 transition-colors">서비스 소개</Link>
                    <Link href="/pricing" className="hover:text-gray-900 transition-colors">요금제</Link>
                    <Link href="/blog" className="hover:text-gray-900 transition-colors">블로그</Link>
                </nav>
                <Link href="/login" className="flex h-[38px] items-center justify-center rounded-full bg-gray-900 px-5 text-[14px] font-semibold text-white transition-all hover:bg-gray-800 hover:-translate-y-[1px]">
                    무료로 시작하기
                </Link>
            </div>
        </header>
    )
}
