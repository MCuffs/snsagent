import Link from 'next/link'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AdminPageHeader, EmptyState, Section } from '../_components/AdminShell'
import { formatDate } from '../_components/adminUtils'
import { ensureBuiltInShortsTemplates, listShortsTemplates } from '../../../lib/youtube-shorts-templates/db'
import { deleteShortsTemplateAction, setDefaultShortsTemplateAction } from './actions'
import { ShortsTemplatePreview } from './ShortsTemplatePreview'

export const dynamic = 'force-dynamic'

export default async function YouTubeShortsTemplatesPage() {
  await ensureBuiltInShortsTemplates()
  const templates = await listShortsTemplates()
  return (
    <>
      <AdminPageHeader title="YouTube Shorts 템플릿" description="자동화 백그라운드에서 콘텐츠에 맞는 9:16 영상 구성을 선택합니다." action={
        <Link href="/admin/youtube-shorts-templates/new" className="flex items-center gap-2 rounded-lg bg-[#111] px-4 py-2 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> 새 템플릿
        </Link>
      } />
      <Section title={`템플릿 목록 (${templates.length})`}>
        {templates.length === 0 ? <EmptyState>등록된 템플릿이 없습니다.</EmptyState> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map(template => (
              <article key={template.id} className="grid grid-cols-[90px_1fr] gap-4 rounded-xl border border-[#e8e8e8] p-4">
                <ShortsTemplatePreview template={template} compact />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div><h2 className="truncate text-sm font-black">{template.templateName}</h2><p className="text-[11px] text-[#888]">{template.templateKey}</p></div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${template.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-[#eee] text-[#777]'}`}>{template.isActive ? '활성' : '비활성'}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#666]">{template.category} · v{template.version}</p>
                  <p className="mt-1 text-[11px] text-[#aaa]">{formatDate(template.updatedAt)}</p>
                  {template.isDefault && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-amber-600"><Star className="h-3 w-3 fill-current" /> 기본 템플릿</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Link href={`/admin/youtube-shorts-templates/${template.id}`} className="flex items-center gap-1 rounded-md bg-[#111] px-2.5 py-1.5 text-[11px] font-bold text-white"><Pencil className="h-3 w-3" /> 편집</Link>
                    {!template.isDefault && <>
                      <form action={setDefaultShortsTemplateAction}><input type="hidden" name="id" value={template.id} /><button className="rounded-md border px-2 py-1.5 text-[11px] font-bold">기본값</button></form>
                      <form action={deleteShortsTemplateAction}><input type="hidden" name="id" value={template.id} /><button aria-label="삭제" className="rounded-md border border-red-200 p-1.5 text-red-600"><Trash2 className="h-3 w-3" /></button></form>
                    </>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
