import { notFound } from 'next/navigation'
import { getShortsTemplate } from '../../../../lib/youtube-shorts-templates/db'
import { makeDefaultShortsTemplate, type YouTubeShortsTemplateRecord } from '../../../../lib/youtube-shorts-templates/types'
import { AdminPageHeader } from '../../_components/AdminShell'
import { ShortsTemplateEditor } from './ShortsTemplateEditor'

export const dynamic = 'force-dynamic'

export default async function YouTubeShortsTemplateEditorPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let template: YouTubeShortsTemplateRecord
  if (id === 'new') {
    const value = makeDefaultShortsTemplate()
    template = {
      ...value,
      templateName: '새 Shorts 템플릿',
      templateKey: 'new_shorts_template',
      isDefault: false,
      id: '',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  } else {
    const existing = await getShortsTemplate(id)
    if (!existing) notFound()
    template = existing
  }
  return (
    <>
      <AdminPageHeader title={id === 'new' ? 'YouTube Shorts 템플릿 추가' : 'YouTube Shorts 템플릿 편집'} description="변경 내용은 새로 계획되는 자동화 영상부터 적용됩니다." />
      <ShortsTemplateEditor initial={template} />
    </>
  )
}
