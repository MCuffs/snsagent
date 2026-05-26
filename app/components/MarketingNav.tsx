import Link from 'next/link'
import Image from 'next/image'

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#ede9e2] bg-[#fbfaf7]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1380px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.05em] text-[#171714] transition-opacity hover:opacity-70">
          <Image src="/logo.svg" width={27} height={27} alt="Shuffla 로고" />
          Shuffla
        </Link>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 text-sm text-[#645e55] md:flex">
          <Link href="/#product" className="transition-colors hover:text-[#171714]">제품</Link>
          <Link href="/#workflow" className="transition-colors hover:text-[#171714]">워크플로우</Link>
          <Link href="/#gallery" className="transition-colors hover:text-[#171714]">갤러리</Link>
          <Link href="/pricing" className="transition-colors hover:text-[#171714]">요금제</Link>
          <Link href="/blog" className="transition-colors hover:text-[#171714]">리소스</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <a href="/api/auth/google/start" className="hidden px-3 text-sm text-[#645e55] transition-colors hover:text-[#171714] sm:block">
            로그인
          </a>
          <a
            href="/api/auth/google/start"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#171714] px-5 text-sm font-medium text-white transition hover:bg-[#302c26]"
          >
            시작하기
          </a>
        </div>
      </div>
    </header>
  )
}
