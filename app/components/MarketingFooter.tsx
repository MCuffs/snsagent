import Link from 'next/link'
import Image from 'next/image'
import { MessageSquare } from 'lucide-react'

export function MarketingFooter() {
    return (
        <>
            <footer className="bg-[#0a0a0a] text-white pt-20 pb-12">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="grid gap-12 md:grid-cols-12">
                        <div className="md:col-span-5">
                            <Link href="/" className="inline-flex items-center gap-2 text-[19px] font-black tracking-[-0.04em] text-white mb-6">
                                <Image src="/logo.svg" width={28} height={28} alt="Shuffla 로고" />
                                Shuffla
                            </Link>
                            <p className="text-[15px] text-white/70 leading-relaxed mb-8 max-w-sm">
                                AI가 브랜드를 분석하고, 카드뉴스를 생성하고, 원하는 결과물로 편집할 수 있게 돕습니다.
                            </p>
                            <a
                                href="/api/auth/google/start"
                                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-[#0a0a0a] hover:bg-white/90 transition-colors"
                            >
                                Google Login
                            </a>
                        </div>
                        <div className="md:col-span-2 md:col-start-7">
                            <h4 className="font-bold mb-5 text-[12px] text-white uppercase tracking-[0.12em]">제품</h4>
                            <ul className="space-y-3 text-[14px] text-white/60">
                                <li><Link href="/" className="hover:text-white transition-colors">서비스 소개</Link></li>
                                <li><Link href="/pricing" className="hover:text-white transition-colors">요금제</Link></li>
                                <li><Link href="/blog" className="hover:text-white transition-colors">블로그</Link></li>
                            </ul>
                        </div>
                        <div className="md:col-span-2">
                            <h4 className="font-bold mb-5 text-[12px] text-white uppercase tracking-[0.12em]">지원</h4>
                            <ul className="space-y-3 text-[14px] text-white/60">
                                <li><a href="#" className="hover:text-white transition-colors">이용약관</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">개인정보처리방침</a></li>
                                <li><a href="mailto:support@shuffla.ai" className="hover:text-white transition-colors">문의하기</a></li>
                            </ul>
                        </div>
                        <div className="md:col-span-3">
                            <h4 className="font-bold mb-5 text-[12px] text-white uppercase tracking-[0.12em]">회사</h4>
                            <div className="text-[12px] text-white/50 leading-relaxed space-y-1">
                                <p>Shuffla</p>
                                <p>대표이사 : 홍길동</p>
                                <p>사업자번호 : 123-45-67890</p>
                                <p>서울특별시 강남구 테헤란로 123</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-[12px] text-white/40">
                            &copy; 2026 Shuffla. All rights reserved.
                        </div>
                        <div className="flex gap-6 text-[12px] text-white/40">
                            <a href="#" className="hover:text-white">Terms</a>
                            <a href="#" className="hover:text-white">Privacy</a>
                            <a href="#" className="hover:text-white">Cookies</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* 챗봇 */}
            <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-[13px] font-medium text-[#525252] shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-black/[0.06]">
                    <span className="font-black text-[#0a0a0a]">AI</span>
                    안녕하세요. Shuffla 챗봇입니다.
                </div>
                <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0a0a0a] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:scale-105 transition-transform">
                    <MessageSquare className="h-5 w-5" fill="currentColor" />
                </button>
            </div>
        </>
    )
}
