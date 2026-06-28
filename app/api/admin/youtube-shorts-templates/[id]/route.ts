import { NextResponse } from 'next/server'
import { getAdminUser } from '../../../../../lib/admin'
import { deleteShortsTemplate, getShortsTemplate, saveShortsTemplate } from '../../../../../lib/youtube-shorts-templates/db'
import { shortsTemplateInputSchema } from '../../../../../lib/youtube-shorts-templates/types'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const template = await getShortsTemplate(id)
  return template ? NextResponse.json({ template }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const parsed = shortsTemplateInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid template.', issues: parsed.error.issues }, { status: 400 })
  try {
    return NextResponse.json({ template: await saveShortsTemplate(parsed.data, id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Template update failed.' }, { status: 409 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  try {
    await deleteShortsTemplate(id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Template deletion failed.' }, { status: 409 })
  }
}
