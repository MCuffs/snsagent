import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../../lib/auth/user'
import { dbService } from '../../../../lib/db-service'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await dbService.deleteTemplate(user.id, id)
  return NextResponse.json({ ok: true })
}
