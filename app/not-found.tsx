'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="app-shell flex min-h-screen items-center justify-center text-[#1f1512]">
      <div className="text-center px-6">
        <p className="text-7xl font-black tracking-tighter text-[#ff4f0a]">404</p>
        <h1 className="mt-4 text-2xl font-black tracking-tight">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm text-[#746a62]">주소가 잘못됐거나 삭제된 페이지입니다.</p>
        <Link
          href="/brand"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1f1512] px-5 py-2.5 text-sm font-black text-white hover:bg-[#352521] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  )
}
