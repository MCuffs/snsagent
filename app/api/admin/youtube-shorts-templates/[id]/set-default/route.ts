import { NextResponse } from 'next/server'
import { getAdminUser } from '../../../../../../lib/admin'
import { setDefaultShortsTemplate } from '../../../../../../lib/youtube-shorts-templates/db'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  try {
    return NextResponse.json({ template: await setDefaultShortsTemplate(id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Default update failed.' }, { status: 404 })
  }
}
