import Link from 'next/link'
import Image from 'next/image'

export function MarketingNav() {
    return (
        <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/85 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
                <Link
                    href="/"
                    className="flex items-center gap-2 text-[19px] font-black tracking-[-0.04em] text-[#0a0a0a] hover:opacity-75 transition-opacity"
                >
                    <Image src="/logo.svg" width={28} height={28} alt="Shuffla 로고" />
                    Shuffla
                </Link>
                <nav className="hidden items-center gap-10 text-[14px] font-semibold text-[#525252] md:flex">
                    <Link href="/" className="hover:text-[#0a0a0a] transition-colors">서비스 소개</Link>
                    <Link href="/pricing" className="hover:text-[#0a0a0a] transition-colors">요금제</Link>
                    <Link href="/blog" className="hover:text-[#0a0a0a] transition-colors">블로그</Link>
                </nav>
                <Link
                    href="/login"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 text-[13px] font-bold text-white transition-all hover:bg-[#1a1a1a] hover:-translate-y-[1px]"
                >
                    Google Login
                </Link>
            </div>
        </header>
    )
}
