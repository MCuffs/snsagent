import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AdminPageHeader } from '../../_components/AdminShell'
import { getCardTemplate } from '../../../../lib/templates/db'
import TemplateEditor from './TemplateEditor'

export const dynamic = 'force-dynamic'

export default async function AdminTemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const template = await getCardTemplate(id)
  if (!template) notFound()

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/templates" className="inline-flex items-center gap-1 text-sm font-medium text-[#666] hover:text-[#111]">
          <ChevronLeft className="h-4 w-4" /> 템플릿 목록
        </Link>
      </div>
      <AdminPageHeader title="템플릿 편집" description="슬라이드별 레이아웃과 AI 선택 태그를 설정합니다." />
      <TemplateEditor template={template} />
    </>
  )
}
