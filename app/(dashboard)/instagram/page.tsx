import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, Sparkles, UploadCloud } from 'lucide-react'
import { getSessionUser } from '../../actions'
import { dbService } from '../../../lib/db-service'

export const dynamic = 'force-dynamic'

export default async function InstagramSettingsPage() {
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
          <Clock className="h-3.5 w-3.5 text-[#ff4f0a]" />
          추후 추가 예정
        </div>
        <UploadCloud className="mb-6 h-10 w-10 text-[#ff4f0a]" />
        <h1 className="text-3xl font-black tracking-[-0.05em] text-[#1f1512] md:text-5xl">
          SNS 자동 업로드
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#746a62]">
          추후 추가 예정입니다. 현재는 카드뉴스 만들기, 편집, 다운로드 기능을 먼저 사용할 수 있습니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/campaign/new" className="btn-primary px-5">
            <Sparkles className="h-4 w-4" />
            새 카드뉴스 바로 만들기
          </Link>
        </div>
      </section>
    </div>
  )
}
