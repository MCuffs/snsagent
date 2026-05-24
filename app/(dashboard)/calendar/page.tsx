import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, Download, Sparkles } from 'lucide-react'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

export default async function ContentCalendarPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const brands = await dbService.getBrands(user.id)
  if (brands.length === 0) {
    redirect('/brand')
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 md:px-8">
      <section className="panel rounded-2xl p-8 md:p-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e8dfd4] bg-white px-3 py-1 text-xs font-black text-[#746a62]">
          <Calendar className="h-3.5 w-3.5 text-[#ff4f0a]" />
          Coming Soon
        </div>
        <h1 className="text-3xl font-black tracking-[-0.05em] text-[#1f1512] md:text-5xl">
          예약 캘린더와 자동 발행은 추후 출시 예정입니다.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#746a62]">
          지금은 카드뉴스 제작 품질과 다운로드 경험을 먼저 완성합니다.
          생성된 카드뉴스는 결과 화면에서 편집하고 이미지 파일로 내려받을 수 있습니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/campaign/new" className="btn-primary px-5">
            <Sparkles className="h-4 w-4" />
            카드뉴스 만들기
          </Link>
          <Link href="/dashboard" className="btn-secondary px-5">
            <Download className="h-4 w-4" />
            작업대 보기
          </Link>
        </div>
      </section>
    </div>
  )
}
