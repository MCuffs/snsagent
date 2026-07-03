import { NextResponse } from 'next/server'
import { getAdminUser } from '../../../../lib/admin'
import { ensureDefaultShortsTemplate, listShortsTemplates, saveShortsTemplate } from '../../../../lib/youtube-shorts-templates/db'
import { shortsTemplateInputSchema } from '../../../../lib/youtube-shorts-templates/types'

export const runtime = 'nodejs'

export async function GET() {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDefaultShortsTemplate()
  return NextResponse.json({ templates: await listShortsTemplates() })
}

export async function POST(request: Request) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = shortsTemplateInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid template.', issues: parsed.error.issues }, { status: 400 })
  try {
    return NextResponse.json({ template: await saveShortsTemplate(parsed.data) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Template creation failed.' }, { status: 409 })
  }
}
