import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

export function MarketingFooter() {
    return (
        <>
            <footer className="bg-white border-t border-gray-100 pt-16 pb-20">
                <div className="mx-auto max-w-7xl px-6">
                    <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
                        <div className="col-span-2">
                            <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight mb-6 text-gray-900">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0066ff] text-white">
                                    <span className="text-[10px] font-black">IA</span>
                                </div>
                                Shuffla
                            </div>
                            <div className="text-[13px] text-gray-500 leading-relaxed space-y-1">
                                <p>(주)인스타에이전트 | 대표 이사 : 홍길동</p>
                                <p>사업자 등록번호 : 123-45-67890</p>
                                <p>서울특별시 강남구 테헤란로 123 IA 빌딩</p>
                                <p className="mt-2 text-gray-400">
                                    <a href="#" className="hover:underline">사업자정보확인</a>
                                </p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold mb-5 text-[15px] text-gray-900">바로가기</h4>
                            <ul className="space-y-3.5 text-[14px] text-gray-500">
                                <li><Link href="/" className="hover:text-[#0066ff] transition-colors">서비스 소개</Link></li>
                                <li><Link href="/pricing" className="hover:text-[#0066ff] transition-colors">요금제</Link></li>
                                <li><Link href="/blog" className="hover:text-[#0066ff] transition-colors">블로그</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-5 text-[15px] text-gray-900">고객 지원</h4>
                            <ul className="space-y-3.5 text-[14px] text-gray-500">
                                <li><a href="#" className="hover:text-[#0066ff] transition-colors">서비스 이용약관</a></li>
                                <li><a href="#" className="hover:text-[#0066ff] font-semibold transition-colors">개인정보처리방침</a></li>
                                <li><a href="mailto:support@shuffla.ai" className="hover:text-[#0066ff] transition-colors">문의하기</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-[13px] text-gray-400">
                            &copy; 2026 Shuffla. All rights reserved.
                        </div>
                        <div className="flex gap-4 text-[13px] text-gray-400">
                            <a href="#" className="hover:text-gray-900">Terms</a>
                            <a href="#" className="hover:text-gray-900">Privacy</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Floating Chatbot UI mimicking VAETKI Commerce */}
            <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3">
                <div className="hidden animate-in fade-in slide-in-from-bottom-2 duration-500 md:flex items-center gap-2 rounded-2xl rounded-br-sm bg-white px-5 py-3 text-[14px] font-medium text-gray-600 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100">
                    <span className="font-bold text-gray-900">AI CHAT</span>
                    안녕하세요. Shuffla 안내 챗봇입니다.
                </div>
                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0066ff] text-white shadow-[0_12px_30px_rgba(0,102,255,0.3)] hover:scale-105 transition-transform">
                    <MessageSquare className="h-6 w-6" fill="currentColor" />
                </button>
            </div>
        </>
    )
}
