import Link from 'next/link'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { AdminPageHeader, EmptyState, Section } from '../_components/AdminShell'
import { formatDate } from '../_components/adminUtils'
import { listCardTemplates } from '../../../lib/templates/db'
import { createDefaultTemplateAction, duplicateTemplateAction, deleteTemplateAction } from './actions'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: string }) {
  const active = status === 'active'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {active ? '활성' : '비활성(draft)'}
    </span>
  )
}

function tagSummary(tags: { domain: string[]; emotion: string[]; industry: string[]; style: string[]; visualTone: string[] }) {
  const all = [...tags.domain, ...tags.emotion, ...tags.industry, ...tags.style, ...tags.visualTone]
  return all.slice(0, 6)
}

export default async function AdminTemplatesPage() {
  const templates = await listCardTemplates()

  return (
    <>
      <AdminPageHeader
        title="템플릿 관리"
        description="카드뉴스 생성 시 AI가 콘텐츠에 맞춰 선택하는 비주얼 템플릿을 만들고 관리합니다."
      />

      <Section
        title="새 템플릿 만들기"
        action={
          <div className="flex gap-2">
            <form action={createDefaultTemplateAction}>
              <input type="hidden" name="slideCount" value="5" />
              <button className="rounded-lg bg-[#111] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#333]">+ 5장 템플릿</button>
            </form>
            <form action={createDefaultTemplateAction}>
              <input type="hidden" name="slideCount" value="7" />
              <button className="rounded-lg bg-[#111] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#333]">+ 7장 템플릿</button>
            </form>
          </div>
        }
      >
        <p className="text-sm text-[#666]">
          템플릿을 생성하면 기본 슬라이드 구성으로 시작합니다. 편집 화면에서 슬라이드별 텍스트 위치·타이포그래피·오버레이·태그를 조정하고 <b>활성</b> 상태로 전환하면 생성 파이프라인이 사용합니다.
        </p>
      </Section>

      <div className="mt-5">
        <Section title={`템플릿 목록 (${templates.length})`}>
          {templates.length === 0 ? (
            <EmptyState>아직 템플릿이 없습니다. 위에서 새 템플릿을 만들어 보세요.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col rounded-xl border border-[#eee] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[#111]">{t.name}</h3>
                      <p className="mt-0.5 text-xs text-[#888]">{t.slideCount}장 · {t.isDefault ? '기본 · ' : ''}{formatDate(t.updatedAt)}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>

                  {t.description && <p className="mt-2 line-clamp-2 text-xs text-[#666]">{t.description}</p>}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {tagSummary(t.tags).map((tag, i) => (
                      <span key={i} className="rounded bg-[#f4f4f5] px-2 py-0.5 text-[10px] font-medium text-[#666]">{tag}</span>
                    ))}
                    {tagSummary(t.tags).length === 0 && <span className="text-[10px] text-[#bbb]">태그 없음</span>}
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-[#f5f5f5] pt-3">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="flex items-center gap-1 rounded-lg bg-[#111] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#333]"
                    >
                      <Pencil className="h-3.5 w-3.5" /> 편집
                    </Link>
                    <form action={duplicateTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="flex items-center gap-1 rounded-lg border border-[#ddd] bg-white px-3 py-1.5 text-xs font-bold text-[#333] hover:bg-[#f5f5f5]">
                        <Copy className="h-3.5 w-3.5" /> 복제
                      </button>
                    </form>
                    <form action={deleteTemplateAction} className="ml-auto">
                      <input type="hidden" name="id" value={t.id} />
                      <button className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> 삭제
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  )
}
