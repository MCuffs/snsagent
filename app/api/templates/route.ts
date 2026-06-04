import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await dbService.getTemplates(user.id)
  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json() as { name?: string; document?: string; slideNumber?: number | null; thumbnail?: string | null }
  if (!body.name?.trim() || !body.document) {
    return NextResponse.json({ error: 'name and document are required' }, { status: 400 })
  }
  const template = await dbService.createTemplate(user.id, {
    name: body.name.trim(),
    document: body.document,
    slideNumber: body.slideNumber ?? null,
    thumbnail: body.thumbnail ?? null,
  })
  return NextResponse.json({ template }, { status: 201 })
}
