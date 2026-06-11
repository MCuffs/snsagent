import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSessionUser } from '../../../actions'
import prisma from '../../../../lib/db'

// GET — fetch current API key
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mcpApiKey: true },
  })

  return NextResponse.json({ key: row?.mcpApiKey ?? null })
}

// POST — generate (or regenerate) API key
export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = `shfl_${randomBytes(24).toString('hex')}`

  await prisma.user.update({
    where: { id: user.id },
    data: { mcpApiKey: key },
  })

  return NextResponse.json({ key })
}

// DELETE — revoke API key
export async function DELETE() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { mcpApiKey: null },
  })

  return NextResponse.json({ ok: true })
}
