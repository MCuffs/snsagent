import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '../../../lib/auth/user'
import { dbService } from '../../../lib/db-service'
import { isTrustedRenderableImageUrl } from '../../../src/lib/security/imageUrl'

const MAX_TEMPLATE_DOCUMENT_BYTES = 250_000
const MAX_TEMPLATE_THUMBNAIL_BYTES = 500_000

const TemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  document: z.string().min(2).refine(
    value => Buffer.byteLength(value, 'utf8') <= MAX_TEMPLATE_DOCUMENT_BYTES,
    'document is too large',
  ).refine(value => {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    } catch {
      return false
    }
  }, 'document must be a JSON object string'),
  slideNumber: z.number().int().min(1).max(20).nullable().optional(),
  thumbnail: z.string().nullable().optional().refine(value => {
    if (!value) return true
    if (Buffer.byteLength(value, 'utf8') > MAX_TEMPLATE_THUMBNAIL_BYTES) return false
    return isTrustedRenderableImageUrl(value)
  }, 'thumbnail URL is not allowed'),
})

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const templates = await dbService.getTemplates(user.id)
  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = TemplateCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid template payload' }, { status: 400 })
  }

  const body = parsed.data
  const template = await dbService.createTemplate(user.id, {
    name: body.name,
    document: body.document,
    slideNumber: body.slideNumber ?? null,
    thumbnail: body.thumbnail ?? null,
  })
  return NextResponse.json({ template }, { status: 201 })
}
